import { Mastra } from '@mastra/core'
import { Agent } from '@mastra/core'
import { openai } from '@ai-sdk/openai'

// Create a chat agent
const chatDemoAgent = new Agent({
  name: 'chat-demo-agent',
  description: 'A helpful chat assistant for demonstrating Mastra + AI SDK integration',
  model: openai('gpt-4o-mini'),
  instructions: `You are a helpful and friendly assistant. You're part of a demo application 
  showcasing Mastra agent orchestration with AI SDK and AI Elements UI components.
  Keep your responses concise and helpful.`,
})

// Initialize Mastra with agents configuration
export const mastra = new Mastra({
  agents: {
    'chat-demo-agent': chatDemoAgent
  }
})