import { createServerFileRoute } from '@tanstack/react-start/server'
import { mastra } from '@/features/chat-demo/lib/mastra-setup'

export const ServerRoute = createServerFileRoute('/api/chat').methods({
  POST: async ({ request }) => {
    try {
      // Parse the request body
      const { messages } = await request.json()
      console.log('📥 API received messages:', JSON.stringify(messages, null, 2))

      if (!messages || messages.length === 0) {
        console.log('❌ No messages provided')
        return Response.json({ error: 'No messages provided' }, { status: 400 })
      }

      // Get the chat agent from Mastra
      console.log('🤖 Getting chat agent...')
      const chatAgent = mastra.getAgent('chat-demo-agent')
      console.log('✅ Got chat agent:', chatAgent.name)
      
      // Stream the response using Mastra's streamVNext with AI SDK format
      console.log('🚀 Starting stream with format: aisdk')
      const stream = await chatAgent.streamVNext(messages, {
        format: 'aisdk',
      })
      console.log('📤 Stream created, returning response...')
      
      // Return the UI message stream response for AI SDK
      return stream.toUIMessageStreamResponse()
    } catch (error) {
      console.error('💥 Chat API error:', error)
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
      return Response.json({ error: 'Failed to process chat request' }, { status: 500 })
    }
  },
})