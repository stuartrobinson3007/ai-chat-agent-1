import { createServerFileRoute } from '@tanstack/react-start/server'
import { db } from '@/lib/db/db'
import { toolConnections } from '@/database/schema'

const HUBSPOT_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write'
]

export const ServerRoute = createServerFileRoute('/api/tools/hubspot/complete').methods({
  POST: async ({ request }) => {
    try {
      const data = await request.json()
      const { organizationId, displayName, description, tokens, accountInfo } = data
      
      console.log('Completing HubSpot connection:', { organizationId, displayName, accountInfo })
      
      // Store the connection with user-provided name
      const [connection] = await db.insert(toolConnections).values({
        organizationId,
        provider: 'hubspot',
        displayName,
        description: description || null,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        accountEmail: accountInfo.user,
        scopes: HUBSPOT_SCOPES,
        metadata: {
          hubId: accountInfo.hub_id,
          hubDomain: accountInfo.hub_domain,
          tokenType: accountInfo.token_type
        },
        connectedBy: null
      }).returning()
      
      console.log('HubSpot connection stored with name:', connection.displayName)
      
      return Response.json({ 
        success: true,
        connection: {
          id: connection.id,
          displayName: connection.displayName,
          provider: 'hubspot'
        }
      })
      
    } catch (error) {
      console.error('HubSpot connection completion error:', error)
      return Response.json(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      )
    }
  }
})