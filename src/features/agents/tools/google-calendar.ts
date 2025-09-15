import { createTool } from '@mastra/core/tools'
import { google } from 'googleapis'
import { z } from 'zod'
import { ensureValidToken } from '@/features/tools/lib/token-refresh'

async function getGoogleCalendarClient(connectionId: string) {
  // Proactively ensure token is valid (refreshes if needed)
  const connection = await ensureValidToken(connectionId, 'google_calendar')
  
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: connection.accessToken })
  
  return google.calendar({ version: 'v3', auth: oauth2Client })
}

export function createGoogleCalendarTool(connectionId: string, displayName: string) {
  return createTool({
    id: `google-calendar-${connectionId}`,
    description: `Book meetings and manage calendar events for ${displayName}`,
    inputSchema: z.object({
      action: z.enum(['book_meeting', 'check_availability', 'list_events']).default('book_meeting'),
      title: z.string().min(1, 'Event title is required'),
      attendeeEmail: z.string().email('Valid email address required'),
      startTime: z.string().datetime('Valid ISO datetime required'),
      duration: z.number().min(15).max(480).default(30), // 15 minutes to 8 hours
      description: z.string().optional(),
      meetingLink: z.boolean().default(true)
    }),
    outputSchema: z.object({
      success: z.boolean(),
      eventId: z.string().optional(),
      eventLink: z.string().optional(),
      meetingLink: z.string().optional(),
      message: z.string(),
      data: z.any().optional()
    }),
    execute: async ({ context }) => {
      try {
        const { action, title, attendeeEmail, startTime, duration, description, meetingLink } = context
        const calendar = await getGoogleCalendarClient(connectionId)
        
        switch (action) {
          case 'book_meeting': {
            // Calculate end time
            const endTime = new Date(
              new Date(startTime).getTime() + duration * 60000
            ).toISOString()
            
            // Create the calendar event
            const event = await calendar.events.insert({
              calendarId: 'primary',
              conferenceDataVersion: meetingLink ? 1 : 0,
              requestBody: {
                summary: title,
                description: description,
                start: {
                  dateTime: startTime,
                  timeZone: 'UTC'
                },
                end: {
                  dateTime: endTime,
                  timeZone: 'UTC'
                },
                attendees: [{ email: attendeeEmail }],
                conferenceData: meetingLink ? {
                  createRequest: {
                    requestId: `meet-${Date.now()}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' }
                  }
                } : undefined
              }
            })
            
            return {
              success: true,
              eventId: event.data.id!,
              eventLink: event.data.htmlLink!,
              meetingLink: event.data.conferenceData?.entryPoints?.[0]?.uri,
              message: `Meeting "${title}" booked on ${displayName} for ${new Date(startTime).toLocaleString()}`
            }
          }
          
          case 'check_availability': {
            // Check free/busy status
            const freebusy = await calendar.freebusy.query({
              requestBody: {
                timeMin: startTime,
                timeMax: new Date(new Date(startTime).getTime() + duration * 60000).toISOString(),
                items: [{ id: 'primary' }]
              }
            })
            
            const busy = freebusy.data.calendars?.primary?.busy || []
            const isAvailable = busy.length === 0
            
            return {
              success: true,
              message: `${displayName} is ${isAvailable ? 'available' : 'busy'} at ${new Date(startTime).toLocaleString()}`,
              data: {
                available: isAvailable,
                busyTimes: busy
              }
            }
          }
          
          case 'list_events': {
            // List upcoming events
            const events = await calendar.events.list({
              calendarId: 'primary',
              timeMin: new Date().toISOString(),
              maxResults: 10,
              singleEvents: true,
              orderBy: 'startTime'
            })
            
            return {
              success: true,
              message: `Found ${events.data.items?.length || 0} upcoming events on ${displayName}`,
              data: events.data.items?.map(event => ({
                id: event.id,
                title: event.summary,
                start: event.start?.dateTime,
                end: event.end?.dateTime,
                attendees: event.attendees?.map(a => a.email)
              }))
            }
          }
          
          default:
            throw new Error(`Unknown Google Calendar action: ${action}`)
        }
        
      } catch (error) {
        console.error('Google Calendar tool error:', error)
        
        throw new Error(
          error instanceof Error 
            ? `Google Calendar ${action} failed: ${error.message}`
            : `Google Calendar ${action} failed: Unknown error`
        )
      }
    }
  })
}