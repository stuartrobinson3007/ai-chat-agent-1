import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { openai } from '@ai-sdk/openai'
import { embedMany } from 'ai'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/db'
import { agentDocuments } from '@/database/schema'
import { mastra } from '@/features/chat-demo/lib/mastra-setup'

export function createAgentSearchTool(agentId: string) {
  return createTool({
    id: `agent-search-${agentId}`,
    description: 'Search this agent\'s uploaded documents and knowledge base',
    inputSchema: z.object({
      query: z.string().min(1, 'Search query is required'),
      limit: z.number().min(1).max(20).default(5)
    }),
    outputSchema: z.object({
      results: z.array(z.object({
        content: z.string(),
        title: z.string(),
        source: z.string(),
        score: z.number()
      })),
      totalResults: z.number()
    }),
    execute: async ({ context }) => {
      try {
        const { query, limit } = context
        
        console.log(`🔍 Searching agent ${agentId} documents for: "${query}"`)
        
        // Get agent's linked document IDs
        const agentDocs = await db
          .select({ documentId: agentDocuments.documentId })
          .from(agentDocuments)
          .where(eq(agentDocuments.agentId, agentId))
        
        const documentIds = agentDocs.map(d => d.documentId)
        console.log(`📚 Agent has access to documents:`, documentIds)
        
        if (documentIds.length === 0) {
          console.log(`⚠️ Agent ${agentId} has no linked documents`)
          return {
            results: [],
            totalResults: 0
          }
        }
        
        // Generate embedding for the search query
        const { embeddings } = await embedMany({
          model: openai.embedding('text-embedding-3-small'),
          values: [query]
        })
        
        const queryEmbedding = embeddings[0]
        console.log(`🔢 Generated query embedding for: "${query}"`)
        
        // Search in Mastra's vector store
        const vectorStore = mastra.getVector('pgVector')
        
        // Query embeddings using correct Mastra API
        const searchResults = await vectorStore.query({
          indexName: 'document_embeddings',
          queryVector: queryEmbedding,
          topK: limit * 2, // Get more results to filter
          includeVector: false // Don't return actual vectors
        })
        
        console.log(`🎯 Raw search results:`, searchResults?.length || 0)
        
        // Filter results to only include agent's documents
        const filteredResults = searchResults
          ?.filter(result => {
            const metadata = result.metadata
            return metadata && documentIds.includes(metadata.documentId)
          })
          .slice(0, limit) // Limit to requested number
          .map(result => ({
            content: result.metadata.chunkText || '',
            title: result.metadata.title || 'Unknown',
            source: result.metadata.documentId || 'Unknown',
            score: result.score || 0
          })) || []
        
        console.log(`✅ Filtered results for agent:`, filteredResults.length)
        
        return {
          results: filteredResults,
          totalResults: filteredResults.length
        }
        
      } catch (error) {
        console.error('Agent search error:', error)
        throw new Error(
          error instanceof Error 
            ? `Search failed: ${error.message}`
            : 'Search failed: Unknown error'
        )
      }
    }
  })
}