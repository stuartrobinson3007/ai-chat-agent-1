# Error Handling, Development Workflow & File Management Guide

This document provides comprehensive guidance for implementing error handling systems, development workflows, and file management patterns in the TanStack SaaS starter.

## 🚨 Critical Rules

- **ALWAYS use AppError and ValidationError** - Never throw generic Error instances
- **MUST include error translation keys** - All user-facing errors need i18n support
- **NEVER expose internal errors** - Wrap implementation details in user-friendly messages
- **ALWAYS use error boundaries** - Protect UI from uncaught errors
- **MUST follow file validation patterns** - Validate file types, sizes, and content
- **ALWAYS use standardized data fetching patterns** - Follow error handling standards for consistent UX

## ❌ Common AI Agent Mistakes

### Generic Error Handling
```typescript
// ❌ NEVER use generic errors
throw new Error('Something went wrong')          // Not user-friendly
throw new Error('Database connection failed')   // Exposes internals

// ❌ NEVER skip error context
try {
  await operation()
} catch (error) {
  throw error // Missing context and translation
}

// ✅ ALWAYS use AppError with proper context
import { AppError } from '@/lib/utils/errors'
import { ERROR_CODES } from '@/lib/errors/codes'

throw new AppError(
  ERROR_CODES.BIZ_TODO_NOT_FOUND,
  404,
  { todoId: data.id },
  'Todo not found',
  [{ action: 'goBack', label: 'Go Back' }]
)
```

### Validation Error Violations
```typescript
// ❌ NEVER use generic validation errors
if (!data.title) {
  throw new Error('Title is required') // Wrong
}

// ✅ ALWAYS use ValidationError with translation keys
import { ValidationError } from '@/lib/utils/errors'
import errorTranslations from '@/i18n/locales/en/errors.json'

if (!data.title) {
  throw new ValidationError(
    { title: ['VAL_REQUIRED_FIELD'] },
    errorTranslations.server.validationFailed
  )
}
```

### File Upload Security Violations
```typescript
// ❌ NEVER skip file validation
const file = formData.get('file') as File
await storage.upload(file.name, file) // Security vulnerability!

// ✅ ALWAYS validate files completely
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
const maxSize = 10 * 1024 * 1024 // 10MB

if (!allowedTypes.includes(file.type)) {
  throw new AppError('VAL_INVALID_FILE_TYPE', 400, { allowedTypes })
}

if (file.size > maxSize) {
  throw new AppError('VAL_FILE_TOO_LARGE', 400, { maxSize: maxSize / 1024 / 1024 })
}

const buffer = Buffer.from(await file.arrayBuffer())
const isValid = await ImageProcessor.validateImage(buffer)
if (!isValid) {
  throw new AppError('VAL_INVALID_IMAGE', 400)
}
```

## ✅ Established Patterns

### 1. **Standardized Data Fetching Error Patterns**

The application follows consistent error handling patterns based on data criticality:

#### Table/List Queries
```typescript
// Pattern: useTableQuery with full page ErrorState
import { useTableQuery } from '@/components/taali-ui/data-table'
import { ErrorState } from '@/components/error-state'

const { data, isError, error, isLoading, refetch } = useTableQuery({
  queryKey: ['items'],
  queryFn: getItemsTable,
})

if (isError && error && !isLoading) {
  return <ErrorState error={parseError(error)} onRetry={refetch} />
}
```

#### Critical Single Resources  
```typescript
// Pattern: useResourceQuery with redirect option
import { useResourceQuery } from '@/lib/hooks/use-resource-query'

const { data, isError, error } = useResourceQuery({
  queryKey: ['item', id],
  queryFn: () => getItemById(id),
  redirectOnError: '/' // Optional redirect on failure
})

if (isError && error) {
  return <ErrorState error={parseError(error)} onRetry={refetch} />
}
```

#### Supporting/Secondary Data
```typescript
// Pattern: useSupportingQuery with inline error display
import { useSupportingQuery } from '@/lib/hooks/use-supporting-query'

const { data: stats, showError } = useSupportingQuery({
  queryKey: ['stats'],
  queryFn: getStats,
})

// Graceful degradation in render
{showError ? (
  <ErrorState variant="inline" error={parseError({ message: 'Stats unavailable' })} />
) : (
  <StatsDisplay stats={stats} />
)}
```

#### Form Mutations
```typescript
// Pattern: useFormMutation with field-level error mapping
import { useFormMutation } from '@/lib/hooks/use-form-mutation'

const mutation = useFormMutation({
  mutationFn: createItem,
  setError, // from react-hook-form
  onSuccess: () => showSuccess('Item created')
})
```

### 2. **Error System Architecture**
```typescript
// File: src/lib/utils/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    public context?: any,
    public fallbackMessage?: string,
    public actions?: ErrorAction[]
  ) {
    super(fallbackMessage || code)
    this.name = 'AppError'
  }

  static notFound(resource: string): AppError {
    return new AppError(
      'NOT_FOUND',
      404,
      { resource },
      `${resource} not found`,
      [{ action: 'goBack', label: 'Go Back' }]
    )
  }

  static forbidden(action: string): AppError {
    return new AppError(
      'FORBIDDEN',
      403,
      { action },
      `You don't have permission to ${action}`,
      [{ action: 'login', label: 'Sign In' }]
    )
  }
}

export class ValidationError extends Error {
  constructor(
    public fields: Record<string, string[]>,
    public fallbackMessage: string = 'Validation failed'
  ) {
    super(fallbackMessage)
    this.name = 'ValidationError'
  }
}

export class PermissionError extends Error {
  constructor(message: string, public statusCode: number = 403) {
    super(message)
    this.name = 'PermissionError'
  }
}

export interface ErrorAction {
  action: 'retry' | 'login' | 'upgrade' | 'support' | 'goBack'
  label?: string
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
```

### 2. **Error Boundary Components**
```typescript
// File: src/components/error-boundary.tsx
import React, { Component, ReactNode } from 'react'

import { ErrorFallback } from './error-fallback'

interface Props {
  children: ReactNode
  fallback?: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }>
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // Report error to monitoring service
    // reportError(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || ErrorFallback
      
      return (
        <FallbackComponent
          error={this.state.error!}
          resetErrorBoundary={() => this.setState({ hasError: false, error: null })}
        />
      )
    }

    return this.props.children
  }
}

// File: src/components/error-fallback.tsx
import { useEffect } from 'react'
import { RefreshCw, Home } from 'lucide-react'

import { Button } from '@/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { useTranslation } from '@/i18n/hooks/useTranslation'

interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  const { t } = useTranslation(['errors', 'common'])

  useEffect(() => {
    console.error('Error boundary triggered:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-destructive">
            {t('errors:boundary.title')}
          </CardTitle>
          <CardDescription>
            {t('errors:boundary.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && (
            <div className="p-4 bg-muted rounded-md">
              <pre className="text-xs overflow-auto">
                {error.message}
              </pre>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={resetErrorBoundary} className="flex-1">
              <RefreshCw />
              {t('common:actions.tryAgain')}
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/'} className="flex-1">
              <Home />
              {t('common:actions.goHome')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 3. **Client-Side Error Handler Hook**
```typescript
// File: src/lib/errors/hooks.ts
import { useCallback } from 'react'
import { toast } from 'sonner'

import { parseError, handleErrorAction, type ParsedError } from './client-handler'
import { useTranslation } from '@/i18n/hooks/useTranslation'

export function useErrorHandler() {
  const { t } = useTranslation(['errors', 'notifications'])

  const showError = useCallback((error: unknown) => {
    const parsedError: ParsedError = parseError(error)
    
    // Show user-friendly error message
    toast.error(parsedError.message, {
      description: parsedError.context ? 
        `Error code: ${parsedError.code}` : 
        undefined,
      action: parsedError.actions?.[0] ? {
        label: parsedError.actions[0].label || 'Action',
        onClick: () => handleErrorAction(parsedError.actions![0]),
      } : undefined,
    })

    // Log for debugging
    console.error('Error handled:', parsedError)
  }, [])

  const showSuccess = useCallback(
    (message: string, options?: { action?: { label: string; onClick: () => void } }) => {
      // Check if it's a translation key
      const translatedMessage = message.includes('.') ? t('common:' + message) : message
      
      if (options?.action) {
        toast.success(translatedMessage, {
          action: {
            label: options.action.label,
            onClick: options.action.onClick,
          },
          duration: 10000, // Longer duration for undo actions
        })
      } else {
        toast.success(translatedMessage)
      }
    },
    [t]
  )

  const showInfo = useCallback((message: string) => {
    toast.info(message)
  }, [])

  return {
    showError,
    showSuccess,
    showInfo,
  }
}
```

### 4. **File Management System**
```typescript
// File: src/lib/storage/local-storage-service.ts
import { promises as fs } from 'fs'
import path from 'path'
import { nanoid } from 'nanoid'

export interface FileMetadata {
  userId: string
  originalFilename: string
  uploadedAt: string
  size: number
  mimeType: string
}

export interface UploadResult {
  success: boolean
  url: string
  key: string
  metadata: FileMetadata
}

export class LocalStorageService {
  private baseDir: string

  constructor(baseDir: string = 'storage') {
    this.baseDir = baseDir
  }

  generateAvatarKey(userId: string, extension: string): string {
    const timestamp = Date.now()
    return `avatars/${userId}/avatar-${timestamp}.${extension}`
  }

  async uploadFile(
    key: string,
    buffer: Buffer,
    mimeType: string,
    metadata: Partial<FileMetadata>
  ): Promise<UploadResult> {
    try {
      const fullPath = path.join(process.cwd(), this.baseDir, key)
      const dir = path.dirname(fullPath)

      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true })

      // Write file
      await fs.writeFile(fullPath, buffer)

      // Write metadata
      const metadataPath = `${fullPath}.meta.json`
      const fullMetadata: FileMetadata = {
        userId: metadata.userId!,
        originalFilename: metadata.originalFilename!,
        uploadedAt: new Date().toISOString(),
        size: buffer.length,
        mimeType,
      }
      await fs.writeFile(metadataPath, JSON.stringify(fullMetadata, null, 2))

      const url = `/${this.baseDir}/${key}`

      return {
        success: true,
        url,
        key,
        metadata: fullMetadata,
      }
    } catch (error) {
      console.error('File upload failed:', error)
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const fullPath = path.join(process.cwd(), this.baseDir, key)
      const metadataPath = `${fullPath}.meta.json`

      // Delete file and metadata
      await Promise.all([
        fs.unlink(fullPath).catch(() => {}), // Don't fail if file doesn't exist
        fs.unlink(metadataPath).catch(() => {}),
      ])
    } catch (error) {
      console.error('File deletion failed:', error)
      // Don't throw - deletion failures shouldn't break the flow
    }
  }

  extractKeyFromUrl(url: string): string | null {
    const match = url.match(new RegExp(`/${this.baseDir}/(.+)$`))
    return match ? match[1] : null
  }
}

export function createLocalStorageService(): LocalStorageService {
  return new LocalStorageService()
}
```

### 5. **Image Processing Service**
```typescript
// File: src/lib/storage/image-processor.ts
import sharp from 'sharp'

export interface ProcessedImage {
  buffer: Buffer
  width: number
  height: number
  format: string
  size: number
}

export class ImageProcessor {
  static async validateImage(buffer: Buffer): Promise<boolean> {
    try {
      const metadata = await sharp(buffer).metadata()
      return !!(metadata.width && metadata.height && metadata.format)
    } catch {
      return false
    }
  }

  static async processAvatar(buffer: Buffer): Promise<ProcessedImage> {
    try {
      const processed = await sharp(buffer)
        .resize(200, 200, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({
          quality: 90,
          progressive: true,
        })
        .toBuffer()

      const metadata = await sharp(processed).metadata()

      return {
        buffer: processed,
        width: metadata.width!,
        height: metadata.height!,
        format: metadata.format!,
        size: processed.length,
      }
    } catch (error) {
      throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static async processImage(
    buffer: Buffer,
    options: {
      width?: number
      height?: number
      quality?: number
      format?: 'jpeg' | 'png' | 'webp'
    } = {}
  ): Promise<ProcessedImage> {
    const { width, height, quality = 80, format = 'jpeg' } = options

    try {
      let pipeline = sharp(buffer)

      if (width || height) {
        pipeline = pipeline.resize(width, height, {
          fit: 'cover',
          position: 'center',
        })
      }

      let processed: Buffer
      switch (format) {
        case 'png':
          processed = await pipeline.png({ quality }).toBuffer()
          break
        case 'webp':
          processed = await pipeline.webp({ quality }).toBuffer()
          break
        default:
          processed = await pipeline.jpeg({ quality, progressive: true }).toBuffer()
      }

      const metadata = await sharp(processed).metadata()

      return {
        buffer: processed,
        width: metadata.width!,
        height: metadata.height!,
        format: metadata.format!,
        size: processed.length,
      }
    } catch (error) {
      throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
```

## 🔧 Development Workflow

### 1. **Build System Scripts**
```json
// File: package.json scripts section
{
  "scripts": {
    "dev": "vite dev --port 2847",
    "build": "vite build",
    "start": "node .output/server/index.mjs",
    "serve": "vite preview",
    
    // Testing
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    
    // Code Quality
    "lint": "eslint src/ --ext .ts,.tsx",
    "lint:fix": "eslint src/ --ext .ts,.tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
    
    // Database
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate", 
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "seed:todos": "tsx scripts/seed-todos.ts",
    
    // Internationalization
    "i18n:extract": "i18next-parser",
    "i18n:extract:watch": "i18next-parser --watch",
    "i18n:audit": "node scripts/find-missing-translations.cjs",
    
    // Error Management
    "errors:check": "node scripts/find-unused-errors.cjs",
    "errors:check:strict": "node scripts/find-unused-errors.cjs --strict",
    "errors:fix": "node scripts/find-unused-errors.cjs --fix",
    
    // Email Development
    "email:dev": "email dev --dir src/emails"
  }
}
```

### 2. **Linting Configuration**
```javascript
// File: eslint.config.js
import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import imports from 'eslint-plugin-import'

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        React: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react,
      'react-hooks': reactHooks,
      import: imports,
    },
    rules: {
      // TypeScript rules
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-const': 'error',
      
      // React rules
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      
      // Import rules
      'import/order': ['error', {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index'
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      }],
    },
  },
]
```

### 3. **Error Monitoring Integration**
```typescript
// File: src/lib/errors/query-client.ts
import { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { parseError } from './client-handler'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60, // 1 minute
        retry: (failureCount, error) => {
          // Don't retry on auth errors
          if ((error as any)?.statusCode === 401) return false
          
          // Don't retry on client errors (4xx)
          if ((error as any)?.statusCode >= 400 && (error as any)?.statusCode < 500) return false
          
          // Retry server errors up to 3 times
          return failureCount < 3
        },
      },
      mutations: {
        onError: (error) => {
          const parsedError = parseError(error)
          
          // Don't show error toast for validation errors (handled by forms)
          if (parsedError.code.startsWith('VAL_')) return
          
          toast.error(parsedError.message, {
            description: process.env.NODE_ENV === 'development' ? parsedError.code : undefined,
          })
        },
      },
    },
  })
}
```

### 4. **File Upload Implementation**
```typescript
// File: src/routes/api/avatars/upload.ts
import { createServerFileRoute } from '@tanstack/react-start/server'

import { createLocalStorageService } from '@/lib/storage/local-storage-service'
import { ImageProcessor } from '@/lib/storage/image-processor'
import { auth } from '@/lib/auth/auth'

export const ServerRoute = createServerFileRoute('/api/avatars/upload').methods({
  POST: async ({ request }) => {
    try {
      // Authenticate user
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session?.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Parse multipart form data
      const formData = await request.formData()
      const file = formData.get('avatar') as File

      if (!file) {
        return Response.json({ error: 'No file provided' }, { status: 400 })
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        return Response.json({
          error: 'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.',
        }, { status: 400 })
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        return Response.json({
          error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB`,
        }, { status: 400 })
      }

      // Process file
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const isValidImage = await ImageProcessor.validateImage(buffer)
      if (!isValidImage) {
        return Response.json({ error: 'File is not a valid image' }, { status: 400 })
      }

      // Process and upload
      const processed = await ImageProcessor.processAvatar(buffer)
      const storage = createLocalStorageService()
      const avatarKey = storage.generateAvatarKey(session.user.id, 'jpg')

      const uploadResult = await storage.uploadFile(avatarKey, processed.buffer, 'image/jpeg', {
        userId: session.user.id,
        originalFilename: file.name,
      })

      // Update user avatar through Better Auth
      await auth.api.updateUser({
        headers: request.headers,
        body: { image: uploadResult.url },
      })

      return Response.json({
        success: true,
        avatarUrl: uploadResult.url,
      })
    } catch (error) {
      console.error('Avatar upload error:', error)
      return Response.json({
        error: error instanceof Error ? error.message : 'Failed to upload avatar',
      }, { status: 500 })
    }
  },
})
```

## 🎯 Integration Requirements

### Error Handling in Server Functions
```typescript
// Standard error handling pattern
export const serverAction = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator(schema.parse)
  .handler(async ({ data, context }) => {
    try {
      // Operation logic
      const result = await performOperation(data)
      return result
    } catch (error) {
      // Handle known error types
      if (error instanceof ValidationError) {
        throw error
      }
      
      if (error instanceof AppError) {
        throw error
      }
      
      // Handle database constraint errors
      if ((error as any).code === '23505') {
        throw new AppError(
          'BIZ_DUPLICATE_ENTRY',
          409,
          { field: 'email' },
          'This email is already in use'
        )
      }
      
      // Wrap unknown errors
      throw new AppError(
        'SYS_SERVER_ERROR',
        500,
        undefined,
        'An unexpected error occurred'
      )
    }
  })
```

### Error Boundaries in Route Components
```typescript
// File: src/routes/_authenticated.tsx
import { Outlet, createFileRoute } from '@tanstack/react-router'

import { ErrorBoundary } from '@/components/error-boundary'
import { AuthWrapper } from '@/features/auth/components/auth-wrapper'

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return (
    <AuthWrapper>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </AuthWrapper>
  )
}
```

## 🧪 Testing Requirements

### Error Handling Testing
```typescript
// Test error boundaries
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '@/components/error-boundary'

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

describe('ErrorBoundary', () => {
  it('should catch and display errors', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })
})
```

### File Upload Testing
```typescript
// Test file upload validation
describe('Avatar Upload', () => {
  it('should validate file types', async () => {
    const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' })
    
    const formData = new FormData()
    formData.append('avatar', invalidFile)

    const request = new Request('/api/avatars/upload', {
      method: 'POST',
      body: formData,
    })

    const response = await ServerRoute.POST({ request })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Invalid file type')
  })
})
```

## 📋 Implementation Checklist

Before considering error handling and file management complete, verify:

- [ ] **Error Classes**: AppError and ValidationError implemented
- [ ] **Error Boundaries**: Components wrapped with error boundaries
- [ ] **Error Translations**: All error messages translatable
- [ ] **File Validation**: Proper file type and size validation
- [ ] **Image Processing**: Sharp configured for image optimization
- [ ] **Storage Service**: Local storage service with metadata
- [ ] **Upload Security**: File content validation beyond MIME types
- [ ] **Cleanup Logic**: Old file cleanup when replacing uploads
- [ ] **Error Monitoring**: Proper logging and error reporting
- [ ] **Development Tools**: Error scripts and validation tools

## 🚀 Advanced Patterns

### Structured Logging
```typescript
// Centralized logging service
export class Logger {
  static error(message: string, error: unknown, context?: any) {
    console.error(`[ERROR] ${message}`, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      context,
      timestamp: new Date().toISOString(),
    })
  }

  static info(message: string, data?: any) {
    console.log(`[INFO] ${message}`, {
      data,
      timestamp: new Date().toISOString(),
    })
  }
}
```

### Error Recovery Patterns
```typescript
// Automatic error recovery in queries
const todoQuery = useQuery({
  queryKey: ['todos', todoId],
  queryFn: () => getTodoById({ data: { id: todoId } }),
  retry: (failureCount, error) => {
    // Auto-retry on network errors
    if ((error as any)?.code === 'NETWORK_ERROR' && failureCount < 3) {
      return true
    }
    return false
  },
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
})
```

## 🎯 Toast Action Button Patterns

### Enhanced Success Toast with Action Buttons

The `showSuccess` function supports action buttons for implementing undo functionality and other user actions directly from toast notifications.

```typescript
// File: src/lib/errors/hooks.ts - Enhanced success toast implementation
import { useCallback } from 'react'
import { toast } from 'sonner'

import { parseError, handleErrorAction } from './client-handler'
import { isErrorCode } from './codes'
import type { ParsedError } from './client-handler'
import { useTranslation } from '@/i18n/hooks/useTranslation'

export function useErrorHandler() {
  const { t } = useTranslation('errors')

  const showSuccess = useCallback(
    (message: string, options?: { action?: { label: string; onClick: () => void } }) => {
      // Check if it's a translation key
      const translatedMessage = message.includes('.') ? t(message) : message
      
      if (options?.action) {
        toast.success(translatedMessage, {
          action: {
            label: options.action.label,
            onClick: options.action.onClick,
          },
          duration: 10000, // Extended duration for action buttons (10 seconds)
          position: 'bottom-right', // Better position for actions
        })
      } else {
        toast.success(translatedMessage, {
          duration: 4000, // Standard duration for regular success messages
        })
      }
    },
    [t]
  )

  return {
    showError,
    showSuccess,
    showInfo,
  }
}
```

### Usage Patterns for Action Toasts

```typescript
// Delete with undo functionality
function useDeleteWithUndo() {
  const { showSuccess, showError } = useErrorHandler()
  const queryClient = useQueryClient()

  const handleDelete = useCallback(async (id: string) => {
    try {
      // Perform delete operation
      await deleteTodo({ data: { id } })
      
      // Show success toast with undo action
      showSuccess('Todo deleted successfully', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              const restored = await undoDeleteTodo({ data: { id } })
              queryClient.invalidateQueries(['todos'])
              showSuccess('Todo restored successfully')
            } catch (error) {
              showError(error)
            }
          }
        }
      })
      
      // Refresh data
      queryClient.invalidateQueries(['todos'])
    } catch (error) {
      showError(error)
    }
  }, [showSuccess, showError, queryClient])

  return { handleDelete }
}
```

### Advanced Action Toast Patterns

```typescript
// Multiple actions in toast
const showMultiActionToast = (message: string, actions: Array<{ label: string; onClick: () => void }>) => {
  // For multiple actions, show the primary action in the toast
  // and handle secondary actions differently
  const [primaryAction, ...secondaryActions] = actions
  
  toast.success(message, {
    action: primaryAction ? {
      label: primaryAction.label,
      onClick: primaryAction.onClick,
    } : undefined,
    description: secondaryActions.length > 0 
      ? `${secondaryActions.length} more action${secondaryActions.length > 1 ? 's' : ''} available`
      : undefined,
    duration: 8000,
  })
}

// Contextual actions based on user permissions
function usePermissionAwareToast() {
  const { canDelete, canCreate } = useClientPermissions()
  const { showSuccess } = useErrorHandler()

  const showDeleteSuccess = useCallback((itemId: string) => {
    const actions = []
    
    // Only show undo if user has create permission (to restore)
    if (canCreate()) {
      actions.push({
        label: 'Undo',
        onClick: () => undoDelete(itemId)
      })
    }

    showSuccess('Item deleted', {
      action: actions[0] // Show first available action
    })
  }, [canCreate, showSuccess])

  return { showDeleteSuccess }
}
```

### Toast Accessibility Considerations

```typescript
// Accessible toast implementation
const showAccessibleSuccess = (message: string, action?: { label: string; onClick: () => void }) => {
  toast.success(message, {
    action: action ? {
      label: action.label,
      onClick: action.onClick,
    } : undefined,
    duration: action ? 10000 : 4000, // Longer for actions
    // Accessibility improvements
    ariaProps: {
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': true,
    },
    // Ensure action button is keyboard accessible
    actionButtonProps: {
      tabIndex: 0,
      'aria-label': `${action?.label}. Press Enter to activate.`,
    },
  })
}
```

### Error Recovery Patterns with Actions

```typescript
// Network error with retry action
const handleNetworkError = (error: Error, retryFn: () => Promise<void>) => {
  const { showError } = useErrorHandler()
  
  if (error.message.includes('network') || error.message.includes('fetch')) {
    showError('Network error occurred', {
      action: {
        label: 'Retry',
        onClick: async () => {
          try {
            await retryFn()
            showSuccess('Operation completed successfully')
          } catch (retryError) {
            showError(retryError)
          }
        }
      }
    })
  } else {
    showError(error)
  }
}

// Permission error with upgrade action
const handlePermissionError = (error: AppError) => {
  const { showError } = useErrorHandler()
  
  if (error.code === 'BIZ_LIMIT_EXCEEDED') {
    showError('Upgrade required to continue', {
      action: {
        label: 'Upgrade',
        onClick: () => {
          // Navigate to billing page
          window.location.href = '/billing'
        }
      }
    })
  } else if (error.code === 'FORBIDDEN') {
    showError('Access denied', {
      action: {
        label: 'Contact Admin',
        onClick: () => {
          // Open support chat or email
          window.open('mailto:support@company.com?subject=Access Request')
        }
      }
    })
  } else {
    showError(error)
  }
}
```

### Integration with Form Systems

```typescript
// Form submission with undo capability
function useFormWithUndo<T>() {
  const { showSuccess, showError } = useErrorHandler()
  const [lastSavedData, setLastSavedData] = useState<T | null>(null)

  const submitWithUndo = useCallback(async (
    data: T, 
    submitFn: (data: T) => Promise<void>,
    undoFn?: (previousData: T) => Promise<void>
  ) => {
    const previousData = lastSavedData
    
    try {
      await submitFn(data)
      setLastSavedData(data)
      
      showSuccess('Changes saved', {
        action: previousData && undoFn ? {
          label: 'Undo',
          onClick: async () => {
            try {
              await undoFn(previousData)
              setLastSavedData(previousData)
              showSuccess('Changes reverted')
            } catch (error) {
              showError(error)
            }
          }
        } : undefined
      })
    } catch (error) {
      showError(error)
    }
  }, [lastSavedData, showSuccess, showError])

  return { submitWithUndo }
}
```

### Testing Action Toast Functionality

```typescript
// Testing toast actions
describe('Toast Action Buttons', () => {
  it('should show success toast with undo action', async () => {
    const mockUndo = vi.fn().mockResolvedValue(undefined)
    const { showSuccess } = useErrorHandler()
    
    showSuccess('Item deleted', {
      action: {
        label: 'Undo',
        onClick: mockUndo
      }
    })

    // Find and click the undo button
    const undoButton = screen.getByRole('button', { name: 'Undo' })
    await user.click(undoButton)
    
    expect(mockUndo).toHaveBeenCalledOnce()
  })

  it('should handle action failures gracefully', async () => {
    const mockUndoFail = vi.fn().mockRejectedValue(new Error('Undo failed'))
    const { showSuccess } = useErrorHandler()
    
    showSuccess('Item deleted', {
      action: {
        label: 'Undo',
        onClick: mockUndoFail
      }
    })

    const undoButton = screen.getByRole('button', { name: 'Undo' })
    await user.click(undoButton)
    
    // Should show error toast for failed undo
    expect(screen.getByText('Undo failed')).toBeInTheDocument()
  })
})
```

### Best Practices for Action Toasts

**✅ Do:**
- Use longer durations (8-10 seconds) for action toasts
- Provide clear, action-oriented labels ("Undo", "Retry", "Upgrade")
- Handle action failures gracefully with error feedback
- Consider user permissions when showing actions
- Make action buttons keyboard accessible
- Use consistent action patterns across the application

**❌ Don't:**
- Overwhelm users with too many action options in one toast
- Use action buttons for navigation (use regular links instead)
- Show actions that users don't have permission to perform
- Make critical actions too easy to accidentally trigger
- Forget to handle loading states during action execution

This comprehensive error handling and file management system provides robust error recovery, user-friendly error messages, secure file handling, efficient development workflows, and enhanced user experience through actionable toast notifications for building production-ready applications.