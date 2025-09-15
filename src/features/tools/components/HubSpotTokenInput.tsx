'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/taali/components/ui/button'
import { Input } from '@/taali/components/ui/input'
import { Label } from '@/taali/components/ui/label'
import { Alert, AlertDescription } from '@/taali/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/taali/components/ui/card'
import { CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import { connectHubSpot, testHubSpotConnection } from '../lib/hubspot-setup'

interface HubSpotTokenInputProps {
  onConnect: (connectionId: string) => void
}

export function HubSpotTokenInput({ onConnect }: HubSpotTokenInputProps) {
  const [token, setToken] = useState('')
  const [showInstructions, setShowInstructions] = useState(false)
  
  const testMutation = useMutation({
    mutationFn: (token: string) => testHubSpotConnection({ token }),
    onSuccess: (result) => {
      if (result.valid) {
        // Token is valid, now connect it
        connectMutation.mutate(token)
      }
    }
  })
  
  const connectMutation = useMutation({
    mutationFn: (token: string) => connectHubSpot({ privateAppToken: token }),
    onSuccess: (result) => {
      console.log('HubSpot connected successfully:', result.connection.id)
      setToken('')
      onConnect(result.connection.id)
    },
    onError: (error) => {
      console.error('HubSpot connection failed:', error)
    }
  })
  
  const handleConnect = () => {
    if (!token.trim()) return
    testMutation.mutate(token.trim())
  }
  
  const isLoading = testMutation.isPending || connectMutation.isPending
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Connect HubSpot CRM</h3>
          <p className="text-sm text-muted-foreground">
            Use a private app token to connect your HubSpot account
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setShowInstructions(!showInstructions)}
        >
          {showInstructions ? 'Hide' : 'Show'} Instructions
        </Button>
      </div>
      
      {showInstructions && (
        <Alert>
          <ExternalLink className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p><strong>To get your HubSpot private app token:</strong></p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Go to HubSpot Settings → Integrations → Private Apps</li>
                <li>Click "Create a private app"</li>
                <li>Give it a name (e.g., "AI Agents")</li>
                <li>In Scopes, select: "Read" and "Write" for Contacts</li>
                <li>Create the app and copy the access token</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                The token will be securely encrypted and stored for your organization.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-3">
        <div>
          <Label htmlFor="hubspot-token">HubSpot Private App Token</Label>
          <Input
            id="hubspot-token"
            type="password"
            placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={isLoading}
          />
        </div>
        
        {testMutation.data && !testMutation.data.valid && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Invalid token: {testMutation.data.error}
            </AlertDescription>
          </Alert>
        )}
        
        {testMutation.data && testMutation.data.valid && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Token validated! Account: {testMutation.data.account}
            </AlertDescription>
          </Alert>
        )}
        
        {connectMutation.isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {connectMutation.error?.message || 'Failed to connect HubSpot'}
            </AlertDescription>
          </Alert>
        )}
        
        <Button 
          onClick={handleConnect}
          disabled={!token.trim() || isLoading}
          className="w-full"
        >
          {isLoading ? 'Connecting...' : 'Connect HubSpot'}
        </Button>
      </div>
    </div>
  )
}