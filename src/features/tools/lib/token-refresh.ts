import { google } from 'googleapis'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/db'
import { toolConnections } from '@/database/schema'

export async function refreshHubSpotToken(refreshToken: string) {
  console.log('🔄 Refreshing HubSpot token...')
  
  const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      refresh_token: refreshToken
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('HubSpot token refresh failed:', response.status, errorText)
    throw new Error(`Failed to refresh HubSpot token: ${response.status}`)
  }
  
  const tokens = await response.json()
  console.log('✅ HubSpot token refreshed successfully')
  
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in
  }
}

export async function refreshGoogleToken(refreshToken: string) {
  console.log('🔄 Refreshing Google token...')
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  
  try {
    const { credentials } = await oauth2Client.refreshAccessToken()
    console.log('✅ Google token refreshed successfully')
    
    return {
      access_token: credentials.access_token!,
      refresh_token: credentials.refresh_token || refreshToken,
      expires_in: credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600
    }
  } catch (error) {
    console.error('Google token refresh failed:', error)
    throw new Error(`Failed to refresh Google token: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function updateConnectionTokens(
  connectionId: string, 
  tokens: { access_token: string; refresh_token: string; expires_in: number }
) {
  console.log(`💾 Updating tokens for connection ${connectionId}`)
  
  await db
    .update(toolConnections)
    .set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      updatedAt: new Date()
    })
    .where(eq(toolConnections.id, connectionId))
  
  console.log('✅ Connection tokens updated in database')
}

export async function getConnection(connectionId: string) {
  const [connection] = await db
    .select()
    .from(toolConnections)
    .where(eq(toolConnections.id, connectionId))
  
  if (!connection || !connection.isActive) {
    throw new Error('Connection not found or inactive')
  }
  
  return connection
}

export async function ensureValidToken(connectionId: string, provider: 'hubspot' | 'google_calendar') {
  const connection = await getConnection(connectionId)
  
  // Check if token expires within next 5 minutes (300 seconds buffer)
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
  
  if (connection.expiresAt && connection.expiresAt < fiveMinutesFromNow) {
    console.log(`🕐 Token for ${connection.displayName} expires soon, refreshing...`)
    
    if (!connection.refreshToken) {
      throw new Error(`No refresh token available for ${connection.displayName} - please reconnect`)
    }
    
    let newTokens
    switch (provider) {
      case 'hubspot':
        newTokens = await refreshHubSpotToken(connection.refreshToken)
        break
      case 'google_calendar':
        newTokens = await refreshGoogleToken(connection.refreshToken)
        break
      default:
        throw new Error(`Unknown provider: ${provider}`)
    }
    
    await updateConnectionTokens(connectionId, newTokens)
    
    // Return updated connection
    return await getConnection(connectionId)
  }
  
  console.log(`✅ Token for ${connection.displayName} is still valid`)
  return connection
}