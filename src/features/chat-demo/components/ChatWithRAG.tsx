'use client'

import { useState } from 'react'
import { ChatWithElements } from './ChatWithElements'
import { DocumentUpload } from './DocumentUpload'
import { TestDocument } from './TestDocument'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/taali/components/ui/tabs'
import { MessageSquare, FileText, TestTube } from 'lucide-react'

export function ChatWithRAG() {
  const [activeTab, setActiveTab] = useState('chat')

  const handleUploadComplete = (documentId: string) => {
    console.log('Document uploaded:', documentId)
    // Switch to chat tab after upload
    setActiveTab('chat')
  }

  return (
    <div className="h-screen max-w-6xl mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="border-b p-4">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="test" className="flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              Test
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documents
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="flex-1 mt-0">
          <div className="h-full">
            <ChatWithElements />
          </div>
        </TabsContent>

        <TabsContent value="test" className="flex-1 mt-0 p-4">
          <div className="flex items-center justify-center h-full">
            <TestDocument />
          </div>
        </TabsContent>

        <TabsContent value="documents" className="flex-1 mt-0 p-4">
          <div className="flex items-center justify-center h-full">
            <DocumentUpload onUploadComplete={handleUploadComplete} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}