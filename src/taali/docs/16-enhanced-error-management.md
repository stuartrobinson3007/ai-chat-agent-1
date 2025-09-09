# Enhanced Error Management Implementation Guide

This document provides comprehensive guidance for implementing advanced error handling including error categorization, comprehensive error codes, client-side error strategies, and error boundary composition patterns.

## 🚨 Critical Rules

- **ALWAYS use ERROR_CODES constants** - Never hardcode error codes in applications
- **MUST categorize errors properly** - Use established error categories for consistent UX
- **NEVER expose internal errors** - Transform system errors into user-friendly messages
- **ALWAYS provide actionable error responses** - Include recovery actions where possible
- **MUST handle error contexts appropriately** - Route errors to correct display locations

## ❌ Common AI Agent Mistakes

### Error Code Violations
```typescript
// ❌ NEVER hardcode error codes
throw new AppError('SOME_ERROR', 400) // Hardcoded string
if (error.code === 'validation_failed') // Hardcoded check

// ✅ ALWAYS use ERROR_CODES constants
import { ERROR_CODES } from '@/lib/errors/codes'

throw new AppError(ERROR_CODES.VAL_REQUIRED_FIELD, 400)
if (error.code === ERROR_CODES.VAL_REQUIRED_FIELD)
```

### Error Category Misuse
```typescript
// ❌ NEVER show system errors as field errors
if (error.code === 'SYS_SERVER_ERROR') {
  setError('title', { message: error.message }) // Wrong category
}

// ❌ NEVER show field errors as toasts
if (error.code === 'VAL_REQUIRED_FIELD') {
  toast.error(error.message) // Should be shown in form field
}

// ✅ ALWAYS use proper error categorization
import { getErrorDisplayType } from '@/lib/errors/error-categories'

const displayType = getErrorDisplayType(error.code)
switch (displayType) {
  case 'field':
    setError(fieldName, { message: error.message })
    break
  case 'form':
    setError('root', { message: error.message })
    break
  case 'toast':
    toast.error(error.message)
    break
}
```

### Error Recovery Violations
```typescript
// ❌ NEVER show errors without recovery actions
toast.error('Payment failed') // No way to recover

// ✅ ALWAYS provide actionable error responses
toast.error('Payment failed', {
  action: {
    label: 'Update Payment Method',
    onClick: () => navigate('/billing'),
  },
})
```

## ✅ Established Patterns

### 1. **Error Code Registry**
```typescript
// File: src/lib/errors/codes.ts
export const ERROR_CODES = {
  // Authentication
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_INSUFFICIENT_PERMISSIONS',
  AUTH_ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  AUTH_NOT_AUTHENTICATED: 'AUTH_NOT_AUTHENTICATED',

  // Validation
  VAL_REQUIRED_FIELD: 'VAL_REQUIRED_FIELD',
  VAL_INVALID_FORMAT: 'VAL_INVALID_FORMAT',
  VAL_INVALID_EMAIL: 'VAL_INVALID_EMAIL',
  VAL_PASSWORD_TOO_WEAK: 'VAL_PASSWORD_TOO_WEAK',

  // Business Logic
  BIZ_LIMIT_EXCEEDED: 'BIZ_LIMIT_EXCEEDED',
  BIZ_DUPLICATE_ENTRY: 'BIZ_DUPLICATE_ENTRY',
  BIZ_NOT_FOUND: 'BIZ_NOT_FOUND',
  BIZ_INVALID_STATE: 'BIZ_INVALID_STATE',
  BIZ_PAYMENT_FAILED: 'BIZ_PAYMENT_FAILED',

  // System
  SYS_SERVER_ERROR: 'SYS_SERVER_ERROR',
  SYS_RATE_LIMIT: 'SYS_RATE_LIMIT',
  SYS_CONFIG_ERROR: 'SYS_CONFIG_ERROR',

  // Network
  NET_CONNECTION_ERROR: 'NET_CONNECTION_ERROR',
  NET_TIMEOUT: 'NET_TIMEOUT',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export function isErrorCode(code: string): code is ErrorCode {
  return Object.values(ERROR_CODES).includes(code as ErrorCode)
}
```

### 2. **Error Categorization System**
```typescript
// File: src/lib/errors/error-categories.ts
import { ERROR_CODES, type ErrorCode } from './codes'

// Define where each error type should be displayed
const ERROR_CATEGORIES = {
  field: new Set<ErrorCode>([
    ERROR_CODES.VAL_REQUIRED_FIELD,
    ERROR_CODES.VAL_INVALID_FORMAT,
    ERROR_CODES.VAL_INVALID_EMAIL,
    ERROR_CODES.VAL_PASSWORD_TOO_WEAK,
    ERROR_CODES.BIZ_DUPLICATE_ENTRY
  ]),
  form: new Set<ErrorCode>([
    ERROR_CODES.BIZ_LIMIT_EXCEEDED,
    ERROR_CODES.BIZ_INVALID_STATE,
    ERROR_CODES.BIZ_NOT_FOUND,
    ERROR_CODES.BIZ_PAYMENT_FAILED,
    ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
    ERROR_CODES.AUTH_ACCOUNT_LOCKED,
    ERROR_CODES.AUTH_INVALID_CREDENTIALS
  ]),
  toast: new Set<ErrorCode>([
    ERROR_CODES.SYS_SERVER_ERROR,
    ERROR_CODES.SYS_CONFIG_ERROR,
    ERROR_CODES.SYS_RATE_LIMIT,
    ERROR_CODES.NET_CONNECTION_ERROR,
    ERROR_CODES.NET_TIMEOUT,
    ERROR_CODES.AUTH_SESSION_EXPIRED,
    ERROR_CODES.AUTH_NOT_AUTHENTICATED
  ])
}

export function getErrorDisplayType(code: string): 'field' | 'form' | 'toast' {
  const errorCode = code as ErrorCode
  if (ERROR_CATEGORIES.field.has(errorCode)) return 'field'
  if (ERROR_CATEGORIES.form.has(errorCode)) return 'form'
  if (ERROR_CATEGORIES.toast.has(errorCode)) return 'toast'
  
  return 'toast' // Default to toast for unknown errors
}

export function isRetryableError(code: string): boolean {
  const retryableCodes = new Set<ErrorCode>([
    ERROR_CODES.NET_CONNECTION_ERROR,
    ERROR_CODES.NET_TIMEOUT,
    ERROR_CODES.SYS_RATE_LIMIT
  ])
  
  return retryableCodes.has(code as ErrorCode)
}

export function getErrorAction(code: string): { action: string; label: string } | null {
  switch (code) {
    case ERROR_CODES.AUTH_SESSION_EXPIRED:
    case ERROR_CODES.AUTH_NOT_AUTHENTICATED:
      return { action: 'login', label: 'Sign In' }
      
    case ERROR_CODES.BIZ_LIMIT_EXCEEDED:
    case ERROR_CODES.BIZ_PAYMENT_FAILED:
      return { action: 'upgrade', label: 'Upgrade Plan' }
      
    case ERROR_CODES.NET_CONNECTION_ERROR:
    case ERROR_CODES.NET_TIMEOUT:
      return { action: 'retry', label: 'Try Again' }
      
    default:
      return null
  }
}
```

### 3. **Enhanced Client Error Handler**
```typescript
// File: src/lib/errors/client-handler.ts (Enhanced)
import { isAppError } from '@/lib/utils/errors'
import type { ErrorAction } from '@/lib/utils/errors'

export interface ParsedError {
  code: string
  message: string
  statusCode: number
  context?: unknown
  actions?: ErrorAction[]
}

export function parseError(error: unknown): ParsedError {
  // Handle AppError instances
  if (isAppError(error)) {
    return {
      code: error.code,
      message: error.fallbackMessage || error.message,
      statusCode: error.statusCode,
      context: error.context,
      actions: error.actions,
    }
  }

  // Handle API responses
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const e = error as { 
      code: string; 
      message: string; 
      statusCode?: number; 
      context?: unknown; 
      actions?: ErrorAction[] 
    }
    return {
      code: e.code,
      message: e.message || e.code,
      statusCode: e.statusCode || 500,
      context: e.context,
      actions: e.actions,
    }
  }

  // Handle standard errors
  if (error instanceof Error) {
    return {
      code: 'SYS_SERVER_ERROR',
      message: error.message,
      statusCode: 500,
    }
  }

  return {
    code: 'SYS_SERVER_ERROR',
    message: 'An unexpected error occurred',
    statusCode: 500,
  }
}

export function handleErrorAction(action: ErrorAction) {
  switch (action.action) {
    case 'retry':
      window.location.reload()
      break
    case 'login':
      window.location.href = '/auth/signin'
      break
    case 'upgrade':
      window.location.href = '/billing'
      break
    case 'support':
      window.location.href = '/support'
      break
    case 'goBack':
      window.history.back()
      break
  }
}
```

### 4. **Enhanced Error Hook**
```typescript
// File: src/lib/errors/hooks.ts (Enhanced)
import { useCallback } from 'react'
import { toast } from 'sonner'

import { parseError, handleErrorAction, type ParsedError } from './client-handler'
import { getErrorDisplayType, getErrorAction, isRetryableError } from './error-categories'
import { useTranslation } from '@/i18n/hooks/useTranslation'

export function useErrorHandler() {
  const { t } = useTranslation(['errors', 'notifications'])

  const showError = useCallback((error: unknown, options?: {
    showToast?: boolean
    context?: string
  }) => {
    const parsedError: ParsedError = parseError(error)
    const displayType = getErrorDisplayType(parsedError.code)
    
    // Only show toast if appropriate for error type and explicitly requested
    if ((options?.showToast ?? true) && displayType === 'toast') {
      const defaultAction = getErrorAction(parsedError.code)
      const actions = parsedError.actions || (defaultAction ? [defaultAction] : [])
      
      toast.error(parsedError.message, {
        description: options?.context || (
          isRetryableError(parsedError.code) 
            ? t('errors:messages.retryable')
            : t('errors:messages.contactSupport')
        ),
        action: actions[0] ? {
          label: actions[0].label || actions[0].action,
          onClick: () => handleErrorAction(actions[0]),
        } : undefined,
        duration: isRetryableError(parsedError.code) ? 5000 : 10000,
      })
    }

    // Log for debugging in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error handled:', {
        code: parsedError.code,
        message: parsedError.message,
        context: parsedError.context,
        displayType,
        originalError: error,
      })
    }

    return parsedError
  }, [t])

  const showSuccess = useCallback((message: string, options?: {
    description?: string
    duration?: number
  }) => {
    toast.success(message, {
      description: options?.description,
      duration: options?.duration || 4000,
    })
  }, [])

  const showInfo = useCallback((message: string, options?: {
    description?: string
    action?: { label: string; onClick: () => void }
  }) => {
    toast.info(message, {
      description: options?.description,
      action: options?.action,
    })
  }, [])

  const showWarning = useCallback((message: string, options?: {
    description?: string
    action?: { label: string; onClick: () => void }
  }) => {
    toast.warning(message, {
      description: options?.description,
      action: options?.action,
    })
  }, [])

  return {
    showError,
    showSuccess,
    showInfo,
    showWarning,
  }
}

// Hook for field-specific error extraction
export function useFieldError(error: unknown, fieldName: string): string | string[] | null {
  if (!error) return null

  // Handle ValidationError with field mapping
  if (error instanceof ValidationError && error.context?.fields) {
    return error.context.fields[fieldName] || null
  }

  // Handle form errors that should be shown for specific fields
  const parsedError = parseError(error)
  if (parsedError.code === ERROR_CODES.BIZ_DUPLICATE_ENTRY && parsedError.context?.field === fieldName) {
    return parsedError.message
  }

  return null
}
```

### 5. **Query Client Error Integration**
```typescript
// File: src/lib/errors/query-client.ts (Enhanced)
import { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { parseError } from './client-handler'
import { getErrorDisplayType, isRetryableError } from './error-categories'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60, // 1 minute
        retry: (failureCount, error) => {
          const parsedError = parseError(error)
          
          // Don't retry on auth errors
          if (parsedError.code.startsWith('AUTH_')) return false
          
          // Don't retry on validation errors
          if (parsedError.code.startsWith('VAL_')) return false
          
          // Don't retry on business logic errors
          if (parsedError.code.startsWith('BIZ_')) return false
          
          // Retry network and system errors
          if (isRetryableError(parsedError.code) && failureCount < 3) {
            return true
          }
          
          return false
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      mutations: {
        retry: (failureCount, error) => {
          const parsedError = parseError(error)
          return isRetryableError(parsedError.code) && failureCount < 2
        },
        onError: (error) => {
          const parsedError = parseError(error)
          const displayType = getErrorDisplayType(parsedError.code)
          
          // Only show toast for mutation errors that should be toasted
          // Form errors are handled by useFormMutation
          if (displayType === 'toast') {
            toast.error(parsedError.message, {
              description: 'The operation failed. Please try again or contact support.',
              duration: 6000,
            })
          }
        },
      },
    },
  })
}
```

## 🔧 Step-by-Step Implementation

### 1. **Adding New Error Codes**
```typescript
// Step 1: Add to ERROR_CODES
// File: src/lib/errors/codes.ts
export const ERROR_CODES = {
  // ... existing codes
  NEW_CATEGORY_SPECIFIC_ERROR: 'NEW_CATEGORY_SPECIFIC_ERROR',
  NEW_CATEGORY_ANOTHER_ERROR: 'NEW_CATEGORY_ANOTHER_ERROR',
} as const

// Step 2: Categorize the error
// File: src/lib/errors/error-categories.ts
const ERROR_CATEGORIES = {
  field: new Set<ErrorCode>([
    // ... existing
    ERROR_CODES.NEW_CATEGORY_SPECIFIC_ERROR, // Field-level error
  ]),
  toast: new Set<ErrorCode>([
    // ... existing
    ERROR_CODES.NEW_CATEGORY_ANOTHER_ERROR, // System-level error
  ]),
}

// Step 3: Add error actions if needed
export function getErrorAction(code: string): { action: string; label: string } | null {
  switch (code) {
    // ... existing cases
    case ERROR_CODES.NEW_CATEGORY_SPECIFIC_ERROR:
      return { action: 'refresh', label: 'Refresh Page' }
    default:
      return null
  }
}
```

### 2. **Server Function Error Handling Template**
```typescript
// Template for consistent server function error handling
import { ERROR_CODES } from '@/lib/errors/codes'
import { AppError, ValidationError } from '@/lib/utils/errors'

export const serverFunction = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => {
    try {
      return schema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fields: Record<string, string[]> = {}
        error.issues.forEach((issue) => {
          const path = issue.path.join('.')
          if (!fields[path]) fields[path] = []
          
          // Map Zod error codes to our error codes
          switch (issue.code) {
            case 'too_small':
              fields[path].push(ERROR_CODES.VAL_REQUIRED_FIELD)
              break
            case 'invalid_string':
              if (issue.validation === 'email') {
                fields[path].push(ERROR_CODES.VAL_INVALID_EMAIL)
              } else {
                fields[path].push(ERROR_CODES.VAL_INVALID_FORMAT)
              }
              break
            default:
              fields[path].push(ERROR_CODES.VAL_INVALID_FORMAT)
          }
        })
        
        throw new ValidationError(fields, 'Validation failed')
      }
      throw error
    }
  })
  .handler(async ({ data, context }) => {
    try {
      // Business logic
      const result = await performOperation(data)
      return result
    } catch (error) {
      // Handle known error types
      if (error instanceof ValidationError || error instanceof AppError) {
        throw error
      }
      
      // Handle database constraint errors
      if ((error as any).code === '23505') { // Unique constraint
        throw new AppError(
          ERROR_CODES.BIZ_DUPLICATE_ENTRY,
          409,
          { field: extractFieldFromConstraint(error) },
          'This value is already in use'
        )
      }
      
      if ((error as any).code === '23503') { // Foreign key constraint
        throw new AppError(
          ERROR_CODES.BIZ_NOT_FOUND,
          400,
          undefined,
          'Referenced resource not found'
        )
      }
      
      // Handle network/external service errors
      if ((error as any).code === 'ECONNREFUSED') {
        throw new AppError(
          ERROR_CODES.NET_CONNECTION_ERROR,
          503,
          undefined,
          'Service temporarily unavailable',
          [{ action: 'retry', label: 'Try Again' }]
        )
      }
      
      // Wrap unknown errors
      console.error('Unexpected error in server function:', error)
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'An unexpected error occurred'
      )
    }
  })
```

### 3. **Form Integration with Enhanced Error Handling**
```typescript
// Complete form with all error handling patterns
function EnhancedForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const { showError } = useErrorHandler()

  const mutation = useFormMutation({
    mutationFn: submitForm,
    setError: form.setError,
    onSuccess: (data) => {
      toast.success('Form submitted successfully')
      navigate({ to: `/items/${data.id}` })
    },
    onError: (error) => {
      // Custom error handling for specific error types
      const parsedError = parseError(error)
      
      if (parsedError.code === ERROR_CODES.BIZ_LIMIT_EXCEEDED) {
        // Show upgrade prompt for limit errors
        toast.error(parsedError.message, {
          action: {
            label: 'Upgrade Plan',
            onClick: () => navigate({ to: '/billing' }),
          },
        })
        return
      }
      
      // Let useFormMutation handle other errors
      showError(error, { context: 'Form submission failed' })
    },
  })

  return (
    <FormErrorBoundary
      onError={(error) => {
        console.error('Form render error:', error)
        showError(error, { context: 'Form failed to render' })
      }}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(mutation.mutate)}>
          {/* Form fields */}
          
          {/* Form root error display */}
          {form.formState.errors.root && (
            <div className="p-4 border border-destructive/30 rounded-lg bg-destructive/5">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm text-destructive font-medium">
                    {form.formState.errors.root.message}
                  </p>
                  {form.formState.errors.root.type === 'server' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      If this error persists, please contact support.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <FormActions
            isSubmitting={mutation.isPending}
            isDirty={form.formState.isDirty}
          />
        </form>
      </Form>
    </FormErrorBoundary>
  )
}
```

## 🎯 Integration Requirements

### With Translation System
```typescript
// Error messages integrate with i18n
// File: src/i18n/locales/en/errors.json
{
  "codes": {
    "AUTH_INVALID_CREDENTIALS": "Invalid email or password",
    "AUTH_SESSION_EXPIRED": "Your session has expired. Please sign in again.",
    "VAL_REQUIRED_FIELD": "This field is required",
    "BIZ_LIMIT_EXCEEDED": "You've reached your plan limit",
    "SYS_SERVER_ERROR": "Something went wrong on our end"
  },
  "messages": {
    "retryable": "This appears to be a temporary issue",
    "contactSupport": "Please contact support if this continues"
  }
}
```

### With AppError Class
```typescript
// Enhanced AppError with better categorization
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public statusCode: number,
    public context?: unknown,
    public fallbackMessage?: string,
    public actions?: ErrorAction[]
  ) {
    super(fallbackMessage || code)
    this.name = 'AppError'
  }

  // Convenience methods for common errors
  static notFound(resource: string): AppError {
    return new AppError(
      ERROR_CODES.BIZ_NOT_FOUND,
      404,
      { resource },
      `${resource} not found`,
      [{ action: 'goBack', label: 'Go Back' }]
    )
  }

  static forbidden(action: string): AppError {
    return new AppError(
      ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
      403,
      { action },
      `You don't have permission to ${action}`,
      [{ action: 'login', label: 'Sign In' }]
    )
  }

  static limitExceeded(resource: string, limit: number): AppError {
    return new AppError(
      ERROR_CODES.BIZ_LIMIT_EXCEEDED,
      402,
      { resource, limit },
      `You've reached your plan limit of ${limit} ${resource}`,
      [{ action: 'upgrade', label: 'Upgrade Plan' }]
    )
  }
}
```

## 🧪 Testing Requirements

### Error Categorization Testing
```typescript
// Test error categorization
import { getErrorDisplayType, getErrorAction } from '@/lib/errors/error-categories'
import { ERROR_CODES } from '@/lib/errors/codes'

describe('Error Categorization', () => {
  it('should categorize validation errors as field errors', () => {
    expect(getErrorDisplayType(ERROR_CODES.VAL_REQUIRED_FIELD)).toBe('field')
    expect(getErrorDisplayType(ERROR_CODES.VAL_INVALID_EMAIL)).toBe('field')
  })

  it('should categorize business errors as form errors', () => {
    expect(getErrorDisplayType(ERROR_CODES.BIZ_LIMIT_EXCEEDED)).toBe('form')
    expect(getErrorDisplayType(ERROR_CODES.BIZ_NOT_FOUND)).toBe('form')
  })

  it('should categorize system errors as toast errors', () => {
    expect(getErrorDisplayType(ERROR_CODES.SYS_SERVER_ERROR)).toBe('toast')
    expect(getErrorDisplayType(ERROR_CODES.NET_TIMEOUT)).toBe('toast')
  })

  it('should provide appropriate actions for errors', () => {
    expect(getErrorAction(ERROR_CODES.AUTH_SESSION_EXPIRED)).toEqual({
      action: 'login',
      label: 'Sign In'
    })

    expect(getErrorAction(ERROR_CODES.BIZ_LIMIT_EXCEEDED)).toEqual({
      action: 'upgrade',
      label: 'Upgrade Plan'
    })
  })
})
```

### Error Handler Testing
```typescript
// Test error handler hook
import { renderHook } from '@testing-library/react'
import { useErrorHandler } from '@/lib/errors/hooks'

describe('useErrorHandler', () => {
  it('should show appropriate error types', () => {
    const { result } = renderHook(() => useErrorHandler())

    const validationError = new ValidationError(
      { title: ['VAL_REQUIRED_FIELD'] },
      'Validation failed'
    )

    const systemError = new AppError(
      ERROR_CODES.SYS_SERVER_ERROR,
      500,
      undefined,
      'Server error'
    )

    // Validation errors shouldn't show toast
    const parsed1 = result.current.showError(validationError, { showToast: false })
    expect(parsed1.code).toBe('ValidationError')

    // System errors should show toast
    const parsed2 = result.current.showError(systemError)
    expect(parsed2.code).toBe(ERROR_CODES.SYS_SERVER_ERROR)
  })
})
```

## 📋 Implementation Checklist

Before considering enhanced error management complete, verify:

- [ ] **Error Code Registry**: All error codes defined in central registry
- [ ] **Error Categorization**: Proper categorization for display routing
- [ ] **Client Error Handler**: Enhanced error handling with context awareness
- [ ] **Form Integration**: Error handling integrated with form systems
- [ ] **Query Client Integration**: TanStack Query retry and error strategies
- [ ] **Translation Support**: All error messages translatable
- [ ] **Action Suggestions**: Recoverable errors include action suggestions
- [ ] **Audit Logging**: Error logging for debugging and monitoring
- [ ] **Security**: No internal error details exposed to users
- [ ] **Performance**: Efficient error handling without memory leaks

## 🚀 Advanced Patterns

### Error Recovery Strategies
```typescript
// Automatic error recovery with progressive strategies
export function useErrorRecovery<T>(
  operation: () => Promise<T>,
  options?: {
    maxRetries?: number
    backoffStrategy?: 'linear' | 'exponential'
    recoverableErrors?: ErrorCode[]
  }
) {
  const [attempt, setAttempt] = useState(0)
  const [isRecovering, setIsRecovering] = useState(false)

  const executeWithRecovery = useCallback(async (): Promise<T> => {
    const maxRetries = options?.maxRetries || 3
    const recoverableErrors = options?.recoverableErrors || [
      ERROR_CODES.NET_CONNECTION_ERROR,
      ERROR_CODES.NET_TIMEOUT,
      ERROR_CODES.SYS_RATE_LIMIT,
    ]

    for (let i = 0; i <= maxRetries; i++) {
      try {
        setAttempt(i)
        setIsRecovering(i > 0)
        
        const result = await operation()
        setIsRecovering(false)
        return result
      } catch (error) {
        const parsedError = parseError(error)
        
        // Don't retry if error is not recoverable
        if (!recoverableErrors.includes(parsedError.code as ErrorCode)) {
          throw error
        }
        
        // Don't retry on last attempt
        if (i === maxRetries) {
          throw error
        }
        
        // Calculate delay
        const delay = options?.backoffStrategy === 'exponential' 
          ? 1000 * Math.pow(2, i)
          : 1000 * (i + 1)
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw new AppError(ERROR_CODES.SYS_SERVER_ERROR, 500, undefined, 'Maximum retries exceeded')
  }, [operation, options])

  return {
    execute: executeWithRecovery,
    attempt,
    isRecovering,
  }
}
```

### Contextual Error Display
```typescript
// Context-aware error display component
interface ErrorDisplayProps {
  error: unknown
  context?: 'form' | 'page' | 'inline'
  className?: string
}

export function ErrorDisplay({ error, context = 'inline', className }: ErrorDisplayProps) {
  if (!error) return null

  const parsedError = parseError(error)
  const displayType = getErrorDisplayType(parsedError.code)

  // Override display type based on context
  const finalDisplayType = context === 'form' ? 'form' : displayType

  switch (finalDisplayType) {
    case 'field':
      return (
        <p className={cn("text-sm text-destructive", className)}>
          {parsedError.message}
        </p>
      )

    case 'form':
      return (
        <div className={cn("p-4 border border-destructive/30 rounded-lg bg-destructive/5", className)}>
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="text-sm text-destructive font-medium">
                {parsedError.message}
              </p>
              {parsedError.actions && parsedError.actions.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {parsedError.actions.map((action, index) => (
                    <Button
                      key={index}
                      size="sm"
                      variant="outline"
                      onClick={() => handleErrorAction(action)}
                    >
                      {action.label || action.action}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )

    case 'toast':
      // Don't render - should be handled by toast system
      return null

    default:
      return (
        <div className={cn("text-sm text-muted-foreground", className)}>
          An error occurred
        </div>
      )
  }
}
```

This enhanced error management system provides comprehensive error handling with proper categorization, user-friendly messaging, actionable recovery options, and seamless integration across all application layers.