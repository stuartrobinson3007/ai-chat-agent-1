import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { eq, and, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/db'
import { agents, agentDocuments, agentConnections, toolConnections } from '@/database/schema'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'

const createAgentSchema = z.object({
  name: z.string().min(1, 'Agent name is required'),
  instructions: z.string().min(10, 'Instructions must be at least 10 characters'),
  selectedConnections: z.array(z.string()).default([]),
  documentIds: z.array(z.string()).optional()
})

const updateAgentSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  instructions: z.string().min(10).optional(),
  selectedConnections: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
})

export const createAgent = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware]) // Includes authMiddleware internally
  .validator(createAgentSchema.parse)
  .handler(async ({ data, context }) => {
    const { name, instructions, selectedConnections, documentIds } = data
    
    console.log('Creating agent:', { name, instructionsLength: instructions.length, selectedConnections, documentIds })
    
    // Create agent record (no selectedTools field anymore)
    const [agent] = await db.insert(agents).values({
      name,
      instructions,
      selectedTools: [], // Empty array for backward compatibility
      organizationId: context.organizationId!,
      createdBy: context.user.id
    }).returning()
    
    console.log('Agent created:', agent.id)
    
    // Link to connections if provided
    if (selectedConnections?.length) {
      // Get connection details to generate aliases
      const connections = await db
        .select()
        .from(toolConnections)
        .where(inArray(toolConnections.id, selectedConnections))
      
      const agentConnectionValues = connections.map(conn => ({
        agentId: agent.id,
        connectionId: conn.id,
        toolAlias: generateToolAlias(conn.displayName)
      }))
      
      await db.insert(agentConnections).values(agentConnectionValues)
      console.log(`Linked ${selectedConnections.length} connections to agent ${agent.id}`)
    }
    
    // Link to documents if provided
    if (documentIds?.length) {
      const agentDocumentValues = documentIds.map(docId => ({
        agentId: agent.id,
        documentId: docId
      }))
      
      await db.insert(agentDocuments).values(agentDocumentValues)
      console.log(`Linked ${documentIds.length} documents to agent ${agent.id}`)
    }
    
    return agent
  })

// Helper function for generating tool aliases
function generateToolAlias(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50)
}

export const getAgents = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const agentList = await db
      .select({
        id: agents.id,
        name: agents.name,
        instructions: agents.instructions,
        selectedTools: agents.selectedTools,
        isActive: agents.isActive,
        createdAt: agents.createdAt,
        updatedAt: agents.updatedAt
      })
      .from(agents)
      .where(
        and(
          eq(agents.organizationId, context.organizationId!),
          eq(agents.isActive, true)
        )
      )
      .orderBy(agents.createdAt)
    
    return agentList
  })

export const getAgent = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const [agent] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.id, data.id),
          eq(agents.organizationId, context.organizationId!)
        )
      )
    
    if (!agent) {
      throw new Error('Agent not found')
    }
    
    // Get linked documents
    const linkedDocuments = await db
      .select({
        documentId: agentDocuments.documentId
      })
      .from(agentDocuments)
      .where(eq(agentDocuments.agentId, agent.id))
    
    // Get linked connections for tool display
    const linkedConnections = await db
      .select({
        connectionId: agentConnections.connectionId,
        toolAlias: agentConnections.toolAlias,
        displayName: toolConnections.displayName,
        provider: toolConnections.provider,
        accountEmail: toolConnections.accountEmail
      })
      .from(agentConnections)
      .innerJoin(toolConnections, eq(agentConnections.connectionId, toolConnections.id))
      .where(eq(agentConnections.agentId, agent.id))
    
    return {
      ...agent,
      documentIds: linkedDocuments.map(d => d.documentId),
      connections: linkedConnections
    }
  })

export const updateAgent = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => updateAgentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { id, selectedConnections, ...updates } = data
    
    console.log('Updating agent:', { id, updates, selectedConnections })
    
    // Verify agent belongs to organization
    const [existingAgent] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.id, id),
          eq(agents.organizationId, context.organizationId!)
        )
      )
    
    if (!existingAgent) {
      throw new Error('Agent not found')
    }
    
    // Update agent basic info
    const [updatedAgent] = await db
      .update(agents)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(agents.id, id))
      .returning()
    
    // Update connections if provided
    if (selectedConnections !== undefined) {
      // Remove existing connections
      await db
        .delete(agentConnections)
        .where(eq(agentConnections.agentId, id))
      
      // Add new connections if any
      if (selectedConnections.length > 0) {
        const connections = await db
          .select()
          .from(toolConnections)
          .where(inArray(toolConnections.id, selectedConnections))
        
        const newAgentConnections = connections.map(conn => ({
          agentId: id,
          connectionId: conn.id,
          toolAlias: generateToolAlias(conn.displayName)
        }))
        
        await db.insert(agentConnections).values(newAgentConnections)
        console.log(`Updated ${selectedConnections.length} connections for agent ${id}`)
      }
      
      // Clear agent cache so it reloads with new connections
      const { clearAgentCache } = await import('./dynamic-agents')
      clearAgentCache(id)
    }
    
    return updatedAgent
  })

export const deleteAgent = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    // Verify agent belongs to organization
    const [existingAgent] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.id, data.id),
          eq(agents.organizationId, context.organizationId!)
        )
      )
    
    if (!existingAgent) {
      throw new Error('Agent not found')
    }
    
    // Soft delete by setting isActive to false
    await db
      .update(agents)
      .set({ 
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(agents.id, data.id))
    
    return { success: true }
  })

export const linkDocumentToAgent = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => z.object({
    agentId: z.string(),
    documentId: z.string()
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { agentId, documentId } = data
    
    // Verify agent belongs to organization
    const [agent] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.id, agentId),
          eq(agents.organizationId, context.organizationId!)
        )
      )
    
    if (!agent) {
      throw new Error('Agent not found')
    }
    
    // Check if already linked
    const [existing] = await db
      .select()
      .from(agentDocuments)
      .where(
        and(
          eq(agentDocuments.agentId, agentId),
          eq(agentDocuments.documentId, documentId)
        )
      )
    
    if (existing) {
      return { success: true, message: 'Document already linked' }
    }
    
    // Create link
    await db.insert(agentDocuments).values({
      agentId,
      documentId
    })
    
    // Auto-add search_docs tool if not present
    if (!agent.selectedTools.includes('search_docs')) {
      await db
        .update(agents)
        .set({
          selectedTools: [...agent.selectedTools, 'search_docs'],
          updatedAt: new Date()
        })
        .where(eq(agents.id, agentId))
    }
    
    return { success: true }
  })