'use client'

import { useState } from 'react'
import { useChat, UIMessage } from '@ai-sdk/react'
// import { DefaultChatTransport } from 'ai' // Not needed anymore
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

export function ChatWithElements() {
  const [input, setInput] = useState('')
  
  const { messages, sendMessage, status } = useChat({
    messages: [] as UIMessage[],
  })

  // Debug logging
  console.log('🎯 Chat state:', { 
    messagesCount: messages.length, 
    status, 
    input 
  })
  console.log('📋 Messages:', messages)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('📝 Form submitted with input:', input)
    if (input.trim() && status === 'ready') {
      console.log('✅ Sending message to API')
      sendMessage({ text: input })
      setInput('')
    } else {
      console.log('❌ Cannot send:', { inputEmpty: !input.trim(), status })
    }
  }

  // No longer needed - we'll render parts directly inline

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      <div className="flex-1 overflow-hidden">
        <Conversation className="h-full">
          <ConversationContent className="pb-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Start a conversation by typing a message below</p>
              </div>
            ) : (
              <>
                {messages.map((message: UIMessage) => (
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