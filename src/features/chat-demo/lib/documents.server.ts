import { createServerFn } from '@tanstack/react-start'
// import { writeFileSync } from 'fs'
// import { join } from 'path'
import { z } from 'zod'
// import { eq } from 'drizzle-orm'
// import { db } from '@/lib/db/db'
// import { documents, documentChunks } from '@/database/schema'
// import { openai } from '@ai-sdk/openai'
// import { embedMany } from 'ai'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
// import { GoogleGenerativeAI } from '@google/generative-ai'
// import { MDocument } from '@mastra/rag'

const processDocumentSchema = z.object({
  title: z.string().min(1),
  fileData: z.string(), // base64 encoded file data
  contentType: z.string(),
})

// Document processing function
export const processDocument = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware, organizationMiddleware])
  .validator((data: unknown) => processDocumentSchema.parse(data))
  .handler(async ({ data, context }) => {
    try {
      const { title, fileData, contentType } = data
      const organizationId = context.organizationId!
      const userId = context.user.id

      console.log('🎯 Document processing started:', { title, contentType, userId, organizationId })
      console.log('📄 File data length:', fileData.length)

      // TODO: Add back database and file operations
      // TODO: Add back PDF extraction
      // TODO: Add back RAG processing

      return { success: true, documentId: 'test-123' }
    } catch (error) {
      console.error('Document processing error:', error)
      throw new Error('Failed to process document')
    }
  })

// TODO: Uncomment and add back PDF extraction and RAG processing
/*
// Function to extract text from PDF using Gemini
async function extractTextFromPDF(base64Data: string): Promise<string> {
  // Implementation here
}

// Function to chunk and embed document content using MDocument
async function processDocumentForRAG(documentId: string, content: string, title: string) {
  // Implementation here
}
*/