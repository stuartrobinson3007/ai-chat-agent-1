import { createServerFileRoute } from '@tanstack/react-start/server'
import { getAgentInstance } from '@/features/agents/lib/dynamic-agents'

export const ServerRoute = createServerFileRoute('/api/agents/$agentId/chat').methods({
  POST: async ({ request, params }) => {
    console.log('🚨 AGENT-SPECIFIC API CALLED! AgentID:', params.agentId)
    
    try {
      // Parse the request body
      const { messages } = await request.json()
      console.log('📥 Agent chat API received messages for agent:', params.agentId)

      if (!messages || messages.length === 0) {
        console.log('❌ No messages provided')
        return Response.json({ error: 'No messages provided' }, { status: 400 })
      }

      // Get the dynamic agent instance
      console.log('🤖 Getting dynamic agent instance...')
      const agent = await getAgentInstance(params.agentId)
      console.log('✅ Got agent:', agent.name)
      
      // Stream the response using Mastra's streamVNext with AI SDK format
      // This is the same pattern as your working chat demo
      console.log('🚀 Starting stream with format: aisdk')
      const stream = await agent.streamVNext(messages, {
        format: 'aisdk',
      })
      console.log('📤 Stream created, returning response...')
      
      // Return the UI message stream response for AI SDK
      return stream.toUIMessageStreamResponse()
    } catch (error) {
      console.error('💥 Agent chat API error:', error)
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
      
      // Return helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('Agent not found')) {
          return Response.json({ error: 'Agent not found' }, { status: 404 })
        }
        if (error.message.includes('not connected')) {
          return Response.json({ error: 'Required service not connected' }, { status: 400 })
        }
      }
      
      return Response.json({ error: 'Failed to process chat request' }, { status: 500 })
    }
  },
})