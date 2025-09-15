'use client'

import { Label } from '@/taali/components/ui/label'
import { Checkbox } from '@/taali/components/ui/checkbox'
import { Badge } from '@/taali/components/ui/badge'

interface ToolSelectorProps {
  available: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  descriptions: Record<string, string>
}

const TOOL_DESCRIPTIONS = {
  'search_docs': 'Search uploaded documents and knowledge base',
  'google_calendar': 'Book meetings on Google Calendar',
  'hubspot_contact': 'Create contacts in HubSpot CRM',
  'hubspot_lead': 'Update lead status in HubSpot'
}

export function ToolSelector({ available, selected, onChange, descriptions = TOOL_DESCRIPTIONS }: ToolSelectorProps) {
  const handleToolToggle = (toolName: string, checked: boolean) => {
    if (checked) {
      onChange([...selected, toolName])
    } else {
      onChange(selected.filter(t => t !== toolName))
    }
  }
  
  const formatToolName = (toolName: string) => {
    return toolName
      .replace('_', ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
  }
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {available.map(toolName => (
          <div key={toolName} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
            <Checkbox 
              id={toolName}
              checked={selected.includes(toolName)}
              onCheckedChange={(checked) => handleToolToggle(toolName, !!checked)}
            />
            <div className="flex-1">
              <Label htmlFor={toolName} className="font-medium cursor-pointer">
                {formatToolName(toolName)}
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                {descriptions[toolName] || 'No description available'}
              </p>
            </div>
          </div>
        ))}
      </div>
      
      {selected.length > 0 && (
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">Selected tools:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {selected.map(tool => (
              <Badge key={tool} variant="default" className="text-xs">
                {formatToolName(tool)}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}