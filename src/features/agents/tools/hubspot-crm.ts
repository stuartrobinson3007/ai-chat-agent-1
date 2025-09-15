import { createTool } from '@mastra/core/tools'
import { Client } from '@hubspot/api-client'
import { z } from 'zod'
import { ensureValidToken } from '@/features/tools/lib/token-refresh'

async function getHubSpotClient(connectionId: string): Promise<Client> {
  // Proactively ensure token is valid (refreshes if needed)
  const connection = await ensureValidToken(connectionId, 'hubspot')
  return new Client({ accessToken: connection.accessToken })
}

export function createHubSpotTool(connectionId: string, displayName: string) {
  return createTool({
    id: `hubspot-${connectionId}`,
    description: `Manage contacts and leads in ${displayName}`,
    inputSchema: z.object({
      action: z.enum(['create_contact', 'update_lead', 'search_contacts']),
      email: z.string().email('Valid email address required'),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      company: z.string().optional(),
      phone: z.string().optional(),
      status: z.enum([
        'lead',
        'marketingqualifiedlead', 
        'salesqualifiedlead',
        'opportunity',
        'customer'
      ]).optional(),
      notes: z.string().optional(),
      dealAmount: z.number().positive().optional()
    }),
    outputSchema: z.object({
      success: z.boolean(),
      contactId: z.string().optional(),
      hubspotUrl: z.string().optional(),
      message: z.string(),
      data: z.any().optional()
    }),
    execute: async ({ context }) => {
      try {
        const { action, email, firstName, lastName, company, phone, status, notes, dealAmount } = context
        const hubspot = await getHubSpotClient(connectionId)
        
        switch (action) {
          case 'create_contact': {
            if (!firstName) {
              throw new Error('First name is required for creating contacts')
            }
            
            const contact = await hubspot.crm.contacts.basicApi.create({
              properties: {
                email,
                firstname: firstName,
                lastname: lastName || '',
                company: company || '',
                phone: phone || '',
                lifecyclestage: status || 'lead'
                // Removed notes - doesn't exist in all HubSpot accounts
              }
            })
            
            return {
              success: true,
              contactId: contact.id,
              hubspotUrl: `https://app.hubspot.com/contacts/contact/${contact.id}`,
              message: `Created contact for ${firstName} ${lastName || ''} in ${displayName}`
            }
          }
          
          case 'update_lead': {
            if (!status) {
              throw new Error('Status is required for updating leads')
            }
            
            // Search for contact by email
            const searchResults = await hubspot.crm.contacts.searchApi.doSearch({
              filterGroups: [{
                filters: [{
                  propertyName: 'email',
                  operator: 'EQ',
                  value: email
                }]
              }],
              limit: 1
            })
            
            if (searchResults.results.length === 0) {
              throw new Error(`Contact with email ${email} not found in ${displayName}`)
            }
            
            const contactId = searchResults.results[0].id
            const updateProperties: Record<string, string> = {
              lifecyclestage: status
            }
            
            // Notes field removed - doesn't exist in all HubSpot accounts
            
            await hubspot.crm.contacts.basicApi.update(contactId, {
              properties: updateProperties
            })
            
            return {
              success: true,
              contactId,
              hubspotUrl: `https://app.hubspot.com/contacts/contact/${contactId}`,
              message: `Updated ${email} status to ${status} in ${displayName}`
            }
          }
          
          case 'search_contacts': {
            const searchResults = await hubspot.crm.contacts.searchApi.doSearch({
              filterGroups: [{
                filters: [{
                  propertyName: 'email',
                  operator: 'CONTAINS_TOKEN',
                  value: email
                }]
              }],
              properties: ['firstname', 'lastname', 'email', 'company', 'lifecyclestage'],
              limit: 10
            })
            
            return {
              success: true,
              message: `Found ${searchResults.results.length} contacts in ${displayName}`,
              data: searchResults.results.map(contact => ({
                id: contact.id,
                email: contact.properties.email,
                name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim(),
                company: contact.properties.company,
                status: contact.properties.lifecyclestage
              }))
            }
          }
          
          default:
            throw new Error(`Unknown HubSpot action: ${action}`)
        }
        
      } catch (error) {
        console.error('HubSpot tool error:', error)
        
        // Handle specific HubSpot errors
        if (error instanceof Error && error.message.includes('CONTACT_EXISTS')) {
          throw new Error(`Contact with email ${email} already exists in ${displayName}`)
        }
        
        throw new Error(
          error instanceof Error 
            ? `HubSpot operation failed: ${error.message}`
            : `HubSpot operation failed: Unknown error`
        )
      }
    }
  })
}