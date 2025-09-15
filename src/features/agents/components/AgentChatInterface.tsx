'use client'

import { useState, useEffect, useRef } from 'react'
import { useChat, UIMessage } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Message, MessageContent } from '@/components/ai-elements/message'
import { Loader } from '@/components/ai-elements/loader'
import { Response } from '@/components/ai-elements/response'
import { Button } from '@/taali/components/ui/button'
import { Input } from '@/taali/components/ui/input'

interface AgentChatInterfaceProps {
  agentId: string
}

export function AgentChatInterface({ agentId }: AgentChatInterfaceProps) {
  const [input, setInput] = useState('')
  const hasInitializedRef = useRef(false)
  
  // Use the agent-specific API endpoint with DefaultChatTransport
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/agents/${agentId}/chat`
    }),
    messages: [] as UIMessage[],
  })
  
  // Send initial message when chat opens - using ref to prevent multiple triggers
  useEffect(() => {
    if (!hasInitializedRef.current && status === 'ready') {
      hasInitializedRef.current = true
      console.log('🤖 Sending initial greeting message...')
      
      // Send a special initial message to trigger agent greeting
      sendMessage({ 
        text: '__INITIAL_GREETING__' // Special marker for initial greeting
      })
    }
  }, [status, sendMessage])

  // Debug logging (same as your ChatWithElements)
  console.log('🎯 Agent chat state:', { 
    agentId,
    messagesCount: messages.length, 
    status, 
    input 
  })
  console.log('📋 Agent messages:', messages)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('📝 Agent form submitted with input:', input)
    if (input.trim() && status === 'ready') {
      console.log('✅ Sending message to agent API')
      sendMessage({ text: input })
      setInput('')
    } else {
      console.log('❌ Cannot send to agent:', { inputEmpty: !input.trim(), status })
    }
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="flex-1 overflow-hidden">
        <Conversation className="h-full">
          <ConversationContent className="pb-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <p className="text-lg mb-2">Start a conversation with your agent</p>
                  <p className="text-sm">This agent can use the tools you've connected and search your knowledge base</p>
                </div>
              </div>
            ) : (
              <>
                {messages
                  .filter(message => 
                    // Hide the initial greeting trigger message
                    !(message.role === 'user' && 
                      message.parts?.some(part => part.text === '__INITIAL_GREETING__'))
                  )
                  .map((message: UIMessage) => (
                  <div key={message.id}>
                    {message.parts?.map((part: any, i: number) => {
                      switch (part.type) {
                        case 'text':
                          return (
                            <Message key={`${message.id}-${i}`} from={message.role}>
                              <MessageContent>
                                {message.role === 'assistant' ? (
                                  <Response>
                                    {part.text}
                                  </Response>
                                ) : (
                                  part.text
                                )}
                              </MessageContent>
                            </Message>
                          )
                        case 'tool-call':
                          return (
                            <div key={`${message.id}-${i}`} className="my-2 p-3 bg-muted/50 rounded-lg">
                              <div className="text-xs text-muted-foreground mb-1">
                                🔧 Using tool: {part.toolName}
                              </div>
                              <div className="text-sm">
                                {part.args ? JSON.stringify(part.args, null, 2) : 'Executing...'}
                              </div>
                            </div>
                          )
                        case 'tool-result':
                          return (
                            <div key={`${message.id}-${i}`} className="my-2 p-3 bg-green-50 rounded-lg border border-green-200">
                              <div className="text-xs text-green-700 mb-1">
                                ✅ Tool result: {part.toolCallId}
                              </div>
                              <div className="text-sm text-green-800">
                                {typeof part.result === 'object' 
                                  ? JSON.stringify(part.result, null, 2)
                                  : part.result
                                }
                              </div>
                            </div>
                          )
                        default:
                          return null
                      }
                    })}
                  </div>
                ))}
                {status === 'streaming' && (
                  <Message from="assistant">
                    <MessageContent>
                      <Loader />
                    </MessageContent>
                  </Message>
                )}
              </>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      <div className="border-t bg-background p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={status !== 'ready'}
            className="flex-1"
          />
          <Button type="submit" disabled={status !== 'ready' || !input.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  )
}