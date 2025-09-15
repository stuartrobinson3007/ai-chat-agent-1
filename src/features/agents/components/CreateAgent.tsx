'use client'

import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/taali/components/ui/button'
import { Input } from '@/taali/components/ui/input'
import { Label } from '@/taali/components/ui/label'
import { Textarea } from '@/taali/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/taali/components/ui/card'
import { Badge } from '@/taali/components/ui/badge'
import { Alert, AlertDescription } from '@/taali/components/ui/alert'
import { DocumentUpload } from '@/features/chat-demo/components/DocumentUpload'
import { ConnectionSelector } from './ConnectionSelector'
import { createAgent } from '../lib/agents.server'
import { AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react'

const EXAMPLE_INSTRUCTIONS = `You're a sales agent for Zenergy. Learn about prospects' desires & budget. 

If qualified (budget over $250k):
- Save contact info using hubspot

Always search docs to answer product questions from our documentation.

Be friendly and professional.`

export function CreateAgent() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [selectedConnections, setSelectedConnections] = useState<string[]>([])
  const [uploadedDocuments, setUploadedDocuments] = useState<string[]>([])
  const [pendingDocumentUploads, setPendingDocumentUploads] = useState<Promise<string>[]>([])
  const [isProcessingDocuments, setIsProcessingDocuments] = useState(false)

  const createAgentMutation = useMutation({
    mutationFn: async () => {
      const agentData = {
        name,
        instructions,
        selectedConnections,
        documentIds: uploadedDocuments
      }
      console.log('Creating agent with data:', agentData)
      console.log('📋 Document IDs being passed:', agentData.documentIds)
      return await createAgent({ data: agentData })
    },
    onSuccess: (agent) => {
      console.log('Agent created successfully:', agent.id)
      // Invalidate agents query so new agent shows up immediately
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      navigate({ to: '/' }) // Redirect to agents list
    },
    onError: (error) => {
      console.error('Failed to create agent:', error)
    }
  })

  const handleDocumentUpload = (documentId: string) => {
    console.log('📄 Document uploaded for agent:', documentId)
    setUploadedDocuments([...uploadedDocuments, documentId])
    console.log('📚 Total documents for agent:', uploadedDocuments.length + 1)
  }

  const handleCreateAgent = async () => {
    if (!name || !instructions) return

    // Check if documents are still processing
    if (pendingDocumentUploads.length > 0) {
      setIsProcessingDocuments(true)

      try {
        console.log(`⏳ Waiting for ${pendingDocumentUploads.length} document(s) to finish processing...`)

        // Wait for all document uploads to complete
        const completedDocumentIds = await Promise.all(pendingDocumentUploads)
        console.log('✅ All documents processed:', completedDocumentIds)

        // Update uploaded documents with completed IDs
        setUploadedDocuments(prev => [...prev, ...completedDocumentIds])

        // Clear pending uploads
        setPendingDocumentUploads([])

      } catch (error) {
        console.error('❌ Document processing failed:', error)
        setIsProcessingDocuments(false)
        return
      }

      setIsProcessingDocuments(false)
    }

    // Now create the agent
    createAgentMutation.mutate()
  }

  const useExampleInstructions = () => {
    setInstructions(EXAMPLE_INSTRUCTIONS)
    // Don't auto-select connections since they're user-specific
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create New Agent</h1>
        <p className="text-muted-foreground mt-2">
          Create an AI agent with natural language instructions and connected tools
        </p>
      </div>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Give your agent a name and describe what it should do
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                placeholder="e.g., 'Sales Assistant', 'Support Bot', 'Research Helper'"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="instructions">Instructions</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={useExampleInstructions}
                >
                  Use Example
                </Button>
              </div>
              <Textarea
                id="instructions"
                placeholder="Describe what your agent should do, when to use tools, and how to behave..."
                rows={8}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-2">
                Be specific about when to use tools (e.g., "Use google_calendar to book meetings", "Use search_docs for product questions")
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Knowledge Base</CardTitle>
            <CardDescription>
              Upload documents for your agent to reference during conversations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DocumentUpload onUploadComplete={handleDocumentUpload} />

            {uploadedDocuments.length > 0 && (
              <Alert className="mt-4">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  📄 {uploadedDocuments.length} document(s) uploaded successfully
                  <span className="block mt-1 text-xs">
                    💡 The search_docs tool is always available for document search
                  </span>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connections</CardTitle>
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

        {createAgentMutation.isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to create agent: {createAgentMutation.error?.message || 'Unknown error'}
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
            onClick={handleCreateAgent}
            disabled={!name || !instructions || createAgentMutation.isPending || isProcessingDocuments}
            size="lg"
          >
            {isProcessingDocuments
              ? `Processing ${pendingDocumentUploads.length} document(s)...`
              : createAgentMutation.isPending
                ? 'Creating Agent...'
                : 'Create Agent'
            }
          </Button>
        </div>
      </div>
    </div>
  )
}