import { createServerFn } from '@tanstack/react-start'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db/db'
import { toolConnections } from '@/database/schema'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'

// Generate tool alias from display name
function generateToolAlias(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50)
}

export const getAvailableConnections = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, organizationMiddleware])
  .handler(async ({ context }) => {
    const connections = await db
      .select()
      .from(toolConnections)
      .where(
        and(
          eq(toolConnections.organizationId, context.organizationId!),
          eq(toolConnections.isActive, true)
        )
      )
      .orderBy(toolConnections.createdAt)
    
    return connections.map(conn => ({
      ...conn,
      toolAlias: generateToolAlias(conn.displayName)
    }))
  })