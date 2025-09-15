'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Alert, AlertDescription } from '@/taali/components/ui/alert'
import { AlertCircle, Link } from 'lucide-react'
import { getToolConnections, disconnectTool } from '../lib/tool-connections.server'
import { AddConnectionDialog } from './AddConnectionDialog'
import { ConnectionCard } from './ConnectionCard'

export function ToolConnectionManager() {
  const queryClient = useQueryClient()
  const [editingConnection, setEditingConnection] = useState<any>(null)
  
  const { data: connections = [], isLoading, error } = useQuery({
    queryKey: ['tool-connections'],
    queryFn: () => getToolConnections()
  })
  
  const disconnectMutation = useMutation({
    mutationFn: (connectionId: string) => disconnectTool({ connectionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-connections'] })
    },
    onError: (error) => {
      console.error('Failed to disconnect tool:', error)
    }
  })
  
  const handleConnectionAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['tool-connections'] })
  }
  
  const handleEdit = (connection: any) => {
    setEditingConnection(connection)
    // TODO: Implement edit dialog
  }
  
  const handleDisconnect = (connectionId: string) => {
    disconnectMutation.mutate(connectionId)
  }
  
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading connections...</p>
      </div>
    )
  }
  
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load connections. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    )
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Your Connections</h2>
          <p className="text-muted-foreground text-sm">
            Connect multiple accounts per service for your agents to use
          </p>
        </div>
        <AddConnectionDialog onConnectionAdded={handleConnectionAdded} />
      </div>
      
      {connections.length === 0 ? (
        <div className="text-center py-12">
          <Link className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No connections yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Connect external services like Google Calendar and HubSpot to enable your agents to take actions.
          </p>
          <AddConnectionDialog onConnectionAdded={handleConnectionAdded} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {connections.map(connection => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              onEdit={handleEdit}
              onDisconnect={handleDisconnect}
            />
          ))}
        </div>
      )}
    </div>
  )
}