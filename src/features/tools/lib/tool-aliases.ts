/**
 * Utility functions for generating and managing tool aliases from connection display names
 */

export function generateToolAlias(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .substring(0, 50) // Limit length
}

export function validateToolAlias(alias: string): boolean {
  // Check if alias is valid (alphanumeric and underscores only)
  return /^[a-z0-9_]+$/.test(alias) && alias.length > 0 && alias.length <= 50
}

export function createToolDisplayName(provider: string, displayName: string): string {
  const providerLabels = {
    google_calendar: 'Google Calendar',
    hubspot: 'HubSpot CRM'
  }
  
  const providerLabel = providerLabels[provider as keyof typeof providerLabels] || provider
  return `${displayName} (${providerLabel})`
}

export function getToolDescription(provider: string, displayName: string): string {
  switch (provider) {
    case 'google_calendar':
      return `Book meetings and manage calendar events for ${displayName}`
    case 'hubspot':
      return `Manage contacts, leads, and CRM operations for ${displayName}`
    default:
      return `Use ${displayName} for ${provider} operations`
  }
}

// Examples:
// generateToolAlias("CEO Calendar") → "ceo_calendar"  
// generateToolAlias("Sales Team CRM") → "sales_team_crm"
// generateToolAlias("Marketing @ HubSpot") → "marketing_hubspot"