# Mastra-Based Agent System Implementation Plan

## Overview
Build on your working RAG demo to create a configurable agent system. Users can create agents with natural language instructions and select from available tools (knowledge search, Google Calendar, HubSpot CRM).

## Core Philosophy
**"Instructions + Mastra Tools"**

Your working demo already proves this approach:
- Natural language instructions guide agent behavior
- Mastra's `createTool` and `Agent` class handle execution
- Built-in RAG with document upload already working
- Extend with external tools (Google Calendar, HubSpot)

## Current Working Foundation ✅

### Your Demo Architecture (Already Working)
```typescript
// From your mastra-setup.ts
const chatDemoAgent = new Agent({
  name: 'chat-demo-agent',
  instructions: `You are a helpful assistant with access to uploaded documents.
                 Use vectorQueryTool to search for relevant information.
                 Always cite your sources.`,
  model: openai('gpt-4o-mini'),
  tools: {
    vectorQueryTool  // Built with createVectorQueryTool
  }
})
```

### What You Have Working
✅ **RAG Integration**: Gemini 2.0 Flash + MDocument + PgVector  
✅ **Document Upload**: PDF/TXT/MD processing pipeline  
✅ **Vector Search**: createVectorQueryTool with embeddings  
✅ **Streaming Chat**: AI SDK integration with Mastra  
✅ **UI Components**: DocumentUpload, ChatWithElements, ChatWithRAG

## Agent System Architecture (Building on Your Demo)

### Extended Agent Structure
```typescript
interface AgentConfig {
  name: string
  instructions: string  // Natural language like your current demo
  selectedTools: string[] // Which tools to include
  knowledgeSources: string[] // Document IDs and URLs
}

// Creates Mastra Agent with selected tools
function createConfigurableAgent(config: AgentConfig): Agent {
  const availableTools = {
    vectorQueryTool,      // Your existing RAG
    googleCalendarTool,   // New: Calendar booking
    hubspotContactTool,   // New: CRM integration
    hubspotLeadTool      // New: Lead management
  }
  
  const selectedTools = Object.fromEntries(
    config.selectedTools.map(name => [name, availableTools[name]])
  )
  
  return new Agent({
    name: config.name,
    instructions: config.instructions,
    model: openai('gpt-4o-mini'),
    tools: selectedTools
  })
}
```

## Implementation Phases

### Phase 1: Agent Management System (Day 1)

#### Database Schema (Extends Your Existing)
```sql
-- Agents table (works with your existing documents/embeddings)
CREATE TABLE agents (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  organization_id TEXT REFERENCES organization(id),
  name VARCHAR(255) NOT NULL,
  instructions TEXT NOT NULL,
  selected_tools TEXT[] NOT NULL, -- Which tools this agent can use
  created_by TEXT REFERENCES user(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Link agents to existing documents (reuse your existing documents table)
CREATE TABLE agent_documents (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  agent_id TEXT REFERENCES agents(id),
  document_id TEXT REFERENCES documents(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tool connections (OAuth tokens for external services)
CREATE TABLE tool_connections (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  organization_id TEXT REFERENCES organization(id),
  provider VARCHAR(100) NOT NULL, -- 'google_calendar', 'hubspot'
  name VARCHAR(255) NOT NULL, -- Display name like "Sales Calendar"
  account_email VARCHAR(255), -- For display (e.g., sales@company.com)
  access_token TEXT, -- Encrypted with AES-256
  refresh_token TEXT, -- Encrypted with AES-256
  expires_at TIMESTAMP,
  scopes TEXT[], -- OAuth scopes granted
  metadata JSONB, -- Provider-specific data
  connected_by TEXT REFERENCES user(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Agent Server Functions
```typescript
// src/features/agents/lib/agents.server.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'

const createAgentSchema = z.object({
  name: z.string().min(1),
  instructions: z.string().min(1),
  selectedTools: z.array(z.string()),
  documentIds: z.array(z.string()).optional()
})

export const createAgent = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, organizationMiddleware])
  .validator((data: unknown) => createAgentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { name, instructions, selectedTools, documentIds } = data
    
    // Create agent record
    const [agent] = await db.insert(agents).values({
      name,
      instructions,
      selectedTools,
      organizationId: context.organizationId!,
      createdBy: context.user.id
    }).returning()
    
    // Link to documents if provided
    if (documentIds?.length) {
      await db.insert(agentDocuments).values(
        documentIds.map(docId => ({
          agentId: agent.id,
          documentId: docId
        }))
      )
    }
    
    return agent
  })

export const getAgents = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, organizationMiddleware])
  .handler(async ({ context }) => {
    return await db.select()
      .from(agents)
      .where(eq(agents.organizationId, context.organizationId!))
  })
```

### Phase 2: External Tools (Days 2-3)

#### Google Calendar Tool
```typescript
// src/features/agents/tools/google-calendar.ts
import { createTool } from '@mastra/core/tools'
import { google } from 'googleapis'
import { z } from 'zod'

export const googleCalendarTool = createTool({
  id: "google-calendar-book",
  description: "Books a meeting on user's Google Calendar",
  inputSchema: z.object({
    title: z.string(),
    attendeeEmail: z.string().email(),
    startTime: z.string(), // ISO format
    duration: z.number().default(30) // minutes
  }),
  execute: async ({ context }) => {
    const { title, attendeeEmail, startTime, duration } = context
    
    // Get OAuth client for the user (from agent_connections table)
    const auth = await getGoogleOAuthClient(context.userId)
    const calendar = google.calendar({ version: 'v3', auth })
    
    const endTime = new Date(
      new Date(startTime).getTime() + duration * 60000
    ).toISOString()
    
    const event = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: title,
        start: { dateTime: startTime },
        end: { dateTime: endTime },
        attendees: [{ email: attendeeEmail }],
        conferenceData: {
          createRequest: { requestId: `meet-${Date.now()}` }
        }
      },
      conferenceDataVersion: 1
    })
    
    return {
      eventId: event.data.id,
      eventLink: event.data.htmlLink,
      meetingLink: event.data.conferenceData?.entryPoints?.[0]?.uri,
      success: true
    }
  }
})
```

#### HubSpot CRM Tools
```typescript
// src/features/agents/tools/hubspot-crm.ts
import { createTool } from '@mastra/core/tools'
import { Client } from '@hubspot/api-client'
import { z } from 'zod'

export const hubspotContactTool = createTool({
  id: "hubspot-add-contact",
  description: "Adds a contact to HubSpot CRM",
  inputSchema: z.object({
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string().optional(),
    company: z.string().optional(),
    phone: z.string().optional(),
    notes: z.string().optional()
  }),
  execute: async ({ context }) => {
    const hubspot = new Client({ 
      accessToken: process.env.HUBSPOT_ACCESS_TOKEN 
    })
    
    const contact = await hubspot.crm.contacts.basicApi.create({
      properties: {
        email: context.email,
        firstname: context.firstName,
        lastname: context.lastName,
        company: context.company,
        phone: context.phone,
        notes: context.notes,
        hs_lead_status: 'NEW'
      }
    })
    
    return {
      contactId: contact.id,
      hubspotUrl: `https://app.hubspot.com/contacts/${contact.id}`,
      success: true
    }
  }
})

export const hubspotUpdateLeadTool = createTool({
  id: "hubspot-update-lead",
  description: "Updates lead status in HubSpot",
  inputSchema: z.object({
    email: z.string().email(),
    status: z.enum(['NEW', 'QUALIFIED', 'DEMO_SCHEDULED', 'NURTURE']),
    notes: z.string().optional()
  }),
  execute: async ({ context }) => {
    const hubspot = new Client({ 
      accessToken: process.env.HUBSPOT_ACCESS_TOKEN 
    })
    
    // Search for contact by email first
    const searchResults = await hubspot.crm.contacts.searchApi.doSearch({
      filterGroups: [{
        filters: [{
          propertyName: 'email',
          operator: 'EQ',
          value: context.email
        }]
      }]
    })
    
    if (searchResults.results.length === 0) {
      throw new Error('Contact not found in HubSpot')
    }
    
    const contactId = searchResults.results[0].id
    await hubspot.crm.contacts.basicApi.update(contactId, {
      properties: {
        hs_lead_status: context.status,
        notes: context.notes
      }
    })
    
    return {
      contactId,
      status: context.status,
      success: true
    }
  }
})
```

### Phase 3: Dynamic Agent Creation (Day 4)

#### Dynamic Agent Factory (Extends Your mastra-setup.ts)
```typescript
// src/features/agents/lib/dynamic-agents.ts
import { Agent } from '@mastra/core'
import { openai } from '@ai-sdk/openai'
import { vectorQueryTool } from '@/features/chat-demo/lib/mastra-setup'
import { googleCalendarTool } from '../tools/google-calendar'
import { hubspotContactTool, hubspotUpdateLeadTool } from '../tools/hubspot-crm'

// Available tools registry (extends your existing)
const AVAILABLE_TOOLS = {
  'search_docs': vectorQueryTool,      // Your existing RAG tool
  'google_calendar': googleCalendarTool,
  'hubspot_contact': hubspotContactTool,
  'hubspot_lead': hubspotUpdateLeadTool
}

export function createDynamicAgent(config: AgentConfig): Agent {
  // Build tools object from selected tool names
  const selectedTools = Object.fromEntries(
    config.selectedTools.map(toolName => {
      const tool = AVAILABLE_TOOLS[toolName]
      if (!tool) throw new Error(`Unknown tool: ${toolName}`)
      return [toolName, tool]
    })
  )
  
  return new Agent({
    name: config.name,
    description: `Custom agent: ${config.name}`,
    model: openai('gpt-4o-mini'),
    instructions: config.instructions,
    tools: selectedTools
  })
}

// Agent instance management
const agentInstances = new Map<string, Agent>()

export function getAgentInstance(agentId: string): Agent {
  if (!agentInstances.has(agentId)) {
    const config = await getAgentConfig(agentId)
    const agent = createDynamicAgent(config)
    agentInstances.set(agentId, agent)
  }
  return agentInstances.get(agentId)!
}
```

#### Knowledge Integration (Reuse Your Existing System)
Your existing `vectorQueryTool` and document processing already work perfectly. We just need to:

1. **Link documents to agents** (using `agent_documents` table)
2. **Filter embeddings by agent** (modify your vector tool slightly)
3. **Auto-add search tool** when documents are uploaded

#### Agent-Specific Vector Tool (Modify Your Existing)
```typescript
// Modify your existing vectorQueryTool to be agent-specific
export function createAgentVectorTool(agentId: string) {
  return createVectorQueryTool({
    vectorStoreName: 'pgVector',
    indexName: 'document_embeddings',
    model: openai.embedding('text-embedding-3-small'),
    // Filter by agent's documents only
    filter: { agentId }
  })
}
```

#### Chat API (Extends Your Existing)
```typescript
// src/routes/api/agents/[agentId]/chat.ts  
import { createServerFileRoute } from '@tanstack/react-start/server'
import { getAgentInstance } from '@/features/agents/lib/dynamic-agents'

export const ServerRoute = createServerFileRoute('/api/agents/$agentId/chat').methods({
  POST: async ({ request, params }) => {
    try {
      const { messages } = await request.json()
      const agentId = params.agentId
      
      // Get dynamic agent instance (like your current demo)
      const agent = getAgentInstance(agentId)
      
      // Use same streaming approach as your working demo
      const stream = await agent.streamVNext(messages, {
        format: 'aisdk',
      })
      
      return stream.toUIMessageStreamResponse()
    } catch (error) {
      console.error('Agent chat error:', error)
      return Response.json({ error: 'Failed to process chat request' }, { status: 500 })
    }
  }
})
```

### Phase 4: Agent Management UI (Day 5)

#### Agent Creation (Uses Taali UI)
```tsx
// src/features/agents/components/CreateAgent.tsx
import { DocumentUpload } from '@/features/chat-demo/components/DocumentUpload'
import { useState } from 'react'
import { Button } from '@/taali/components/ui/button'
import { Input } from '@/taali/components/ui/input'
import { Label } from '@/taali/components/ui/label'
import { Textarea } from '@/taali/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/taali/components/ui/card'
import { Badge } from '@/taali/components/ui/badge'
import { Checkbox } from '@/taali/components/ui/checkbox'

function CreateAgent() {
  const [name, setName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [uploadedDocuments, setUploadedDocuments] = useState<string[]>([])
  
  const handleDocumentUpload = (documentId: string) => {
    setUploadedDocuments([...uploadedDocuments, documentId])
    // Auto-suggest adding search tool
    if (!selectedTools.includes('search_docs')) {
      setSelectedTools([...selectedTools, 'search_docs'])
    }
  }
  
  const createAgent = async () => {
    const agent = await createAgentAPI({
      name,
      instructions,
      selectedTools,
      documentIds: uploadedDocuments
    })
    
    navigate(`/agents/${agent.id}`)
  }
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Create New Agent</h1>
      
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Give your agent a name and describe what it should do
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Agent Name</Label>
              <Input 
                id="name"
                placeholder="e.g., 'Sales Assistant', 'Support Bot'"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                placeholder="Describe what your agent should do:

Example: 'You're a sales agent for AcmeSoft. Learn about prospects' company size and budget. If qualified (50+ employees with budget), book a demo using google_calendar. Always save contact info using hubspot_contact. Use search_docs to answer product questions.'"
                rows={8}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Knowledge Base</CardTitle>
            <CardDescription>
              Upload documents for your agent to reference
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Reuse your existing DocumentUpload component */}
            <DocumentUpload onUploadComplete={handleDocumentUpload} />
            
            {uploadedDocuments.length > 0 && (
              <div className="mt-4">
                <Badge variant="secondary">
                  📄 {uploadedDocuments.length} document(s) uploaded
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Available Tools</CardTitle>
            <CardDescription>
              Select which tools this agent can use (based on your connections)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(TOOL_DESCRIPTIONS).map(([toolName, description]) => (
                <div key={toolName} className="flex items-start space-x-3 p-3 border rounded">
                  <Checkbox 
                    id={toolName}
                    checked={selectedTools.includes(toolName)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTools([...selectedTools, toolName])
                      } else {
                        setSelectedTools(selectedTools.filter(t => t !== toolName))
                      }
                    }}
                  />
                  <div className="flex-1">
                    <Label htmlFor={toolName} className="font-medium">
                      {toolName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            {selectedTools.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedTools.map(tool => (
                  <Badge key={tool} variant="default">
                    {tool.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <div className="flex justify-end">
          <Button 
            onClick={createAgent} 
            disabled={!name || !instructions}
            size="lg"
          >
            Create Agent
          </Button>
        </div>
      </div>
    </div>
  )
}
```

#### Agents Homepage (Replaces Todos)
```tsx
// src/routes/_authenticated/index.tsx (replace TodosTablePage)
import { AgentsGrid } from '@/features/agents/components/AgentsGrid'

export const Route = createFileRoute('/_authenticated/')({
  component: AgentsGrid,  // Instead of TodosTablePage
})
```

#### AgentsGrid Component (Uses Taali UI)
```tsx
// src/features/agents/components/AgentsGrid.tsx
import { Button } from '@/taali/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/taali/components/ui/card'
import { Badge } from '@/taali/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/taali/components/ui/dropdown-menu'
import { Bot, Calendar, MessageSquare, MoreVertical, Plus, Settings } from 'lucide-react'

function AgentsGrid() {
  const agents = useAgents()
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Your Agents</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage AI agents for your organization
          </p>
        </div>
        <Button onClick={() => navigate('/agents/new')} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Create Agent
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map(agent => (
          <Card key={agent.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{agent.name}</CardTitle>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => window.open(`/agents/${agent.id}/chat`, '_blank')}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Open Chat
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/agents/${agent.id}/edit`)}>
                      <Settings className="h-4 w-4 mr-2" />
                      Edit Agent
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <CardDescription className="line-clamp-2">
                {agent.instructions.slice(0, 100)}...
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="flex flex-wrap gap-1 mb-4">
                {agent.selectedTools.map(tool => (
                  <Badge key={tool} variant="secondary" className="text-xs">
                    {tool.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => window.open(`/agents/${agent.id}/chat`, '_blank')}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate(`/agents/${agent.id}/edit`)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="mt-3 text-xs text-muted-foreground">
                Created {formatDate(agent.createdAt)}
              </div>
            </CardContent>
          </Card>
        ))}
        
        {agents.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16">
            <Bot className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No agents yet</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Create your first AI agent to get started. Agents can help with sales, support, research, and more.
            </p>
            <Button onClick={() => navigate('/agents/new')} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Agent
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
```

#### Standalone Chat Interface (Clean Version for New Tab)
```tsx
// src/routes/_authenticated/agents/[agentId]/chat.tsx
import { ChatWithElements } from '@/features/chat-demo/components/ChatWithElements'
import { useParams } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle } from '@/taali/components/ui/card'
import { Bot } from 'lucide-react'

function AgentChat() {
  const { agentId } = useParams()
  const agent = useAgent(agentId)
  
  return (
    <div className="h-screen flex flex-col">
      {/* Simple header for context */}
      <div className="border-b p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Bot className="h-5 w-5 text-primary" />
          <div>
            <h1 className="font-semibold">{agent?.name || 'Agent Chat'}</h1>
            <p className="text-sm text-muted-foreground">
              Powered by your connected tools and knowledge
            </p>
          </div>
        </div>
      </div>
      
      {/* Use your existing chat component with agent-specific API */}
      <div className="flex-1">
        <ChatWithElements 
          apiEndpoint={`/api/agents/${agentId}/chat`}
          showToolCalls={true}
          showCitations={true}
        />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/agents/$agentId/chat')({
  component: AgentChat,
})
```

#### Connections Page (Uses Taali UI)
```tsx
// src/routes/_authenticated/connections.tsx
import { ToolConnectionManager } from '@/features/tools/components/ToolConnectionManager'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/taali/components/ui/card'
import { Badge } from '@/taali/components/ui/badge'
import { Button } from '@/taali/components/ui/button'
import { Link, Calendar, Building } from 'lucide-react'

function ConnectionsPage() {
  const connections = useToolConnections()
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Connections</h1>
        <p className="text-muted-foreground mt-2">
          Connect external services that your agents can use to take actions
        </p>
      </div>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Calendar className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle>Google Calendar</CardTitle>
                <CardDescription>
                  Enable agents to book meetings and check availability
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <GoogleCalendarConnection />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building className="h-6 w-6 text-orange-600" />
              <div>
                <CardTitle>HubSpot CRM</CardTitle>
                <CardDescription>
                  Allow agents to create contacts and manage leads
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <HubSpotConnection />
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
        <div className="space-y-2">
          {connections.map(conn => (
            <div key={conn.id} className="flex items-center justify-between p-3 border rounded">
              <div className="flex items-center gap-3">
                <Badge variant={conn.isActive ? "default" : "secondary"}>
                  {conn.provider}
                </Badge>
                <div>
                  <div className="font-medium">{conn.name}</div>
                  <div className="text-sm text-muted-foreground">{conn.accountEmail}</div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => disconnectTool(conn.id)}>
                Disconnect
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/connections')({
  component: ConnectionsPage,
})
```

### Phase 5: Tool Connections System (Days 6-7)

#### Comprehensive Tool Authorization
**See: `TOOL_AUTH_IMPLEMENTATION_PLAN.md` for complete implementation details**

This phase implements workspace-level tool connections using:
- **AES-256 encrypted token storage** for security
- **Organization-scoped connections** (not user-specific)
- **Direct API integration** with Mastra's `createTool` pattern
- **Role-based access control** (only admins can connect tools)

#### Connections Management Page
```tsx
// src/routes/_authenticated/connections.tsx
import { ToolConnectionManager } from '@/features/tools/components/ToolConnectionManager'

export const Route = createFileRoute('/_authenticated/connections')({
  component: () => (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Connections</h1>
      <p className="text-gray-600 mb-8">
        Connect external services that your agents can use to take actions.
      </p>
      <ToolConnectionManager />
    </div>
  ),
})
```

#### Add to Sidebar Navigation
```tsx
// Update your existing sidebar to include:
<SidebarItem 
  to="/connections" 
  icon={<LinkIcon />}
  label="Connections"
/>
```

#### Dynamic Tool Loading (Key Innovation)
```typescript
// Agents automatically get tools based on org's connections
export async function createDynamicAgent(config: AgentConfig, organizationId: string) {
  const connections = await getActiveConnections(organizationId)
  
  const tools = {
    vectorQueryTool, // Always available for knowledge
    ...buildToolsFromConnections(connections) // Dynamic based on what's connected
  }
  
  return new Agent({
    name: config.name,
    instructions: config.instructions,
    model: openai('gpt-4o-mini'),
    tools // Tools available based on workspace connections
  })
}
```

#### Security Features
- **Token encryption** with AES-256-GCM
- **Automatic token refresh** before expiry
- **Role-based connection management** (admin-only)
- **Workspace isolation** (org-scoped tokens)

For complete implementation details including:
- Database schema
- Encryption utilities  
- OAuth callback handlers
- Error handling patterns
- Security measures

**→ See: `TOOL_AUTH_IMPLEMENTATION_PLAN.md`**

## File Structure (Building on Your Existing)
```
src/features/agents/
├── components/
│   ├── AgentCard.tsx
│   ├── AgentsGrid.tsx  
│   ├── CreateAgent.tsx (reuses your DocumentUpload)
│   ├── ServiceConnections.tsx
│   └── ToolSelector.tsx
├── lib/
│   ├── dynamic-agents.ts (extends your mastra-setup)
│   ├── agents.server.ts
│   ├── google-oauth.ts
│   └── hubspot-setup.ts
├── tools/
│   ├── google-calendar.ts
│   └── hubspot-crm.ts
├── hooks/
│   └── use-agents.ts
└── routes/
    ├── new.tsx
    └── [agentId]/
        ├── chat.tsx (clean version for new tab)
        └── edit.tsx

# Reuse existing:
src/features/chat-demo/
├── components/DocumentUpload.tsx ✅
├── components/ChatWithElements.tsx ✅
├── lib/mastra-setup.ts ✅ (extend this)
└── lib/document-upload.server.ts ✅
```

## Key Integration Points

### 1. Replace Homepage
```typescript
// src/routes/_authenticated/index.tsx
// Change from: TodosTablePage
// Change to: AgentsGrid
```

### 2. Extend Your Mastra Setup
```typescript
// Your mastra-setup.ts becomes the foundation
// Add: Dynamic agent creation
// Add: Tool registry with external services
// Keep: All your working RAG integration
```

### 3. Reuse Your Components
- ✅ **DocumentUpload**: Works perfectly as-is
- ✅ **ChatWithElements**: Extend for agent-specific endpoints  
- ✅ **Document processing**: Keep your Gemini + MDocument pipeline

## Environment Variables Needed
```bash
# Google Calendar OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# HubSpot API (private app token)
HUBSPOT_ACCESS_TOKEN=your_hubspot_token

# Base URL for OAuth callbacks
BASE_URL=http://localhost:3000
```

## Complete Sales Agent Example

### Agent Configuration
```json
{
  "name": "B2B Sales Assistant",
  "instructions": "You're a friendly sales agent for AcmeSoft (B2B SaaS platform). Learn about prospects' company size, budget, and timeline. If they're qualified (50+ employees with budget), use google_calendar to book a demo. Always use hubspot_contact to save their information. Use search_docs to answer product questions from our documentation.",
  "selectedTools": ["search_docs", "google_calendar", "hubspot_contact"]
}
```

### Conversation Flow (Mastra Handles This)

**User**: "Hi, I'm interested in your product"

**Agent** (Mastra processes via your instructions): "Great to hear! I'd love to learn more about your company. What's your name and how many employees do you have?"

**User**: "I'm John from TechCorp, we have about 75 employees"

**Agent**: "Nice to meet you, John! TechCorp sounds like a great fit for our platform. Do you have budget allocated for this type of solution?"

**User**: "Yes, we're looking to implement something in Q1"

**Agent**: 
1. *[Mastra calls hubspot_contact tool with extracted info]*
2. *[Mastra calls google_calendar tool to book demo]*

"Perfect! I've added your information to our CRM and booked a demo for you. You should receive a calendar invite shortly for next Tuesday at 2 PM. Is that time good for you?"

### Behind the Scenes (Mastra Magic)
- **Tool Selection**: Mastra reads instructions and decides to call tools
- **Parameter Extraction**: Automatically extracts name, company, size from conversation
- **Tool Execution**: Calls HubSpot to create contact, Google Calendar to book meeting
- **Natural Flow**: No rigid requirements or decision trees - just natural conversation guided by instructions

## Complete Example: Support Agent with Knowledge

### Agent Definition
```json
{
  "name": "Product Support Agent",
  "instructions": "You're a helpful support agent for AcmeCorp's SaaS platform. When users ask questions about our product, always search_docs first to find accurate information from our documentation and knowledge base. If you find relevant information, cite the source. If you can't find an answer in the docs, say so clearly and offer to create a support ticket or escalate to a human agent. Be friendly but professional.",
  "tools": ["search_docs", "create_support_ticket", "escalate_to_human"]
}
```

### Knowledge Sources
- `user_guide.pdf` - Complete user manual (127 chunks)
- `troubleshooting.md` - Common issues and solutions (45 chunks)
- `https://docs.acmecorp.com/api` - API documentation (89 chunks)
- `faq.docx` - Frequently asked questions (23 chunks)

### Example Support Conversation

**User**: "How do I reset my password?"

**System Process**:
1. Agent receives question about password reset
2. Instructions say to search_docs first for product questions
3. Runtime calls: `search_docs({ query: "password reset" })`
4. Finds relevant content from user_guide.pdf
5. Responds with answer and citation

**Agent**: "According to our User Guide, you can reset your password by:

1. Go to the login page
2. Click 'Forgot Password' 
3. Enter your email address
4. Check your email for a reset link
5. Follow the instructions in the email

If you don't receive the email within 5 minutes, check your spam folder.

*Source: User Guide (user_guide.pdf) - 94% relevance*

Is there anything else I can help you with?"

**User**: "The reset email isn't coming through"

**Agent**: *[Runtime automatically calls search_docs("password reset email not received")]* 

"I found troubleshooting steps for this issue. According to our Troubleshooting Guide:

1. Check your spam/junk folder
2. Ensure you're using the correct email address
3. Wait up to 10 minutes (sometimes there's a delay)
4. Make sure your email provider isn't blocking @acmecorp.com

If none of these work, I can create a support ticket for our technical team to manually reset your password.

*Source: Troubleshooting Guide (troubleshooting.md) - 87% relevance*

Would you like me to create a ticket for you?"

**User**: "Yes please create a ticket"

**Agent**: *[Runtime calls create_support_ticket({ issue: "Password reset email not received", user_email: "extracted from conversation", priority: "normal" })]* 

"I've created support ticket #SP-2024-1247 for you. Our technical team will manually reset your password within 2 business hours. You'll receive an email confirmation shortly with your ticket details.

The ticket includes:
- Issue: Password reset email not received  
- Priority: Normal
- Estimated resolution: 2 hours

Is there anything else I can help you with today?"

## Key Benefits

1. **Radical Simplicity**: No contracts, no compilation, no schemas
2. **Instant Updates**: Change instructions, behavior changes immediately
3. **Natural Knowledge Access**: LLM decides when to search based on context
4. **Transparent Citations**: Users see exactly where information comes from
5. **Industry-Standard Pattern**: Follows 2024 Agentic RAG best practices
6. **Quick to Build**: Entire system in 7 days including knowledge integration

## Success Metrics
- Agent creation time: < 1 minute
- Response time: < 2 seconds
- User satisfaction: High (due to natural conversations)
- Development time: 1 week vs months

## Risks & Mitigations
- **Less Deterministic**: Accept this trade-off for simplicity
- **Harder to Debug**: Add conversation logging and replay
- **Instruction Quality**: Provide templates and enhancement tool

## Next Steps After MVP
1. Add conversation history/memory
2. Multi-agent handoffs
3. Analytics dashboard
4. A/B testing different instructions
5. Fine-tuning on successful conversations

## Key Benefits of Mastra-Based Approach

### 1. **Builds on Working Foundation**
- ✅ Your RAG demo already works perfectly
- ✅ Proven document processing (Gemini + MDocument)
- ✅ Vector search with PgVector
- ✅ Streaming chat with AI SDK

### 2. **Native Mastra Patterns**
- Uses `createTool` for external integrations
- Leverages `Agent` class with tools object
- Built-in tool selection and parameter extraction
- Proper streaming and error handling

### 3. **Simple Extension Path**
- Add tools: Create new `createTool` functions
- Add agents: Store instructions + tool selections
- Add integrations: OAuth flows and API clients
- Reuse components: Your existing UI works as-is

### 4. **Industry-Standard Integrations**
- Google Calendar: Official `googleapis` SDK
- HubSpot: Official `@hubspot/api-client` SDK
- Proven OAuth 2.0 and private app patterns
- Rate limiting and error handling built-in

## Updated Implementation Timeline (7 Days Total)

### Core Agent System (Days 1-2)
- **Day 1**: Database schema + agent management server functions
- **Day 2**: AgentsGrid homepage + agent creation UI

### Tool Connections (Days 3-5) 
**→ See: `TOOL_AUTH_IMPLEMENTATION_PLAN.md`**
- **Day 3**: Google Calendar OAuth + tool creation
- **Day 4**: HubSpot private app + CRM tools  
- **Day 5**: Connections management page + dynamic tool loading

### Integration & Polish (Days 6-7)
- **Day 6**: Agent creation with tool selection + testing
- **Day 7**: Standalone chat interface + final polish

## Navigation Updates Needed

### Add Connections to Sidebar
```tsx
// In your existing sidebar navigation:
<SidebarItem to="/" icon={<RobotIcon />} label="Agents" />
<SidebarItem to="/connections" icon={<LinkIcon />} label="Connections" />
<SidebarItem to="/chat-demo" icon={<MessageSquareIcon />} label="Chat Demo" />
// ... existing items
```

## Success Metrics
- **Agent creation**: < 2 minutes (including tool selection)
- **Tool connection**: < 30 seconds per service (OAuth or token)
- **Response time**: < 2 seconds (your demo already achieves this)
- **Tool integration**: Works with real Google/HubSpot accounts
- **Knowledge access**: Leverages your existing RAG pipeline
- **Security**: All tokens encrypted, workspace isolation

## Key Benefits of This Approach

### 1. **Builds on Your Working Demo**
- ✅ RAG system works perfectly (Gemini + MDocument + PgVector)
- ✅ Document upload pipeline proven
- ✅ Streaming chat with AI SDK
- ✅ Existing UI components reusable

### 2. **Enterprise-Ready Tool Connections**
- **Workspace-level**: Tools shared across all agents in organization
- **Secure**: AES-256 encryption + audit logging
- **Admin-controlled**: Only workspace admins can connect services
- **Automatic**: Agents get tools based on what's connected

### 3. **Simple User Experience**
1. **Admin**: Connect Google Calendar + HubSpot in Connections page
2. **User**: Create agent with instructions mentioning when to use tools
3. **Agent**: Automatically has access to connected tools
4. **Chat**: Natural conversation that can book meetings and save contacts

This plan builds on your working foundation while adding the enterprise-grade tool connection system detailed in your `TOOL_AUTH_IMPLEMENTATION_PLAN.md`.