import { createFileRoute } from '@tanstack/react-router'
import { CreateAgent } from '@/features/agents/components/CreateAgent'

export const Route = createFileRoute('/_authenticated/agents/new')({
  component: CreateAgent,
})