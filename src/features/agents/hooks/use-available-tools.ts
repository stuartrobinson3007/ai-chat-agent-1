import { useQuery } from '@tanstack/react-query'
import { getActiveConnections } from '@/features/tools/lib/tool-connections.server'

interface ToolInfo {
  id: string
  name: string
  description: string
  requiresConnection?: string
  available: boolean
}

export function useAvailableTools() {
  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['active-connections'],
    queryFn: () => getActiveConnections()
  })
  
  // Define all possible tools
  const allTools: Record<string, Omit<ToolInfo, 'available'>> = {
    search_docs: {
      id: 'search_docs',
      name: 'Search Documents',
      description: 'Search uploaded documents and knowledge base'
    },
    google_calendar: {
      id: 'google_calendar',
      name: 'Google Calendar',
      description: 'Book meetings on Google Calendar',
      requiresConnection: 'google_calendar'
    },
    hubspot_contact: {
      id: 'hubspot_contact',
      name: 'HubSpot Contacts',
      description: 'Create contacts in HubSpot CRM',
      requiresConnection: 'hubspot'
    },
    hubspot_lead: {
      id: 'hubspot_lead',
      name: 'HubSpot Leads',
      description: 'Update lead status in HubSpot',
      requiresConnection: 'hubspot'
    }
  }
  
  // Check which tools are available based on connections
  const availableTools: ToolInfo[] = Object.values(allTools).map(tool => {
    let available = true
    
    if (tool.requiresConnection) {
      // Check if the required connection exists and is active
      available = connections.some(
        conn => conn.provider === tool.requiresConnection && conn.isActive
      )
    }
    
    return {
      ...tool,
      available
    }
  })
  
  return {
    tools: availableTools,
    isLoading,
    connectedProviders: connections.map(c => c.provider)
  }
}