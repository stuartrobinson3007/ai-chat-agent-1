import { createFileRoute } from '@tanstack/react-router'
import { ToolConnectionManager } from '@/features/tools/components/ToolConnectionManager'

function ConnectionsPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Connections</h1>
        <p className="text-muted-foreground mt-2">
          Connect external services that your agents can use to take actions
        </p>
      </div>
      
      <ToolConnectionManager />
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/connections')({
  component: ConnectionsPage,
})