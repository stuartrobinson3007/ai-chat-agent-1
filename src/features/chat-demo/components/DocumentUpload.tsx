import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/taali/components/ui/button'
import { Upload, FileText } from 'lucide-react'
import FileUpload from '@/taali/components/ui/file-upload'
import { processDocument } from '../lib/document-upload.server'

interface DocumentUploadProps {
  onUploadComplete?: (documentId: string) => void
}

export function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error('Please select a file to upload')
      }

      // Use FormData like avatar upload
      const formData = new FormData()
      formData.append('document', selectedFile)
      
      // Use filename as title (remove extension)
      const title = selectedFile.name.replace(/\.[^/.]+$/, '')
      formData.append('title', title)

      // Call server function with FormData (like avatar upload)
      return await processDocument({ data: formData })
    },
    onSuccess: (result) => {
      console.log('✅ Document uploaded and processed:', result.documentId)
      setSelectedFile(null)
      onUploadComplete?.(result.documentId)
    },
    onError: (error) => {
      console.error('❌ Upload failed:', error)
    },
  })

  const handleFileUpload = (file: File) => {
    setSelectedFile(file)
    console.log('📁 File selected:', file.name, file.type)
  }

  const handleProcess = () => {
    if (selectedFile) {
      uploadMutation.mutate()
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Upload Document for RAG</h2>
        <p className="text-muted-foreground">
          Upload documents to the knowledge base for the chat agent to reference
        </p>
      </div>

      <FileUpload
        acceptedFileTypes={['text/plain', 'application/pdf', 'text/markdown']}
        maxSizeInMB={10}
        onUploadComplete={handleFileUpload}
        onUploadError={(error) => console.error('File upload error:', error)}
      />
      
      {selectedFile && (
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Selected: <strong>{selectedFile.name}</strong> ({Math.round(selectedFile.size / 1024)} KB)
          </p>
          
          <Button 
            onClick={handleProcess}
            disabled={uploadMutation.isPending}
            size="lg"
            className="w-full max-w-xs"
          >
            {uploadMutation.isPending ? (
              <>Processing...</>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Process for RAG
              </>
            )}
          </Button>
        </div>
      )}

      {uploadMutation.isError && (
        <div className="text-center">
          <p className="text-sm text-destructive">
            {uploadMutation.error?.message || 'Upload failed'}
          </p>
        </div>
      )}

      {uploadMutation.isSuccess && (
        <div className="text-center">
          <p className="text-sm text-green-600">
            ✅ Document processed successfully! Switch to Chat tab to ask questions about it.
          </p>
        </div>
      )}
    </div>
  )
}