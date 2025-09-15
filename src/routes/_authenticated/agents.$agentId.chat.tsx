import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AgentChatInterface } from '@/features/agents/components/AgentChatInterface'
import { getAgent } from '@/features/agents/lib/agents.server'
import { Bot, Loader2 } from 'lucide-react'
import { Badge } from '@/taali/components/ui/badge'

function AgentChat() {
  const params = Route.useParams()
  const agentId = params.agentId
  
  const { data: agent, isLoading, error } = useQuery({
    queryKey: ['agent', agentId],
    queryFn: () => getAgent({ data: { id: agentId } }),
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
  
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading agent...</p>
        </div>
      </div>
    )
  }
  
  if (error || !agent) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Bot className="h-16 w-16 text-muted-foreground mb-4 mx-auto" />
          <h2 className="text-xl font-semibold mb-2">Agent not found</h2>
          <p className="text-muted-foreground">
            The agent you're looking for doesn't exist or has been deleted.
          </p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="h-screen flex flex-col">
      {/* Clean header for context */}
      <div className="border-b p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-primary" />
            <div>
              <h1 className="font-semibold">{agent.name}</h1>
              <p className="text-sm text-muted-foreground">
                AI Agent • {(agent.connections?.length || 0) + 1} tools available
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              search_docs
            </Badge>
            {agent.connections?.map(conn => (
              <Badge key={conn.connectionId} variant="secondary" className="text-xs">
                {conn.toolAlias}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      
      {/* Agent-specific chat using your existing patterns */}
      <div className="flex-1">
        <AgentChatInterface agentId={agentId} />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/agents/$agentId/chat')({
  component: AgentChat,
})