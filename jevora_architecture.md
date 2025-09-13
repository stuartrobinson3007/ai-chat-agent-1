# Jevora – AI Agent Architecture Summary

## Overview
**Jevora** is a real-time AI agent framework for chat-based interactions. It enables businesses to configure goal-driven assistants that can resolve customer requests, perform actions, or escalate to humans — all within a single conversation stream.

The core design prioritizes **speed, determinism, and reliability**:
- One model call per user turn
- Optional single tool call
- Predictable outcomes (ask user, call tool, finalize)

---

## Architecture Components

### 1. Input & Specification
- **User specification**: free-text description of the agent (e.g. “Gap Selling agent for booking demos”).
- **Compiler**: converts the spec into a **Contract** (schema of goals, checklist items, tools, policies).

### 2. Agent Contract
Defines what the agent is and how it behaves:
- **Meta**: name, language, tone
- **Checklist**: required facts to collect (slots)
- **Goals**: information to gather, actions to complete
- **Tools allowlist**: which external actions are permitted
- **Policy**: max turns, token caps, deny topics, escalation rules

### 3. Runtime Loop
Each user turn runs through this cycle:
1. **Build context**: system prompt + contract + state snapshot
2. **LLM call**: model outputs strict JSON → one of:
   - `ask_user` → respond to user, fill checklist
   - `call_tool` → invoke an allowed tool with schema-validated args
   - `finalize` → close conversation with summary + result
3. **Update state**: mark checklist items complete, log tool results
4. **Enforce policy**: max turns, guardrails, escalation if needed

### 4. Tools
External integrations with strict schemas:
- Calendar: find slots, book slot
- CRM: create or update lead
- Knowledge base: search and retrieve answers
- Domain-specific actions (refund, order status, outreach)

### 5. Policies & Guardrails
- Max turns per conversation
- Allowed/denied topics
- Schema validation for tool calls (repair once then escalate)
- Confidence thresholds for tool use
- Escalation triggers: repeated failure, user requests human

### 6. Memory
- **Short-term**: conversation state (checklist, last messages, tool results)
- **Long-term**: external knowledge bases or DBs, retrieved on demand
- Purpose: keep prompts small and latency low

---

## Admin Experience
- **One text box**: describe what the agent should do
- **Compiler**: generates a contract automatically
- **Optional toggles**: max turns, tone, allowed tools
- **Preview chat**: test the agent live
- **Templates**: Appointment setter, Gap Selling discovery, Support FAQ, Outreach

---

## Key Principles
- Real-time: sub-2s responses, single-agent loop
- Deterministic: bounded actions (ask, call tool, finalize)
- Configurable: agents defined by natural language, compiled to schema
- Extensible: add tools and policies as needed
- Safe: guardrails and clear escalation paths

---

## Jevora Goal
Deliver a framework for building **fast, reliable, configurable AI chat agents** that handle support, sales, and outreach tasks without complex multi-agent orchestration.
