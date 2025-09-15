'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/taali/components/ui/dialog'
import { Button } from '@/taali/components/ui/button'
import { Calendar, Building, Plus } from 'lucide-react'
import { initiateGoogleOAuth } from '../lib/google-oauth'
import { initiateHubSpotOAuth } from '../lib/hubspot-setup'

interface ProviderOption {
  id: 'google_calendar' | 'hubspot'
  name: string
  description: string
  icon: React.ReactNode
  color: string
}

const PROVIDERS: ProviderOption[] = [
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Book meetings and check availability',
    icon: <Calendar className="h-8 w-8" />,
    color: 'text-blue-600'
  },
  {
    id: 'hubspot',
    name: 'HubSpot CRM', 
    description: 'Manage contacts and leads',
    icon: <Building className="h-8 w-8" />,
    color: 'text-orange-600'
  }
]

interface AddConnectionDialogProps {
  onConnectionAdded: () => void
}

export function AddConnectionDialog({ onConnectionAdded }: AddConnectionDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  const googleOAuthMutation = useMutation({
    mutationFn: () => initiateGoogleOAuth(),
    onSuccess: (result) => {
      // Open OAuth popup
      const popup = window.open(
        result.authUrl,
        'google_oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      )
      
      // Listen for completion
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'google_oauth_success') {
          popup?.close()
          setIsOpen(false)
          onConnectionAdded()
          window.removeEventListener('message', handleMessage)
        }
      }
      
      window.addEventListener('message', handleMessage)
    }
  })
  
  const hubspotOAuthMutation = useMutation({
    mutationFn: () => initiateHubSpotOAuth(),
    onSuccess: (result) => {
      // Open OAuth popup
      const popup = window.open(
        result.authUrl,
        'hubspot_oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      )
      
      // Listen for completion
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'hubspot_oauth_success') {
          popup?.close()
          setIsOpen(false)
          onConnectionAdded()
          window.removeEventListener('message', handleMessage)
        }
      }
      
      window.addEventListener('message', handleMessage)
    }
  })
  
  const handleConnect = (providerId: 'google_calendar' | 'hubspot') => {
    switch (providerId) {
      case 'google_calendar':
        googleOAuthMutation.mutate()
        break
      case 'hubspot':
        hubspotOAuthMutation.mutate()
        break
    }
  }
  
  const isLoading = googleOAuthMutation.isPending || hubspotOAuthMutation.isPending
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Add Connection
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Connection</DialogTitle>
          <DialogDescription>
            Connect an external service for your agents to use
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 gap-4 py-4">
          {PROVIDERS.map((provider) => (
            <Button
              key={provider.id}
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => handleConnect(provider.id)}
              disabled={isLoading}
            >
              <div className={provider.color}>
                {provider.icon}
              </div>
              <div className="text-center">
                <div className="font-medium">{provider.name}</div>
                <div className="text-xs text-muted-foreground">{provider.description}</div>
              </div>
            </Button>
          ))}
        </div>
        
        {isLoading && (
          <div className="text-center text-sm text-muted-foreground">
            Opening OAuth window...
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}