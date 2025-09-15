import { createServerFileRoute } from '@tanstack/react-start/server'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db/db'
import { documents, member } from '@/database/schema'
import { openai } from '@ai-sdk/openai'
import { embedMany } from 'ai'
import { auth } from '@/lib/auth/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MDocument } from '@mastra/rag'

export const ServerRoute = createServerFileRoute('/api/process-document').methods({
  POST: async ({ request }) => {
    try {
      // Authenticate user
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session?.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Parse FormData like avatar upload
      const formData = await request.formData()
      const file = formData.get('document') as File
      const title = formData.get('title') as string

      if (!file) {
        return Response.json({ error: 'No file provided' }, { status: 400 })
      }

      if (!title) {
        return Response.json({ error: 'No title provided' }, { status: 400 })
      }

      // Get user's organization membership (like organization middleware does)
      const userId = session.user.id
      
      // Get user's active organization from their membership
      const userMembership = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, userId))
        .limit(1)
      
      const organizationId = userMembership[0]?.organizationId
      
      if (!organizationId) {
        return Response.json({ error: 'No organization membership found' }, { status: 400 })
      }

      console.log('🎯 Document processing started:', { title, contentType: file.type, userId, organizationId })
      console.log('📄 File size:', file.size, 'bytes')

      // Extract text content based on file type (like avatar upload)
      let extractedText: string
      if (file.type === 'application/pdf') {
        // For PDFs, convert to base64 for Google AI
        const arrayBuffer = await file.arrayBuffer()
        const base64Data = Buffer.from(arrayBuffer).toString('base64')
        extractedText = await extractTextFromPDF(base64Data)
      } else {
        // For text files, read directly
        extractedText = await file.text()
      }

      // 1. Save document metadata to database
      const [document] = await db.insert(documents).values({
        title,
        filePath: '', // Will be updated after file is saved
        contentType: file.type,
        fileSize: extractedText.length,
        organizationId,
        createdBy: userId,
      }).returning({ id: documents.id })

      // 2. Save file to storage
      const fileName = `${document.id}.txt`
      const filePath = join(process.env.STORAGE_PATH || './storage', 'documents', organizationId, fileName)
      
      // Ensure directory exists
      const dirPath = join(process.env.STORAGE_PATH || './storage', 'documents', organizationId)
      await import('fs').then(fs => fs.promises.mkdir(dirPath, { recursive: true }))
      
      // Write file
      writeFileSync(filePath, extractedText)

      // Update document with file path
      await db.update(documents)
        .set({ filePath: `documents/${organizationId}/${fileName}` })
        .where(eq(documents.id, document.id))

      // 3. Process document for RAG
      await processDocumentForRAG(document.id, extractedText, title)

      return Response.json({ success: true, documentId: document.id })
    } catch (error) {
      console.error('Document processing error:', error)
      return Response.json(
        { error: error instanceof Error ? error.message : 'Failed to process document' },
        { status: 500 }
      )
    }
  },
})

// Function to extract text from PDF using Gemini
async function extractTextFromPDF(base64Data: string): Promise<string> {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })
    
    const result = await model.generateContent([
      "Extract all text content from this PDF document. Return only the clean text content with proper formatting, no analysis or commentary.",
      {
        inlineData: {
          data: base64Data,
          mimeType: 'application/pdf'
        }
      }
    ])
    
    return result.response.text()
  } catch (error) {
    console.error('PDF text extraction error:', error)
    throw new Error('Failed to extract text from PDF')
  }
}

// Function to chunk and embed document content using MDocument
async function processDocumentForRAG(documentId: string, content: string, title: string) {
  try {
    // Use MDocument for proper chunking
    const doc = MDocument.fromText(content)
    const chunks = await doc.chunk({
      strategy: "recursive",
      size: 500,
      overlap: 50,
      extract: { metadata: true }
    })
    
    // Get the chunked text
    const chunkTexts = doc.getText()
    const chunkMetadata = doc.getMetadata()
    
    // Generate embeddings for all chunks
    const embeddingTexts = chunkTexts.map(chunk => `Title: ${title}\n\nContent: ${chunk}`)
    
    const { embeddings } = await embedMany({
      model: openai.embedding('text-embedding-3-small'),
      values: embeddingTexts,
    })

    // Store chunks and embeddings in database
    const chunkInserts = chunkTexts.map((chunk, index) => ({
      documentId,
      chunkText: chunk,
      chunkIndex: index,
      embedding: embeddings[index],
      metadata: { 
        title, 
        chunkIndex: index,
        ...chunkMetadata[index] // Include any extracted metadata
      },
    }))

    await db.insert(documentChunks).values(chunkInserts)
    
    console.log(`✅ Processed ${chunkTexts.length} chunks for document ${documentId}`)
  } catch (error) {
    console.error('RAG processing error:', error)
    throw error
  }
}