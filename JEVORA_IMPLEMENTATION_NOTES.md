# Jevora Implementation Notes

**Status: Exploration & Planning Phase**  
*These are working notes for building Jevora - not a final design document. Ideas and approaches will evolve as we learn.*

## Overview

Jevora is a real-time AI agent framework for chat-based interactions. The goal is to enable businesses to configure goal-driven assistants that can resolve customer requests, perform actions, or escalate to humans — all within a single conversation stream.

### Core Design Principles
- **Speed**: Sub-2s responses, single model call per turn
- **Determinism**: Predictable outcomes (ask user, call tool, finalize)
- **Reliability**: Clear escalation paths and error handling
- **Simplicity**: Natural language configuration, no complex orchestration

## Technology Stack

### Core Libraries
- **Mastra**: TypeScript agent framework for orchestration
- **AI SDK Core**: Structured outputs and tool calling from Vercel
- **AI SDK UI**: React hooks for streaming chat interfaces
- **Zod**: Schema validation for contracts and responses

### Existing Infrastructure (from TanStack app)
- TanStack Router & React Query
- Better Auth for authentication
- PostgreSQL with Drizzle ORM
- Redis for state management
- Stripe for billing
- Taali UI components

## Architecture Components

### 1. Agent Contract System

The contract defines what an agent is and how it behaves:

```typescript
interface JevoraContract {
  meta: {
    name: string
    language: string
    tone: string
  }
  checklist: ChecklistItem[]  // Required facts to collect
  goals: Goal[]               // Information to gather, actions to complete
  tools: string[]            // Allowlist of permitted tools
  policy: Policy             // Max turns, guardrails, escalation rules
}
```

**Contract Compiler**: Converts natural language specifications into structured contracts using AI SDK Core's `generateObject`.

### 2. Runtime Engine

Each user turn follows this cycle:

1. **Build context**: System prompt + contract + state snapshot
2. **LLM call**: Single call using AI SDK Core's `generateObject` for strict JSON
3. **Response types**:
   - `ask_user`: Respond to user, fill checklist
   - `call_tool`: Invoke allowed tool with validated args
   - `finalize`: Close conversation with summary
4. **Update state**: Mark checklist items, log tool results
5. **Enforce policy**: Check max turns, apply guardrails

### 3. Mastra Integration

Mastra provides the orchestration layer:

```typescript
// Dynamic agent creation from contracts
const createJevoraAgent = (contract: JevoraContract) => {
  return mastra.createAgent({
    name: contract.meta.name,
    instructions: buildInstructions(contract),
    model: 'gpt-4',
    tools: contract.tools.map(t => jevoraTools[t]),
    maxSteps: contract.policy.maxTurns
  })
}
```

**Key Mastra Features We'll Use**:
- Built-in tool management with validation
- Memory and context preservation
- Observability and logging
- Error handling and retries
- Progress reporting for long-running tools

### 4. Tool System

Tools are external integrations with strict schemas:

```typescript
const calendarTool = tool({
  description: 'Find or book calendar slots',
  inputSchema: z.object({
    action: z.enum(['find_slots', 'book_slot']),
    // ... additional parameters
  }),
  execute: async (input) => {
    // Integration logic
  }
})
```

**Planned Tools**:
- Calendar (find slots, book appointments)
- CRM (create/update leads)
- Knowledge base (search and retrieve)
- Domain-specific (refunds, order status, outreach)

### 5. UI Components

Using AI SDK UI for streaming chat:

```typescript
const JevoraChat = ({ agentId }) => {
  const { messages, input, handleSubmit, isLoading } = useChat({
    api: '/api/jevora/chat',
    body: { agentId },
    streamMode: 'text'
  })
  
  return <ChatInterface messages={messages} ... />
}
```

## Implementation Phases

### Phase 1: Simple Chat Demo ✅ (Current)
- Basic chat UI with Mastra
- Simple agent without tools
- Learn the libraries

### Phase 2: Add Streaming & Tools
- Implement streaming responses
- Add first tool (e.g., weather)
- Tool call visualization

### Phase 3: Contract System
- Build contract compiler
- Natural language to contract
- Contract validation

### Phase 4: Full Runtime
- Complete runtime engine
- State management
- Policy enforcement

### Phase 5: Production Features
- RAG integration
- Multi-agent handoffs
- Analytics and monitoring

## Database Schema (Planned)

```sql
-- Agent specifications and contracts
CREATE TABLE agent_specifications (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  description TEXT,
  owner_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMP
);

CREATE TABLE agent_contracts (
  id UUID PRIMARY KEY,
  specification_id UUID REFERENCES agent_specifications(id),
  contract_json JSONB,
  version INTEGER,
  created_at TIMESTAMP
);

-- Conversation tracking
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agent_contracts(id),
  user_id UUID REFERENCES users(id),
  state JSONB,
  checklist_progress JSONB,
  started_at TIMESTAMP,
  ended_at TIMESTAMP
);

CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  role VARCHAR(50),
  content TEXT,
  tool_calls JSONB,
  created_at TIMESTAMP
);
```

## Open Questions & Considerations

### Technical Decisions
- Should we use Mastra's workflows for complex multi-step operations?
- How to handle tool timeouts and failures gracefully?
- Best approach for contract versioning?
- Optimal caching strategy for contracts and conversations?

### Product Decisions
- How much control to give users over contracts?
- Should agents be shareable across organizations?
- Pricing model for agent usage?
- How to handle sensitive data in conversations?

### Integration Points
- How deep should Stripe integration go for usage tracking?
- Should we use existing Better Auth roles for agent permissions?
- Can we leverage Taali components for the chat UI?

## Performance Targets

- **Response time**: < 2 seconds for 95% of turns
- **Streaming latency**: < 500ms to first token
- **Tool execution**: < 5 seconds for standard tools
- **Contract compilation**: < 3 seconds
- **Concurrent conversations**: 100+ per instance

## Security Considerations

- Input validation on all user messages
- Tool permission enforcement
- Rate limiting per user/organization
- Audit logging for all tool executions
- Encryption for sensitive conversation data
- PII detection and redaction

## Next Steps

1. **Immediate** (Demo Phase):
   - ✅ Create this notes document
   - Build simple chat demo with Mastra
   - Test basic agent interactions
   - Experiment with streaming

2. **Short Term**:
   - Implement first real tool
   - Design contract schema properly
   - Build contract compiler prototype
   - Create agent builder UI

3. **Medium Term**:
   - Full runtime engine
   - Policy enforcement system
   - Production-ready chat interface
   - Admin dashboard

## Learning Resources

- [Mastra Documentation](https://mastra.ai/docs)
- [AI SDK Documentation](https://ai-sdk.dev/docs)
- [Mastra Examples](https://mastra.ai/examples)
- [AI SDK UI Guide](https://ai-sdk.dev/docs/ai-sdk-ui)

## Notes & Ideas

- Consider using Mastra's eval system for agent quality testing
- Explore Mastra's RAG capabilities for knowledge base integration
- Look into AI SDK's middleware for custom logging
- Think about using AI SDK's `smoothStream` for better UX
- Investigate Mastra's memory types (semantic vs episodic)
- Consider building a playground mode using Mastra's local dev environment

---

*This document is a living reference and will be updated as we learn more about the libraries and refine our approach.*