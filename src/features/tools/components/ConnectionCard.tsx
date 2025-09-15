'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/taali/components/ui/card'
import { Badge } from '@/taali/components/ui/badge'
import { Button } from '@/taali/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/taali/components/ui/dropdown-menu'
import { Calendar, Building, MoreVertical, Edit, Trash2, CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/taali/utils/date'

interface Connection {
  id: string
  provider: 'google_calendar' | 'hubspot'
  displayName: string
  description?: string
  accountEmail?: string
  isActive: boolean
  createdAt: Date
}

interface ConnectionCardProps {
  connection: Connection
  onEdit: (connection: Connection) => void
  onDisconnect: (connectionId: string) => void
}

const getProviderInfo = (provider: string) => {
  switch (provider) {
    case 'google_calendar':
      return {
        icon: <Calendar className="h-5 w-5 text-blue-600" />,
        label: 'Google Calendar',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200'
      }
    case 'hubspot':
      return {
        icon: <Building className="h-5 w-5 text-orange-600" />,
        label: 'HubSpot CRM',
        bgColor: 'bg-orange-50', 
        borderColor: 'border-orange-200'
      }
    default:
      return {
        icon: <div className="h-5 w-5" />,
        label: provider,
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200'
      }
  }
}

export function ConnectionCard({ connection, onEdit, onDisconnect }: ConnectionCardProps) {
  const providerInfo = getProviderInfo(connection.provider)
  
  return (
    <Card className={`hover:shadow-md transition-shadow ${providerInfo.borderColor} ${providerInfo.bgColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {providerInfo.icon}
            <div>
              <CardTitle className="text-lg">{connection.displayName}</CardTitle>
              <CardDescription className="text-sm">
                {providerInfo.label} • {connection.accountEmail}
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={connection.isActive ? "default" : "secondary"} className="text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {connection.isActive ? 'Active' : 'Inactive'}
            </Badge>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(connection)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDisconnect(connection.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {connection.description && (
          <p className="text-sm text-muted-foreground mt-2">
            {connection.description}
          </p>
        )}
      </CardHeader>
      
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Connected {formatDate(connection.createdAt)}
          </div>
          
          <div className="text-xs text-muted-foreground">
            Tool alias: <code className="bg-muted px-1 py-0.5 rounded text-xs">
              {connection.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}
            </code>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}