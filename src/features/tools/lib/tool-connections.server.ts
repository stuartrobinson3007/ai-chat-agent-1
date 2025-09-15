import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db/db'
import { toolConnections } from '@/database/schema'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'

const connectToolSchema = z.object({
  provider: z.enum(['google_calendar', 'hubspot']),
  name: z.string().min(1),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  expiresAt: z.date().optional(),
  accountEmail: z.string().email().optional(),
  scopes: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
})

export const connectTool = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, organizationMiddleware])
  .validator((data: unknown) => connectToolSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { 
      provider, 
      name, 
      accessToken, 
      refreshToken, 
      expiresAt, 
      accountEmail, 
      scopes, 
      metadata 
    } = data
    
    console.log('Connecting tool:', { provider, name, accountEmail })
    
    // Check if connection already exists for this provider
    const [existing] = await db
      .select()
      .from(toolConnections)
      .where(
        and(
          eq(toolConnections.organizationId, context.organizationId!),
          eq(toolConnections.provider, provider),
          eq(toolConnections.isActive, true)
        )
      )
    
    if (existing) {
      throw new Error(`${provider} is already connected for this organization`)
    }
    
    // TODO: Encrypt tokens before storing
    // For now, store plaintext (implement encryption later)
    
    const [connection] = await db.insert(toolConnections).values({
      organizationId: context.organizationId!,
      provider,
      name,
      accountEmail,
      accessToken, // TODO: Encrypt this
      refreshToken, // TODO: Encrypt this
      expiresAt,
      scopes: scopes || [],
      metadata: metadata || {},
      connectedBy: context.user.id
    }).returning()
    
    console.log('Tool connected successfully:', connection.id)
    
    return connection
  })

export const getToolConnections = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, organizationMiddleware])
  .handler(async ({ context }) => {
    const connections = await db
      .select({
        id: toolConnections.id,
        provider: toolConnections.provider,
        displayName: toolConnections.displayName,
        description: toolConnections.description,
        accountEmail: toolConnections.accountEmail,
        isActive: toolConnections.isActive,
        createdAt: toolConnections.createdAt,
        // Don't return tokens for security
      })
      .from(toolConnections)
      .where(eq(toolConnections.organizationId, context.organizationId!))
      .orderBy(toolConnections.createdAt)
    
    return connections
  })

export const disconnectTool = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, organizationMiddleware])
  .validator((data: unknown) => z.object({ connectionId: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    // Verify connection belongs to organization
    const [connection] = await db
      .select()
      .from(toolConnections)
      .where(
        and(
          eq(toolConnections.id, data.connectionId),
          eq(toolConnections.organizationId, context.organizationId!)
        )
      )
    
    if (!connection) {
      throw new Error('Connection not found')
    }
    
    // Soft delete by setting isActive to false
    await db
      .update(toolConnections)
      .set({ 
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(toolConnections.id, data.connectionId))
    
    console.log('Tool disconnected:', data.connectionId)
    
    return { success: true }
  })

export const getActiveConnections = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, organizationMiddleware])
  .handler(async ({ context }) => {
    return await db
      .select()
      .from(toolConnections)
      .where(
        and(
          eq(toolConnections.organizationId, context.organizationId!),
          eq(toolConnections.isActive, true)
        )
      )
  })