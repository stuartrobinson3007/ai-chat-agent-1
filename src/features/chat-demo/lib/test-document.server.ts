import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/db'
import { documents } from '@/database/schema'
import { openai } from '@ai-sdk/openai'
import { embedMany } from 'ai'
import { MDocument } from '@mastra/rag'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Test with file processing schema
const testDocumentSchema = z.object({
  message: z.string().min(1),
  fileName: z.string().optional(),
  // Add file processing fields
  title: z.string().optional(),
  fileData: z.string().optional(),
  contentType: z.string().optional(),
})

// Test document processing function - WORKING BASELINE
export const testDocumentProcessing = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => testDocumentSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Handle both test input and file upload input
    const inputText = data.message || data.title || 'test'
    const isFileUpload = !!(data.title && data.fileData)
    
    console.log('🧪 STEP 9 - File processing schema added:', inputText)
    console.log('👤 User:', context.user.id)
    console.log('🏢 Organization:', context.organizationId)
    console.log('📋 Is file upload:', isFileUpload)
    
    // Test actual embedMany call
    console.log('🤖 Calling embedMany...')
    const testEmbedding = await embedMany({
      model: openai.embedding('text-embedding-3-small'),
      values: ['test'],
    })
    console.log('✅ embedMany call successful:', testEmbedding.embeddings[0].length, 'dimensions')
    
    // Test actual MDocument call
    console.log('📄 Calling MDocument.fromText...')
    const doc = MDocument.fromText(inputText)
    const chunks = await doc.chunk({
      strategy: "recursive",
      maxSize: 100,
      overlap: 10
    })
    const chunkTexts = doc.getText()
    console.log('✅ MDocument call successful:', chunkTexts.length, 'chunks')
    
    // Test actual Google AI call
    console.log('🔍 Calling Google AI generateContent...')
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || 'test-key')
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })
    const result = await model.generateContent([
      "Respond with just 'SUCCESS'",
    ])
    const googleResponse = result.response.text()
    console.log('✅ Google AI call successful:', googleResponse)
    
    if (data.fileName) {
      console.log('📁 File name:', data.fileName)
    }
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 500))
    
    return { 
      success: true, 
      received: inputText,
      processedBy: context.user.id,
      organization: context.organizationId,
      step: 'STEP_9_FILE_SCHEMA_ADDED',
      embeddingDimensions: testEmbedding.embeddings[0].length,
      chunksGenerated: chunkTexts.length,
      googleAIResponse: googleResponse
    }
  })

// Export the same function as processDocument for Documents tab to use
export const processDocument = testDocumentProcessing