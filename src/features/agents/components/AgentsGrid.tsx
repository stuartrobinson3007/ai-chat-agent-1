'use client'

import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/taali/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/taali/components/ui/card'
import { Badge } from '@/taali/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/taali/components/ui/dropdown-menu'
import { Bot, MessageSquare, MoreVertical, Plus, Settings } from 'lucide-react'
import { getAgents } from '../lib/agents.server'
import { formatDate } from '@/taali/utils/date'

export function AgentsGrid() {
  const navigate = useNavigate()
  
  const { data: agents = [], isLoading, error } = useQuery({
    queryKey: ['agents'],
    queryFn: () => getAgents()
  })
  
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-16">
          <Bot className="h-16 w-16 text-muted-foreground mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading your agents...</p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-16">
          <p className="text-destructive">Failed to load agents</p>
          <Button variant="outline" onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Your Agents</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage AI agents for your organization
          </p>
        </div>
        <Button onClick={() => navigate({ to: '/agents/new' })} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Create Agent
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map(agent => (
          <Card key={agent.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{agent.name}</CardTitle>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => window.open(`/agents/${agent.id}/chat`, '_blank')}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Open Chat
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate({ to: `/agents/${agent.id}/edit` })}>
                      <Settings className="h-4 w-4 mr-2" />
                      Edit Agent
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <CardDescription className="line-clamp-2">
                {agent.instructions.length > 100 
                  ? `${agent.instructions.slice(0, 100)}...` 
                  : agent.instructions
                }
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {agent.selectedTools.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {agent.selectedTools.map(tool => (
                    <Badge key={tool} variant="secondary" className="text-xs">
                      {tool.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              )}
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => window.open(`/agents/${agent.id}/chat`, '_blank')}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate({ to: `/agents/${agent.id}/edit` })}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="mt-3 text-xs text-muted-foreground">
                Created {formatDate(agent.createdAt)}
              </div>
            </CardContent>
          </Card>
        ))}
        
        {agents.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16">
            <Bot className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No agents yet</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Create your first AI agent to get started. Agents can help with sales, support, research, and more.
            </p>
            <Button onClick={() => navigate({ to: '/agents/new' })} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Agent
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}