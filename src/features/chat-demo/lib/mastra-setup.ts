import { Mastra } from '@mastra/core'
import { Agent } from '@mastra/core'
import { openai } from '@ai-sdk/openai'
import { PgVector } from '@mastra/pg'
import { createVectorQueryTool } from '@mastra/rag'

// Create vector query tool for document search
const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'document_embeddings', // Use descriptive name for our documents
  model: openai.embedding('text-embedding-3-small'),
})

// Create a RAG-enabled chat agent
const chatDemoAgent = new Agent({
  name: 'chat-demo-agent',
  description: 'A helpful chat assistant with access to uploaded documents',
  model: openai('gpt-4o-mini'),
  instructions: `You are a helpful and friendly assistant with access to a knowledge base of uploaded documents.
  
  When users ask questions that might be answered by documents, use the vectorQueryTool to search for relevant information.
  Always cite your sources when using information from the knowledge base.
  
  If you can't find relevant information in the knowledge base, clearly state that and provide a helpful general response.
  
  Keep your responses concise and helpful.`,
  tools: {
    vectorQueryTool,
  },
})

// Initialize PgVector store
const pgVector = new PgVector({ 
  connectionString: process.env.DATABASE_URL!
})

// Initialize Mastra with RAG configuration
export const mastra = new Mastra({
  agents: {
    'chat-demo-agent': chatDemoAgent
  },
  vectors: {
    pgVector
  }
})

// Initialize vector index for documents
export async function initializeVectorIndex() {
  try {
    const vectorStore = mastra.getVector("pgVector")
    await vectorStore.createIndex({
      indexName: 'document_embeddings',
      dimension: 1536, // OpenAI embedding dimensions
      metric: 'cosine'
    })
    console.log('✅ Vector index initialized: document_embeddings')
  } catch (error) {
    // Index might already exist, which is fine
    console.log('📋 Vector index exists or created:', error instanceof Error ? error.message : 'Unknown error')
  }
}