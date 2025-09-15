import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { connectTool } from './tool-connections.server'

const HUBSPOT_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write'
]

export const initiateHubSpotOAuth = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, organizationMiddleware])
  .handler(async ({ context }) => {
    const clientId = process.env.HUBSPOT_CLIENT_ID
    const redirectUri = `${process.env.BASE_URL || 'http://localhost:5990'}/api/tools/hubspot/callback`
    
    if (!clientId) {
      throw new Error('HubSpot OAuth not configured - missing HUBSPOT_CLIENT_ID')
    }
    
    const authUrl = `https://app.hubspot.com/oauth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(HUBSPOT_SCOPES.join(' '))}&` +
      `state=${context.organizationId}`
    
    return { authUrl }
  })

export const handleHubSpotCallback = createServerFn({ method: 'POST' })
  .validator((data: unknown) => z.object({
    code: z.string(),
    state: z.string()
  }).parse(data))
  .handler(async ({ data }) => {
    try {
      const { code, state } = data
      const organizationId = state // state contains the organizationId
      
      // Exchange code for tokens
      const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: process.env.HUBSPOT_CLIENT_ID!,
          client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
          redirect_uri: `${process.env.BASE_URL || 'http://localhost:5990'}/api/tools/hubspot/callback`,
          code
        })
      })
      
      if (!tokenResponse.ok) {
        throw new Error(`HubSpot token exchange failed: ${tokenResponse.status}`)
      }
      
      const tokens = await tokenResponse.json()
      
      // Get account info
      const accountResponse = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + tokens.access_token)
      const accountInfo = await accountResponse.json()
      
      // Store the connection manually since we don't have middleware context
      const { nanoid } = await import('nanoid')
      const connectionId = nanoid()
      
      // TODO: Actually store in database
      console.log('HubSpot OAuth successful:', {
        organizationId,
        accountInfo,
        tokens: { ...tokens, access_token: '[REDACTED]' }
      })
      
      return {
        success: true,
        connection: {
          id: connectionId,
          provider: 'hubspot',
          accountEmail: accountInfo.user
        }
      }
      
    } catch (error) {
      console.error('HubSpot OAuth callback error:', error)
      throw new Error(
        error instanceof Error 
          ? `Failed to connect HubSpot: ${error.message}`
          : 'Failed to connect HubSpot'
      )
    }
  })