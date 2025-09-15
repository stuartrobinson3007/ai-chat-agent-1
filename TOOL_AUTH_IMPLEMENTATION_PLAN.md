# Tool Authorization Implementation Plan

## Overview
Implementation of workspace-level tool authorization for the multi-tenant agent system, allowing organizations to connect external services (Google Calendar, HubSpot) that agents can use.

## Architecture Decision: Direct API Integration with Mastra

### Why Direct API over MCP
- **Mastra Native**: Uses Mastra's `createTool` pattern already proven with vectorQueryTool
- **Production Ready**: More mature than beta MCP implementations
- **Better Control**: Direct OAuth token management at workspace level
- **Multi-tenant Focus**: Designed for SaaS, not local AI assistants

### Why Not Better Auth's OAuth
- Better Auth's OAuth is user-centric (requires userId for accounts)
- Cannot store workspace-level credentials without a user
- Complex to fight against the framework's intended use case

## Database Schema

```sql
-- Workspace-level tool connections
CREATE TABLE tool_connections (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  organization_id TEXT REFERENCES organization(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'google_calendar', 'hubspot', etc
  name TEXT NOT NULL, -- Display name like "Sales Calendar"
  account_email TEXT, -- For display (e.g., sales@company.com)
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

-- Index for quick lookups
CREATE INDEX idx_tool_connections_org_provider 
  ON tool_connections(organization_id, provider);

-- Audit log for compliance
CREATE TABLE tool_connection_audit (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  connection_id TEXT REFERENCES tool_connections(id),
  organization_id TEXT REFERENCES organization(id),
  action TEXT NOT NULL, -- 'connected', 'disconnected', 'refreshed', 'used'
  performed_by TEXT REFERENCES user(id),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Implementation Components

### 1. Encryption Layer
```typescript
// src/lib/encryption/tool-credentials.ts
import crypto from 'crypto'

const algorithm = 'aes-256-gcm'
const secretKey = process.env.TOOL_ENCRYPTION_KEY! // 32-byte key

export function encryptToken(token: string): string {
  // Implementation for AES-256-GCM encryption
}

export function decryptToken(encrypted: string): string {
  // Implementation for AES-256-GCM decryption
}
```

### 2. OAuth Handlers

#### Google Calendar OAuth
```typescript
// src/features/tools/lib/google-oauth.ts
import { google } from 'googleapis'

export async function initiateGoogleOAuth(organizationId: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.BASE_URL}/api/tools/google/callback`
  )
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    state: organizationId // Track which org is connecting
  })
  
  return authUrl
}

export async function handleGoogleCallback(code: string, organizationId: string) {
  // Exchange code for tokens
  // Store encrypted tokens in tool_connections
  // Return connection details
}
```

#### HubSpot Configuration
```typescript
// src/features/tools/lib/hubspot-setup.ts
import { Client } from '@hubspot/api-client'

export async function connectHubSpot(
  organizationId: string, 
  privateAppToken: string
) {
  // Validate token
  const hubspot = new Client({ accessToken: privateAppToken })
  const { user } = await hubspot.oauth.accessTokensApi.get(privateAppToken)
  
  // Store encrypted token
  await createToolConnection({
    organizationId,
    provider: 'hubspot',
    accessToken: encryptToken(privateAppToken),
    accountEmail: user.email,
    metadata: { hubId: user.hubId }
  })
}
```

### 3. Mastra Tool Implementations

```typescript
// src/features/tools/lib/calendar-tool.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { google } from 'googleapis'

export function createGoogleCalendarTool(connectionId: string) {
  return createTool({
    id: 'google-calendar-book',
    description: 'Books meetings on the workspace Google Calendar',
    inputSchema: z.object({
      title: z.string(),
      attendeeEmail: z.string().email(),
      startTime: z.string().datetime(),
      duration: z.number().min(15).max(480),
      description: z.string().optional(),
      meetingLink: z.boolean().default(true)
    }),
    outputSchema: z.object({
      eventId: z.string(),
      eventLink: z.string(),
      meetingLink: z.string().optional()
    }),
    execute: async ({ input }) => {
      // Get connection and decrypt tokens
      const connection = await getToolConnection(connectionId)
      const accessToken = decryptToken(connection.accessToken)
      
      // Check token expiry and refresh if needed
      if (connection.expiresAt < new Date()) {
        accessToken = await refreshGoogleToken(connection)
      }
      
      // Create calendar event
      const oauth2Client = new google.auth.OAuth2()
      oauth2Client.setCredentials({ access_token: accessToken })
      
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
      
      const event = await calendar.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: input.meetingLink ? 1 : 0,
        requestBody: {
          summary: input.title,
          description: input.description,
          start: {
            dateTime: input.startTime,
            timeZone: 'UTC'
          },
          end: {
            dateTime: new Date(
              new Date(input.startTime).getTime() + input.duration * 60000
            ).toISOString(),
            timeZone: 'UTC'
          },
          attendees: [{ email: input.attendeeEmail }],
          conferenceData: input.meetingLink ? {
            createRequest: {
              requestId: `meet-${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' }
            }
          } : undefined
        }
      })
      
      // Log usage for audit
      await logToolUsage(connectionId, 'calendar_event_created', {
        eventId: event.data.id
      })
      
      return {
        eventId: event.data.id!,
        eventLink: event.data.htmlLink!,
        meetingLink: event.data.conferenceData?.entryPoints?.[0]?.uri
      }
    }
  })
}
```

```typescript
// src/features/tools/lib/hubspot-tool.ts
export function createHubSpotContactTool(connectionId: string) {
  return createTool({
    id: 'hubspot-create-contact',
    description: 'Creates a new contact in HubSpot CRM',
    inputSchema: z.object({
      email: z.string().email(),
      firstName: z.string(),
      lastName: z.string().optional(),
      company: z.string().optional(),
      phone: z.string().optional(),
      lifecycleStage: z.enum(['lead', 'marketingqualifiedlead', 'salesqualifiedlead']).default('lead')
    }),
    outputSchema: z.object({
      contactId: z.string(),
      portalUrl: z.string()
    }),
    execute: async ({ input }) => {
      const connection = await getToolConnection(connectionId)
      const accessToken = decryptToken(connection.accessToken)
      
      const hubspot = new Client({ accessToken })
      
      const contact = await hubspot.crm.contacts.basicApi.create({
        properties: {
          email: input.email,
          firstname: input.firstName,
          lastname: input.lastName,
          company: input.company,
          phone: input.phone,
          lifecyclestage: input.lifecycleStage
        }
      })
      
      await logToolUsage(connectionId, 'contact_created', {
        contactId: contact.id
      })
      
      return {
        contactId: contact.id,
        portalUrl: `https://app.hubspot.com/contacts/${connection.metadata.hubId}/contact/${contact.id}`
      }
    }
  })
}
```

### 4. Dynamic Agent Creation

```typescript
// src/features/agents/lib/dynamic-agent-factory.ts
import { Agent } from '@mastra/core'
import { openai } from '@ai-sdk/openai'

export async function createDynamicAgent(
  config: AgentConfig,
  organizationId: string
) {
  // Get workspace's connected tools
  const connections = await db
    .select()
    .from(toolConnections)
    .where(
      and(
        eq(toolConnections.organizationId, organizationId),
        eq(toolConnections.isActive, true)
      )
    )
  
  // Build tools object dynamically
  const tools: Record<string, any> = {
    // Always include document search
    vectorQueryTool: createVectorQueryTool({
      vectorStoreName: 'pgVector',
      indexName: 'document_embeddings',
      model: openai.embedding('text-embedding-3-small'),
      // Filter by organization's documents
      filter: { organizationId }
    })
  }
  
  // Add connected external tools
  for (const connection of connections) {
    switch (connection.provider) {
      case 'google_calendar':
        tools.bookMeeting = createGoogleCalendarTool(connection.id)
        break
      case 'hubspot':
        tools.createContact = createHubSpotContactTool(connection.id)
        tools.updateLead = createHubSpotLeadTool(connection.id)
        break
    }
  }
  
  // Create agent with available tools
  return new Agent({
    name: config.name,
    description: config.description,
    model: openai('gpt-4o-mini'),
    instructions: config.instructions,
    tools
  })
}
```

### 5. Server Functions

```typescript
// src/features/tools/lib/tools.server.ts
import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { requireRole } from '@/lib/auth/role-middleware'

export const connectGoogleCalendar = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, requireRole(['owner', 'admin'])])
  .handler(async ({ context }) => {
    const authUrl = await initiateGoogleOAuth(context.organizationId!)
    return { authUrl }
  })

export const disconnectTool = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, requireRole(['owner', 'admin'])])
  .validator(z.object({ connectionId: z.string() }))
  .handler(async ({ data, context }) => {
    // Verify connection belongs to organization
    const connection = await getToolConnection(data.connectionId)
    if (connection.organizationId !== context.organizationId) {
      throw new Error('Unauthorized')
    }
    
    // Soft delete
    await db
      .update(toolConnections)
      .set({ isActive: false })
      .where(eq(toolConnections.id, data.connectionId))
    
    // Audit log
    await logToolUsage(data.connectionId, 'disconnected')
    
    return { success: true }
  })

export const getToolConnections = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const connections = await db
      .select({
        id: toolConnections.id,
        provider: toolConnections.provider,
        name: toolConnections.name,
        accountEmail: toolConnections.accountEmail,
        isActive: toolConnections.isActive,
        connectedBy: user.name,
        createdAt: toolConnections.createdAt
      })
      .from(toolConnections)
      .leftJoin(user, eq(toolConnections.connectedBy, user.id))
      .where(eq(toolConnections.organizationId, context.organizationId!))
    
    return connections
  })
```

## UI Components

### Tool Connection Manager
```tsx
// src/features/tools/components/ToolConnectionManager.tsx
function ToolConnectionManager() {
  const connections = useToolConnections()
  
  return (
    <div className="space-y-6">
      <h2>Connected Tools</h2>
      
      {/* Google Calendar */}
      <ConnectionCard
        provider="google_calendar"
        title="Google Calendar"
        description="Enable agents to book meetings and check availability"
        connection={connections.find(c => c.provider === 'google_calendar')}
        onConnect={connectGoogleCalendar}
        onDisconnect={disconnectTool}
      />
      
      {/* HubSpot */}
      <ConnectionCard
        provider="hubspot"
        title="HubSpot CRM"
        description="Allow agents to create contacts and manage leads"
        connection={connections.find(c => c.provider === 'hubspot')}
        onConnect={connectHubSpot}
        onDisconnect={disconnectTool}
      />
    </div>
  )
}
```

## Security Measures

1. **Token Encryption**: AES-256-GCM for all stored tokens
2. **Token Rotation**: Automatic refresh before expiry
3. **Audit Logging**: All connections, disconnections, and usage
4. **Role-Based Access**: Only admins can manage connections
5. **Workspace Isolation**: Connections scoped to organization
6. **Rate Limiting**: Prevent abuse of external APIs

## Environment Variables

```bash
# Encryption
TOOL_ENCRYPTION_KEY=your-32-byte-encryption-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# HubSpot (if using private app)
HUBSPOT_PRIVATE_APP_TOKEN=your-hubspot-token

# Callback URL
BASE_URL=https://your-app.com
```

## Implementation Timeline

### Phase 1: Infrastructure (Day 1-2)
- [ ] Database migrations
- [ ] Encryption utilities
- [ ] Base server functions
- [ ] Audit logging

### Phase 2: Google Calendar (Day 3)
- [ ] OAuth flow implementation
- [ ] Token refresh logic
- [ ] Calendar tool creation
- [ ] Testing with real calendar

### Phase 3: HubSpot (Day 4)
- [ ] Private app setup
- [ ] Contact/lead tools
- [ ] Error handling
- [ ] Testing with sandbox

### Phase 4: Agent Integration (Day 5)
- [ ] Dynamic tool loading
- [ ] Update agent factory
- [ ] Test with existing agents
- [ ] Handle tool errors gracefully

### Phase 5: UI & Polish (Day 6)
- [ ] Connection manager UI
- [ ] OAuth callback pages
- [ ] Error states
- [ ] Documentation

## Success Metrics

- **Connection Time**: < 30 seconds to connect a tool
- **Token Refresh**: Automatic with no user intervention
- **Tool Response Time**: < 2 seconds for API calls
- **Error Rate**: < 1% for tool executions
- **Audit Coverage**: 100% of tool usage logged

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Token compromise | Encryption at rest, regular rotation |
| API rate limits | Implement caching, rate limiting |
| Service downtime | Graceful degradation, clear error messages |
| Scope creep | Start with MVP (Calendar + HubSpot only) |

## Future Enhancements

1. **More Integrations**: Slack, Salesforce, Jira
2. **Usage Analytics**: Track which tools are most used
3. **Cost Tracking**: Monitor API usage costs
4. **Tool Marketplace**: Let users request new integrations
5. **Custom Tools**: Allow workspace-specific custom tools