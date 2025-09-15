import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getAgent } from '@/features/agents/lib/agents.server'
import { EditAgent } from '@/features/agents/components/EditAgent'
import { Bot, Loader2 } from 'lucide-react'

function EditAgentPage() {
  const { agentId } = Route.useParams()
  
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
            The agent you're trying to edit doesn't exist or has been deleted.
          </p>
        </div>
      </div>
    )
  }
  
  return <EditAgent agent={agent} />
}

export const Route = createFileRoute('/_authenticated/agents/$agentId/edit')({
  component: EditAgentPage,
})