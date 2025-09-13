import { createFileRoute } from '@tanstack/react-router'
import { ChatWithElements } from '@/features/chat-demo/components/ChatWithElements'

export const Route = createFileRoute('/_authenticated/chat-demo')({
  component: ChatDemoPage,
})

function ChatDemoPage() {
  return (
    <div className="min-h-screen bg-background">
      <ChatWithElements />
    </div>
  )
}