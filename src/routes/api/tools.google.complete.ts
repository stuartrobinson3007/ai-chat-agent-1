import { createServerFileRoute } from '@tanstack/react-start/server'
import { db } from '@/lib/db/db'
import { toolConnections } from '@/database/schema'

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email'
]

export const ServerRoute = createServerFileRoute('/api/tools/google/complete').methods({
  POST: async ({ request }) => {
    try {
      const data = await request.json()
      const { organizationId, displayName, description, tokens, userInfo } = data
      
      console.log('Completing Google Calendar connection:', { organizationId, displayName, userInfo })
      
      // Store the connection with user-provided name
      const [connection] = await db.insert(toolConnections).values({
        organizationId,
        provider: 'google_calendar',
        displayName,
        description: description || null,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        accountEmail: userInfo.email,
        scopes: GOOGLE_SCOPES,
        metadata: {
          googleId: userInfo.id,
          picture: userInfo.picture
        },
        connectedBy: null
      }).returning()
      
      console.log('Google Calendar connection stored with name:', connection.displayName)
      
      return Response.json({ 
        success: true,
        connection: {
          id: connection.id,
          displayName: connection.displayName,
          provider: 'google_calendar'
        }
      })
      
    } catch (error) {
      console.error('Google Calendar connection completion error:', error)
      return Response.json(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      )
    }
  }
})