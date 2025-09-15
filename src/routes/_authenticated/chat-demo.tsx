import { createFileRoute } from '@tanstack/react-router'
import { ChatWithRAG } from '@/features/chat-demo/components/ChatWithRAG'

export const Route = createFileRoute('/_authenticated/chat-demo')({
  component: ChatDemoPage,
})

function ChatDemoPage() {
  return (
    <div className="min-h-screen bg-background">
      <ChatWithRAG />
    </div>
  )
}