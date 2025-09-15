import { createServerFn } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/db'
import { documents } from '@/database/schema'
import { openai } from '@ai-sdk/openai'
import { embedMany } from 'ai'
import { auth } from '@/lib/auth/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MDocument } from '@mastra/rag'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { mastra, initializeVectorIndex } from './mastra-setup'

export const processDocument = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((formData) => {
    if (!(formData instanceof FormData)) {
      throw new Error('Invalid form data')
    }

    const file = formData.get('document') as File
    const title = formData.get('title') as string

    if (!file) {
      throw new Error('No file provided')
    }

    if (!title) {
      throw new Error('No title provided')
    }

    // Validate file type
    const allowedTypes = ['text/plain', 'application/pdf', 'text/markdown']
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Please upload a text, PDF, or markdown file.')
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      throw new Error(`File too large. Maximum size is ${maxSize / 1024 / 1024}MB`)
    }

    return { file, title }
  })
  .handler(async ({ data: { file, title }, context }) => {
    try {
      // Get the request for headers
      const request = getWebRequest()
      
      // Authenticate user
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session?.user) {
        throw new Error('Unauthorized')
      }

      // Get organization context from middleware
      const organizationId = context.organizationId!
      const userId = context.user.id

      console.log('🎯 Document processing started:', { title, contentType: file.type, userId, organizationId })
      console.log('📄 File size:', file.size, 'bytes')

      // Extract text content based on file type
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

      console.log('📄 Extracted text length:', extractedText.length)

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

      // 3. Initialize vector index if needed
      await initializeVectorIndex()
      
      // 4. Process document for RAG using Mastra
      await processDocumentForRAG(document.id, extractedText, title)

      return { success: true, documentId: document.id }
    } catch (error) {
      console.error('Document processing error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to process document')
    }
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

// Function to chunk and embed document content using Mastra
async function processDocumentForRAG(documentId: string, content: string, title: string) {
  try {
    // Use MDocument for proper chunking
    const doc = MDocument.fromText(content)
    const chunks = await doc.chunk({
      strategy: "recursive",
      maxSize: 500,
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

    // Get Mastra's vector store and store embeddings
    const vectorStore = mastra.getVector("pgVector")
    
    await vectorStore.upsert({
      indexName: 'document_embeddings',
      vectors: embeddings, // Direct number[][] array from embedMany
      metadata: chunkTexts.map((chunk, index) => ({
        id: `${documentId}_${index}`,
        documentId,
        title,
        chunkText: chunk,
        chunkIndex: index,
        ...chunkMetadata[index] // Include extracted metadata
      }))
    })
    
    console.log(`✅ Processed ${chunkTexts.length} chunks for document ${documentId} using Mastra vectors`)
  } catch (error) {
    console.error('RAG processing error:', error)
    throw error
  }
}