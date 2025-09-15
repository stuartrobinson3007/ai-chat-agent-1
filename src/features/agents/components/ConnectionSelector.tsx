'use client'

import { useQuery } from '@tanstack/react-query'
import { Label } from '@/taali/components/ui/label'
import { Checkbox } from '@/taali/components/ui/checkbox'
import { Badge } from '@/taali/components/ui/badge'
import { Button } from '@/taali/components/ui/button'
import { Alert, AlertDescription } from '@/taali/components/ui/alert'
import { Calendar, Building, ExternalLink, Info } from 'lucide-react'
import { getAvailableConnections } from '@/features/tools/lib/connections.server'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { useNavigate } from '@tanstack/react-router'

interface ConnectionSelectorProps {
  selectedConnections: string[]
  onChange: (connectionIds: string[]) => void
}

const getProviderIcon = (provider: string) => {
  switch (provider) {
    case 'google_calendar':
      return <Calendar className="h-4 w-4 text-blue-600" />
    case 'hubspot':
      return <Building className="h-4 w-4 text-orange-600" />
    default:
      return <div className="h-4 w-4" />
  }
}

export function ConnectionSelector({ selectedConnections, onChange }: ConnectionSelectorProps) {
  const navigate = useNavigate()
  const { activeOrganizationId } = useActiveOrganization()
  
  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['available-connections', activeOrganizationId],
    queryFn: () => getAvailableConnections(),
    enabled: !!activeOrganizationId
  })
  
  const handleConnectionToggle = (connectionId: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedConnections, connectionId])
    } else {
      onChange(selectedConnections.filter(id => id !== connectionId))
    }
  }
  
  if (isLoading) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground">Loading connections...</p>
      </div>
    )
  }
  
  if (connections.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p>No connections available. Connect external services first to enable tool usage.</p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate({ to: '/connections' })}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Manage Connections
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }
  
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {connections.map(connection => (
          <div key={connection.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
            <Checkbox 
              id={connection.id}
              checked={selectedConnections.includes(connection.id)}
              onCheckedChange={(checked) => handleConnectionToggle(connection.id, !!checked)}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {getProviderIcon(connection.provider)}
                <Label htmlFor={connection.id} className="font-medium cursor-pointer">
                  {connection.displayName}
                </Label>
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                {connection.description || `${connection.provider} • ${connection.accountEmail}`}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Tool alias: {connection.toolAlias}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {connection.accountEmail}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {selectedConnections.length > 0 && (
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">Selected connections:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedConnections.map(connectionId => {
              const connection = connections.find(c => c.id === connectionId)
              return connection ? (
                <Badge key={connectionId} variant="default" className="text-xs">
                  {connection.toolAlias}
                </Badge>
              ) : null
            })}
          </div>
          <div className="mt-3 p-3 bg-muted/50 rounded text-xs text-muted-foreground">
            <strong>Instructions tip:</strong> Reference these connections by their aliases in your agent instructions.
            <br />
            Example: "Book meetings using {connections.find(c => selectedConnections.includes(c.id) && c.provider === 'google_calendar')?.toolAlias || 'calendar_alias'} and save contacts to {connections.find(c => selectedConnections.includes(c.id) && c.provider === 'hubspot')?.toolAlias || 'crm_alias'}"
          </div>
        </div>
      )}
    </div>
  )
}