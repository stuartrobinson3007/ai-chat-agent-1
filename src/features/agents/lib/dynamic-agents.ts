import { Agent } from '@mastra/core'
import { openai } from '@ai-sdk/openai'
import { createVectorQueryTool } from '@mastra/rag'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db/db'
import { agents, agentConnections, agentDocuments, toolConnections } from '@/database/schema'
import { createGoogleCalendarTool } from '../tools/google-calendar'
import { createHubSpotTool } from '../tools/hubspot-crm'
import { createAgentSearchTool } from '../tools/agent-search'
import { inArray } from 'drizzle-orm'

interface AgentConfig {
  id: string
  name: string
  instructions: string
  organizationId: string
}

// Dynamic tool creation based on specific connections
const createToolsForConnections = async (connectionIds: string[], agentId?: string) => {
  console.log(`🛠️ Creating tools for connections:`, connectionIds, `agentId:`, agentId)
  
  // Create agent-specific document search tool
  let searchTool
  if (agentId) {
    // Get agent's linked document IDs
    const agentDocs = await db
      .select({ documentId: agentDocuments.documentId })
      .from(agentDocuments)
      .where(eq(agentDocuments.agentId, agentId))
    
    const documentIds = agentDocs.map(d => d.documentId)
    console.log(`📚 Agent ${agentId} has access to documents:`, documentIds)
    
    // Create agent-specific search tool that filters by document IDs
    searchTool = createVectorQueryTool({
      vectorStoreName: 'pgVector',
      indexName: 'document_embeddings',
      model: openai.embedding('text-embedding-3-small'),
      // Filter to only search this agent's documents
      filter: (metadata: any) => documentIds.includes(metadata.documentId)
    })
  } else {
    // Fallback to global search
    searchTool = createVectorQueryTool({
      vectorStoreName: 'pgVector',
      indexName: 'document_embeddings',
      model: openai.embedding('text-embedding-3-small')
    })
  }
  
  const tools: Record<string, any> = {
    search_docs: agentId ? createAgentSearchTool(agentId) : searchTool
  }
  
  console.log(`📚 Base tools added:`, Object.keys(tools))
  
  if (connectionIds.length === 0) {
    console.log(`⚠️ No connections provided, returning base tools only`)
    return tools
  }
  
  console.log(`🔍 Querying database for connections...`)
  
  // Get the specific connections for this agent
  const connections = await db
    .select()
    .from(toolConnections)
    .where(
      and(
        eq(toolConnections.isActive, true),
        inArray(toolConnections.id, connectionIds)
      )
    )
  
  console.log(`📋 Connections found in database:`, connections.length, connections.map(c => ({
    id: c.id,
    provider: c.provider,
    displayName: c.displayName,
    isActive: c.isActive
  })))
  
  // Create tools with user-defined aliases
  for (const connection of connections) {
    const alias = generateToolAlias(connection.displayName)
    console.log(`🔧 Creating tool for connection:`, {
      connectionId: connection.id,
      provider: connection.provider,
      displayName: connection.displayName,
      alias
    })
    
    try {
      switch (connection.provider) {
        case 'google_calendar':
          tools[alias] = createGoogleCalendarTool(connection.id, connection.displayName)
          console.log(`✅ Google Calendar tool created: ${alias}`)
          break
        case 'hubspot':
          tools[alias] = createHubSpotTool(connection.id, connection.displayName)
          console.log(`✅ HubSpot tool created: ${alias}`)
          break
        default:
          console.log(`⚠️ Unknown provider: ${connection.provider}`)
      }
    } catch (error) {
      console.error(`❌ Failed to create tool for ${connection.displayName}:`, error)
    }
  }
  
  console.log(`🎯 Final tools object:`, Object.keys(tools))
  
  return tools
}

// Generate safe alias from display name
function generateToolAlias(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50)
}

export async function createDynamicAgent(config: AgentConfig, connectionIds: string[]): Promise<Agent> {
  // Get tools for the specific connections this agent should use
  const tools = await createToolsForConnections(connectionIds, config.id)
  
  return new Agent({
    name: config.name,
    description: `Custom agent: ${config.name}`,
    model: openai('gpt-4o-mini'),
    instructions: `${config.instructions}

IMPORTANT: If you receive the message "__INITIAL_GREETING__", respond with a personalized greeting that introduces yourself based on your role and capabilities. Don't mention the special message, just provide a natural greeting that explains what you can help with.`,
    tools
  })
}

// Agent instance management (similar to your existing mastra setup)
const agentInstances = new Map<string, Agent>()

export async function getAgentInstance(agentId: string): Promise<Agent> {
  console.log(`🤖 Getting agent instance for: ${agentId}`)
  
  if (!agentInstances.has(agentId)) {
    console.log(`📋 Loading agent config from database...`)
    
    // Load agent config from database
    const [agentRecord] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
    
    console.log(`📄 Agent record:`, {
      found: !!agentRecord,
      id: agentRecord?.id,
      name: agentRecord?.name,
      isActive: agentRecord?.isActive,
      instructionsLength: agentRecord?.instructions?.length
    })
    
    if (!agentRecord || !agentRecord.isActive) {
      throw new Error('Agent not found or inactive')
    }
    
    console.log(`🔗 Getting agent's linked connections...`)
    
    // Get agent's linked connections
    const agentConnectionsData = await db
      .select({
        connectionId: agentConnections.connectionId,
        toolAlias: agentConnections.toolAlias,
        displayName: toolConnections.displayName,
        provider: toolConnections.provider
      })
      .from(agentConnections)
      .innerJoin(toolConnections, eq(agentConnections.connectionId, toolConnections.id))
      .where(eq(agentConnections.agentId, agentId))
    
    console.log(`🔧 Agent connections found:`, agentConnectionsData.length, agentConnectionsData)
    
    const connectionIds = agentConnectionsData.map(ac => ac.connectionId)
    console.log(`📝 Connection IDs:`, connectionIds)
    
    const config: AgentConfig = {
      id: agentRecord.id,
      name: agentRecord.name,
      instructions: agentRecord.instructions,
      organizationId: agentRecord.organizationId
    }
    
    console.log(`⚙️ Creating dynamic agent with config:`, {
      name: config.name,
      instructionsLength: config.instructions.length,
      connectionCount: connectionIds.length
    })
    
    const agent = await createDynamicAgent(config, connectionIds)
    
    console.log(`✅ Agent created, tools available:`, Object.keys(agent.tools || {}))
    
    agentInstances.set(agentId, agent)
    
    console.log(`🎯 Agent instance cached. Tools summary:`, 
      agentConnectionsData.map(ac => `${ac.displayName} (${ac.toolAlias})`)
    )
  } else {
    console.log(`💾 Using cached agent instance for ${agentId}`)
  }
  
  const agent = agentInstances.get(agentId)!
  console.log(`🔍 Final agent tools:`, Object.keys(agent.tools || {}))
  
  return agent
}

// Clear cache when agent is updated
export function clearAgentCache(agentId: string) {
  agentInstances.delete(agentId)
}

// Get available connections for organization (for UI)
export async function getAvailableConnectionsForOrg(organizationId: string) {
  const connections = await db
    .select()
    .from(toolConnections)
    .where(
      and(
        eq(toolConnections.organizationId, organizationId),
        eq(toolConnections.isActive, true)
      )
    )
    .orderBy(toolConnections.createdAt)
  
  return connections.map(conn => ({
    ...conn,
    toolAlias: generateToolAlias(conn.displayName)
  }))
}