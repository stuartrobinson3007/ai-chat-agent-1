import { createFileRoute } from '@tanstack/react-router'

import { AgentsGrid } from '@/features/agents/components/AgentsGrid'

export const Route = createFileRoute('/_authenticated/')({
  component: AgentsGrid,
})
