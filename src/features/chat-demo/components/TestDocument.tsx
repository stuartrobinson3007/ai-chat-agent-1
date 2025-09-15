import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/taali/components/ui/button'
import { Input } from '@/taali/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/taali/components/ui/card'
import { testDocumentProcessing } from '../lib/test-document.server'

export function TestDocument() {
  const [message, setMessage] = useState('Hello from test function!')

  // Following exact Taali pattern from standalone app
  const testMutation = useMutation({
    mutationFn: testDocumentProcessing,
    onSuccess: (result) => {
      console.log('✅ Test success:', result)
    },
    onError: (error) => {
      console.error('❌ Test error:', error)
    },
  })

  const handleTest = () => {
    testMutation.mutate({
      data: {
        message,
        fileName: 'test.txt'
      }
    })
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Test Server Function</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input 
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Test message"
        />
        
        <Button 
          onClick={handleTest}
          disabled={testMutation.isPending}
          className="w-full"
        >
          {testMutation.isPending ? 'Testing...' : 'Test Server Function'}
        </Button>

        {testMutation.isError && (
          <p className="text-sm text-destructive">
            Error: {testMutation.error?.message}
          </p>
        )}

        {testMutation.isSuccess && (
          <div className="text-sm text-green-600">
            <p>✅ Success!</p>
            <pre className="text-xs bg-green-50 p-2 rounded mt-2">
              {JSON.stringify(testMutation.data, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}