import { google } from 'googleapis'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { connectTool } from './tool-connections.server'

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email'
]

export const initiateGoogleOAuth = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, organizationMiddleware])
  .handler(async ({ context }) => {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.BASE_URL || 'http://localhost:5990'}/api/tools/google/callback`
    )
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_SCOPES,
      state: context.organizationId, // Track which org is connecting
      prompt: 'consent' // Force consent to get refresh token
    })
    
    return { authUrl }
  })

export const handleGoogleCallback = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, organizationMiddleware])
  .validator((data: unknown) => z.object({
    code: z.string(),
    state: z.string() // organizationId
  }).parse(data))
  .handler(async ({ data, context }) => {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.BASE_URL || 'http://localhost:5990'}/api/tools/google/callback`
      )
      
      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(data.code)
      
      if (!tokens.access_token) {
        throw new Error('No access token received from Google')
      }
      
      // Get user info to display account email
      oauth2Client.setCredentials(tokens)
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
      const { data: userInfo } = await oauth2.userinfo.get()
      
      // Store the connection
      const connection = await connectTool({
        provider: 'google_calendar',
        name: `Google Calendar (${userInfo.email})`,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        accountEmail: userInfo.email || undefined,
        scopes: GOOGLE_SCOPES,
        metadata: {
          googleId: userInfo.id,
          picture: userInfo.picture
        }
      })
      
      return { 
        success: true, 
        connection: {
          id: connection.id,
          provider: 'google_calendar',
          accountEmail: userInfo.email
        }
      }
      
    } catch (error) {
      console.error('Google OAuth callback error:', error)
      throw new Error(
        error instanceof Error 
          ? `Failed to connect Google Calendar: ${error.message}`
          : 'Failed to connect Google Calendar'
      )
    }
  })

export async function refreshGoogleToken(connectionId: string): Promise<string> {
  // TODO: Implement token refresh logic
  // This would:
  // 1. Get connection from database
  // 2. Use refresh_token to get new access_token
  // 3. Update database with new tokens
  // 4. Return new access_token
  throw new Error('Token refresh not implemented yet')
}