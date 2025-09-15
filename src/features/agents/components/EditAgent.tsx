'use client'

import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/taali/components/ui/button'
import { Input } from '@/taali/components/ui/input'
import { Label } from '@/taali/components/ui/label'
import { Textarea } from '@/taali/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/taali/components/ui/card'
import { Badge } from '@/taali/components/ui/badge'
import { Alert, AlertDescription } from '@/taali/components/ui/alert'
import { ConnectionSelector } from './ConnectionSelector'
import { updateAgent } from '../lib/agents.server'
import { AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'

interface EditAgentProps {
  agent: {
    id: string
    name: string
    instructions: string
    connections?: Array<{
      connectionId: string
      toolAlias: string
      displayName: string
      provider: string
      accountEmail: string | null
    }>
  }
}

export function EditAgent({ agent }: EditAgentProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [name, setName] = useState(agent.name)
  const [instructions, setInstructions] = useState(agent.instructions)
  const [selectedConnections, setSelectedConnections] = useState<string[]>(
    agent.connections?.map(c => c.connectionId) || []
  )
  
  const updateAgentMutation = useMutation({
    mutationFn: async () => {
      return await updateAgent({
        data: {
          id: agent.id,
          name,
          instructions,
          selectedConnections
        }
      })
    },
    onSuccess: () => {
      console.log('Agent updated successfully')
      queryClient.invalidateQueries({ queryKey: ['agent', agent.id] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      navigate({ to: '/' })
    },
    onError: (error) => {
      console.error('Failed to update agent:', error)
    }
  })
  
  const handleSave = () => {
    if (!name || !instructions) return
    updateAgentMutation.mutate()
  }
  
  const hasChanges = 
    name !== agent.name || 
    instructions !== agent.instructions ||
    JSON.stringify(selectedConnections.sort()) !== JSON.stringify((agent.connections?.map(c => c.connectionId) || []).sort())
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <Button 
          variant="outline" 
          onClick={() => navigate({ to: '/' })}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Agents
        </Button>
        
        <h1 className="text-3xl font-bold">Edit Agent</h1>
        <p className="text-muted-foreground mt-2">
          Update your agent's configuration and connections
        </p>
      </div>
      
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Update your agent's name and instructions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Agent Name</Label>
              <Input 
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                rows={8}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Current Connections</CardTitle>
            <CardDescription>
              Currently connected tools for this agent
            </CardDescription>
          </CardHeader>
          <CardContent>
            {agent.connections && agent.connections.length > 0 ? (
              <div className="space-y-2">
                {agent.connections.map(conn => (
                  <div key={conn.connectionId} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">{conn.displayName}</div>
                      <div className="text-sm text-muted-foreground">
                        {conn.provider} • {conn.accountEmail} • Alias: {conn.toolAlias}
                      </div>
                    </div>
                    <Badge variant="secondary">{conn.toolAlias}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No connections selected</p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Update Connections</CardTitle>
            <CardDescription>
              Select which connected services this agent can use
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectionSelector
              selectedConnections={selectedConnections}
              onChange={setSelectedConnections}
            />
          </CardContent>
        </Card>
        
        {updateAgentMutation.isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to update agent: {updateAgentMutation.error?.message || 'Unknown error'}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex justify-end gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate({ to: '/' })}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!name || !instructions || !hasChanges || updateAgentMutation.isPending}
          >
            {updateAgentMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}