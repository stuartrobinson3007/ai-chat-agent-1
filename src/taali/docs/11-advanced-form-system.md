# Advanced Form System Implementation Guide

This document provides comprehensive guidance for implementing advanced form patterns including form error boundaries, form actions, async validation, form sync, and integration with TanStack Query mutations.

## 🚨 Critical Rules

- **ALWAYS use FormErrorBoundary** - Wrap forms to catch render errors gracefully
- **MUST use useFormMutation** - Bridge React Hook Form with TanStack Query mutations
- **NEVER skip async validation** - Use proper race condition handling for async field validation
- **ALWAYS use form sync patterns** - Sync form data with async-loaded data properly
- **MUST handle loading and error states** - Forms must gracefully handle all states

## ❌ Common AI Agent Mistakes

### Form Error Handling Violations
```typescript
// ❌ NEVER create forms without error boundaries
function MyForm() {
  return (
    <form onSubmit={handleSubmit}>
      {/* No error boundary - form crashes break the entire page */}
      <FormField />
    </form>
  )
}

// ❌ NEVER ignore mutation errors
const mutation = useMutation({
  mutationFn: createTodo,
  // No onError handler - errors not shown to user
})

// ✅ ALWAYS wrap forms with error boundaries
import { FormErrorBoundary } from '@/components/form'

function MyForm() {
  return (
    <FormErrorBoundary>
      <form onSubmit={handleSubmit}>
        <FormField />
      </form>
    </FormErrorBoundary>
  )
}
```

### Mutation Integration Violations
```typescript
// ❌ NEVER manually handle form errors
const mutation = useMutation({
  mutationFn: createTodo,
  onError: (error) => {
    // Manual error handling - inconsistent UX
    if (error.code === 'VAL_REQUIRED_FIELD') {
      setError('title', { message: 'Title is required' })
    }
  }
})

// ✅ ALWAYS use useFormMutation
import { useFormMutation } from '@/lib/hooks/use-form-mutation'

const mutation = useFormMutation({
  mutationFn: createTodo,
  setError: form.setError,
  onSuccess: (data) => {
    navigate({ to: `/todos/${data.id}` })
  },
})
```

### Async Validation Race Conditions
```typescript
// ❌ NEVER create async validators without proper cleanup
const validateSlug = async (slug: string) => {
  // No abort signal - race conditions possible
  return await checkSlugAvailability(slug)
}

// ✅ ALWAYS use proper async validation hooks
import { useAsyncFieldValidator } from '@/lib/hooks/use-async-field-validator'

const validateSlug = useAsyncFieldValidator(
  async (slug: string, signal?: AbortSignal) => {
    const result = await checkSlugAvailability(slug, { signal })
    return result.available || 'Slug is already taken'
  }
)
```

## ✅ Established Patterns

### 1. **Form Error Boundary**
```typescript
// File: src/components/form/form-error-boundary.tsx
import React from 'react'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'

import { ErrorBoundary } from '@/components/error-boundary'
import { Button } from '@/components/taali-ui/ui/button'

interface FormErrorBoundaryProps {
  children: React.ReactNode
  onError?: (error: Error) => void
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>
  showToast?: boolean
}

export function FormErrorBoundary({ 
  children, 
  onError,
  fallback: FallbackComponent,
  showToast = true
}: FormErrorBoundaryProps) {
  const handleError = React.useCallback((error: Error, reset: () => void) => {
    
    // Show toast for render errors
    if (showToast) {
      toast.error('Form failed to load', {
        description: 'Please refresh the page and try again'
      })
    }
    
    // Call custom error handler
    onError?.(error)
    
    // Render fallback component
    const Component = FallbackComponent || FormErrorFallback
    return <Component error={error} reset={reset} />
  }, [onError, FallbackComponent, showToast])
  
  return (
    <ErrorBoundary fallback={handleError}>
      {children}
    </ErrorBoundary>
  )
}

function FormErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6 border border-destructive/30 rounded-lg bg-destructive/5">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-destructive">Form Error</h3>
          <p className="text-sm text-muted-foreground mt-1">
            The form encountered an error and cannot be displayed.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-3">
              <summary className="text-xs text-muted-foreground cursor-pointer">
                Error details (development only)
              </summary>
              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                {error.message}
              </pre>
            </details>
          )}
          <Button 
            onClick={reset} 
            className="mt-4" 
            variant="outline"
            size="sm"
          >
            Try Again
          </Button>
        </div>
      </div>
    </div>
  )
}
```

### 2. **Form Actions Component**
```typescript
// File: src/components/form/form-actions.tsx
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/taali-ui/ui/button'

interface FormActionsProps {
  isSubmitting?: boolean
  isDirty?: boolean
  submitLabel?: string
  cancelLabel?: string
  onCancel?: () => void
  showCancel?: boolean
  className?: string
}

export function FormActions({
  isSubmitting = false,
  isDirty = false,
  submitLabel = 'Save Changes',
  cancelLabel = 'Cancel',
  onCancel,
  showCancel = true,
  className = ''
}: FormActionsProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Button 
        type="submit" 
        disabled={isSubmitting || !isDirty}
      >
        {isSubmitting && <Loader2 className="animate-spin" />}
        {isSubmitting ? 'Saving...' : submitLabel}
      </Button>
      
      {showCancel && onCancel && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {cancelLabel}
        </Button>
      )}
    </div>
  )
}
```

### 3. **Form Mutation Hook**
```typescript
// File: src/lib/hooks/use-form-mutation.ts
import { useMutation } from '@tanstack/react-query'
import { UseFormSetError, FieldValues, Path } from 'react-hook-form'
import { toast } from 'sonner'

import { ValidationError, isAppError } from '@/lib/utils/errors'
import { parseError } from '@/lib/errors/client-handler'
import { getErrorDisplayType } from '@/lib/errors/error-categories'

interface UseFormMutationOptions<TData = unknown, TVariables = unknown, TFieldValues extends FieldValues = FieldValues> {
  mutationFn: (variables: TVariables) => Promise<TData>
  setError: UseFormSetError<TFieldValues>
  onSuccess?: (data: TData) => void
  onError?: (error: unknown) => void
  showToast?: boolean
}

export function useFormMutation<TData = unknown, TVariables = unknown, TFieldValues extends FieldValues = FieldValues>({
  mutationFn,
  setError,
  onSuccess,
  onError,
  showToast = true
}: UseFormMutationOptions<TData, TVariables, TFieldValues>) {
  return useMutation({
    mutationFn,
    onSuccess,
    onError: (error) => {
      const parsed = parseError(error)
      
      // SCENARIO 1: Backend field-level validation errors
      if (error instanceof ValidationError && error.context?.fields) {
        // Map each field error to the correct form field
        Object.entries(error.context.fields).forEach(([field, message]) => {
          setError(field as Path<TFieldValues>, {
            type: 'server',
            message: Array.isArray(message) ? message[0] : message
          })
        })
        
        // If there are field errors, don't show additional notifications
        return onError?.(error)
      }
      
      // SCENARIO 2: General errors - route based on error type
      const displayType = getErrorDisplayType(parsed.code)
      
      switch (displayType) {
        case 'field':
        case 'form':
          // Show in form error area
          setError('root', {
            type: 'server',
            message: parsed.message
          })
          break
          
        case 'toast':
          // Show as toast notification
          if (showToast) {
            if (isAppError(error) && error.actions?.length) {
              const action = error.actions[0]
              toast.error(parsed.message, {
                description: 'Please try again or contact support if the issue persists.',
                action: action.label ? {
                  label: action.label,
                  onClick: () => {
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
                    }
                  }
                } : undefined
              })
            } else {
              toast.error(parsed.message)
            }
          }
          break
      }
      
      // Always call custom error handler if provided
      onError?.(error)
    }
  })
}
```

### 4. **Async Field Validation**
```typescript
// File: src/lib/hooks/use-async-field-validator.ts
import { useCallback, useRef, useEffect } from 'react'

export function useAsyncFieldValidator<T>(
  validationFn: (value: T, signal?: AbortSignal) => Promise<boolean | string>,
  deps: React.DependencyList = []
) {
  const abortControllerRef = useRef<AbortController | undefined>(undefined)
  
  const validate = useCallback(async (value: T) => {
    // Cancel any in-flight validation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new controller for this validation
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal
    
    try {
      const result = await validationFn(value, signal)
      
      // Check if this validation was cancelled
      if (signal.aborted) {
        return true // Return valid if cancelled (don't show stale errors)
      }
      
      return result
    } catch (error: unknown) {
      // Handle abort errors gracefully
      if ((error as Error)?.name === 'AbortError') {
        return true // Valid if aborted
      }
      
      // Log unexpected errors for debugging
      console.error('Async validation error:', error)
      
      // Return a user-friendly error message
      return 'Validation failed. Please try again.'
    }
  }, [validationFn, ...deps])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])
  
  return validate
}

// Debounced version for better UX
export function useDebouncedAsyncValidator<T>(
  validationFn: (value: T, signal?: AbortSignal) => Promise<boolean | string>,
  debounceMs: number = 500,
  deps: React.DependencyList = []
) {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const validator = useAsyncFieldValidator(validationFn, deps)
  
  const debouncedValidate = useCallback((value: T) => {
    return new Promise<boolean | string>((resolve) => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      // Set new timeout
      timeoutRef.current = setTimeout(async () => {
        const result = await validator(value)
        resolve(result)
      }, debounceMs)
    })
  }, [validator, debounceMs])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return debouncedValidate
}
```

### 5. **Form Sync Hook**
```typescript
// File: src/lib/hooks/use-form-sync.ts
import { useEffect, useRef } from 'react'
import { UseFormReset, FieldValues } from 'react-hook-form'

interface FormWithReset<T extends FieldValues> {
  reset: UseFormReset<T>
}

export function useFormSync<T extends FieldValues>(
  form: FormWithReset<T>,
  data: T | null | undefined,
  dependencies: React.DependencyList = []
) {
  const previousDataRef = useRef<T | null | undefined>(undefined)
  
  useEffect(() => {
    // Skip if data hasn't changed
    if (data === previousDataRef.current) {
      return
    }
    
    // Skip if data is null/undefined (still loading)
    if (!data) {
      return
    }
    
    // Deep comparison to avoid unnecessary resets
    const dataChanged = JSON.stringify(data) !== JSON.stringify(previousDataRef.current)
    
    if (dataChanged) {
      form.reset(data)
      previousDataRef.current = data
    }
  }, [data, form.reset, ...dependencies])
}

// Version with sync status tracking
export function useFormSyncWithStatus<T extends FieldValues>(
  form: FormWithReset<T>,
  data: T | null | undefined,
  dependencies: React.DependencyList = []
) {
  const isSyncedRef = useRef<boolean>(false)
  const previousDataRef = useRef<T | null | undefined>(undefined)
  
  useEffect(() => {
    if (!data) {
      isSyncedRef.current = false
      return
    }
    
    const dataChanged = JSON.stringify(data) !== JSON.stringify(previousDataRef.current)
    
    if (dataChanged) {
      form.reset(data)
      previousDataRef.current = data
      isSyncedRef.current = true
    }
  }, [data, form.reset, ...dependencies])
  
  return {
    isSynced: isSyncedRef.current,
    isLoading: !data,
    data
  }
}
```

## 🔧 Step-by-Step Implementation

### 1. **Complete Form Implementation Pattern**
```typescript
// Template for advanced form implementation
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'

import { FormErrorBoundary, FormActions, Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/form'
import { useFormMutation } from '@/lib/hooks/use-form-mutation'
import { useFormSync } from '@/lib/hooks/use-form-sync'
import { useAsyncFieldValidator } from '@/lib/hooks/use-async-field-validator'
import { Input } from '@/ui/input'
import { Textarea } from '@/ui/textarea'

const formSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Invalid slug format'),
  description: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface AdvancedFormProps {
  itemId?: string
  onSuccess?: (data: any) => void
  onCancel?: () => void
}

function AdvancedForm({ itemId, onSuccess, onCancel }: AdvancedFormProps) {
  // 1. Initialize form with validation
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      slug: '',
      description: '',
    },
  })

  // 2. Load existing data if editing
  const { data: existingData, isLoading } = useQuery({
    queryKey: ['item', itemId],
    queryFn: () => getItemById(itemId!),
    enabled: !!itemId,
  })

  // 3. Sync form with loaded data
  useFormSync(form, existingData)

  // 4. Setup async validation for slug field
  const validateSlug = useAsyncFieldValidator(
    async (slug: string, signal?: AbortSignal) => {
      if (!slug || slug.length < 3) return true // Skip validation for empty/short values
      
      const result = await checkSlugAvailability({ slug }, { signal })
      return result.available || 'Slug is already taken'
    },
    [itemId] // Re-validate if itemId changes
  )

  // 5. Setup mutation with proper error handling
  const mutation = useFormMutation({
    mutationFn: itemId ? updateItem : createItem,
    setError: form.setError,
    onSuccess: (data) => {
      toast.success(itemId ? 'Item updated successfully' : 'Item created successfully')
      onSuccess?.(data)
    },
    onError: (error) => {
      console.error('Form submission failed:', error)
    },
  })

  // 6. Form submission handler
  const onSubmit = async (data: FormData) => {
    const payload = itemId ? { ...data, id: itemId } : data
    await mutation.mutateAsync(payload)
  }

  if (isLoading && itemId) {
    return <div>Loading...</div>
  }

  return (
    <FormErrorBoundary onError={(error) => console.error('Form error:', error)}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Title Field */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Enter title..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Slug Field with Async Validation */}
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="enter-slug-here" 
                    {...field}
                    onBlur={async () => {
                      // Trigger async validation on blur
                      const result = await validateSlug(field.value)
                      if (result !== true) {
                        form.setError('slug', {
                          type: 'async',
                          message: result,
                        })
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description Field */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Enter description..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Form Actions */}
          <FormActions
            isSubmitting={mutation.isPending}
            isDirty={form.formState.isDirty}
            submitLabel={itemId ? 'Update Item' : 'Create Item'}
            onCancel={onCancel}
            showCancel={!!onCancel}
          />

          {/* Form Root Error */}
          {form.formState.errors.root && (
            <div className="p-4 border border-destructive/30 rounded-lg bg-destructive/5">
              <p className="text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
            </div>
          )}
        </form>
      </Form>
    </FormErrorBoundary>
  )
}
```

### 6. **Autosave Form Pattern**
```typescript
// Example: Todo edit form with autosave
import { useFormAutosave } from '@/lib/hooks/use-form-autosave'
import { SaveStatusIndicator } from '@/components/save-status-indicator'

function EditTodoForm({ todo }: { todo: Todo }) {
  const { activeOrganizationId } = useActiveOrganization()
  const { t } = useTranslation('todos')

  // Validation function
  const validateTodo = useCallback((data: EditTodoData) => {
    const errors: string[] = []
    
    if (!data.title.trim()) {
      errors.push(t('validation:titleRequired'))
    }
    
    if (data.title.length > 500) {
      errors.push(t('validation:titleTooLong'))
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }, [t])

  // Setup autosave with validation
  const {
    data: formData,
    updateField,
    isSaving,
    lastSaved,
    saveNow,
    isDirty,
    errors,
  } = useFormAutosave<EditTodoData>({
    initialData: {
      title: todo.title,
      description: todo.description || '',
      priority: todo.priority,
    },
    validate: validateTodo,
    onSave: async (data) => {
      const updated = await updateTodo({
        id: todo.id,
        ...data,
      })
      return updated
    },
    enabled: !!todo && !!activeOrganizationId,
    debounceMs: 2000,
  })

  return (
    <FormErrorBoundary>
      <div className="space-y-6">
        {/* Save Status */}
        <SaveStatusIndicator
          isSaving={isSaving}
          lastSaved={lastSaved}
          isDirty={isDirty}
          errors={errors}
        />

        {/* Form Fields */}
        <div className="space-y-4">
          <div>
            <label htmlFor="title">Title</label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              onBlur={saveNow} // Save on blur for better UX
              className={errors.length > 0 ? 'border-destructive' : ''}
            />
            {errors.map((error, index) => (
              <p key={index} className="text-sm text-destructive mt-1">
                {error}
              </p>
            ))}
          </div>

          <div>
            <label htmlFor="description">Description</label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              onBlur={saveNow}
            />
          </div>
        </div>
      </div>
    </FormErrorBoundary>
  )
}
```

## 🎯 Integration Requirements

### With TanStack Query
```typescript
// Forms must integrate properly with query invalidation
const createMutation = useFormMutation({
  mutationFn: createTodo,
  setError: form.setError,
  onSuccess: (data) => {
    // Invalidate related queries
    queryClient.invalidateQueries({ queryKey: ['todos'] })
    
    // Redirect or show success
    navigate({ to: `/todos/${data.id}` })
  },
})
```

### With Organization Context
```typescript
// Forms must respect organization scoping
function OrganizationForm() {
  const { activeOrganizationId } = useActiveOrganization()
  
  // Disable form if no organization
  if (!activeOrganizationId) {
    return <div>Please select an organization first</div>
  }

  // Form implementation with organization context
}
```

### With Permission System
```typescript
// Forms must check permissions
function EditForm({ item }: { item: Todo }) {
  const { canUpdate } = useClientPermissions()
  
  const canEdit = canUpdate('todos')
  
  return (
    <Form>
      {!canEdit && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">You don't have permission to edit this item.</p>
        </div>
      )}
      
      <Input disabled={!canEdit} />
      <FormActions 
        isSubmitting={mutation.isPending}
        isDirty={form.formState.isDirty && canEdit}
      />
    </Form>
  )
}
```

## 🧪 Testing Requirements

### Form Component Testing
```typescript
// Test form error boundary
import { render, screen } from '@testing-library/react'
import { FormErrorBoundary } from '@/components/form'

const ThrowingForm = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Form render error')
  }
  return <div>Form content</div>
}

describe('FormErrorBoundary', () => {
  it('should catch form render errors', () => {
    render(
      <FormErrorBoundary>
        <ThrowingForm shouldThrow={true} />
      </FormErrorBoundary>
    )

    expect(screen.getByText('Form Error')).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })
})
```

### Form Mutation Testing
```typescript
// Test form mutation integration
import { renderHook } from '@testing-library/react'
import { useFormMutation } from '@/lib/hooks/use-form-mutation'

describe('useFormMutation', () => {
  it('should map validation errors to form fields', async () => {
    const mockSetError = vi.fn()
    const mockMutation = vi.fn().mockRejectedValue(
      new ValidationError(
        { title: ['VAL_REQUIRED_FIELD'], email: ['VAL_INVALID_FORMAT'] },
        'Validation failed'
      )
    )

    const { result } = renderHook(() =>
      useFormMutation({
        mutationFn: mockMutation,
        setError: mockSetError,
      })
    )

    await result.current.mutateAsync({ title: '', email: 'invalid' })

    expect(mockSetError).toHaveBeenCalledWith('title', expect.any(Object))
    expect(mockSetError).toHaveBeenCalledWith('email', expect.any(Object))
  })
})
```

### Async Validation Testing
```typescript
// Test async validation with race conditions
describe('useAsyncFieldValidator', () => {
  it('should handle validation cancellation', async () => {
    let resolveValidation: (result: boolean) => void
    const mockValidation = vi.fn(() => 
      new Promise<boolean>((resolve) => {
        resolveValidation = resolve
      })
    )

    const { result } = renderHook(() =>
      useAsyncFieldValidator(mockValidation)
    )

    // Start first validation
    const firstValidation = result.current('test1')
    
    // Start second validation (should cancel first)
    const secondValidation = result.current('test2')

    // Resolve first validation after cancellation
    resolveValidation!(false)

    // Second validation should still work
    expect(await firstValidation).toBe(true) // Cancelled returns true
    expect(await secondValidation).toBe(false)
  })
})
```

## 📋 Implementation Checklist

Before considering advanced form system complete, verify:

- [ ] **Error Boundaries**: All forms wrapped with FormErrorBoundary
- [ ] **Mutation Integration**: useFormMutation used for form submissions
- [ ] **Async Validation**: Proper race condition handling for async validators
- [ ] **Form Sync**: Data synchronization with async-loaded data
- [ ] **Loading States**: Proper loading indicators and disabled states
- [ ] **Permission Integration**: Forms respect user permissions
- [ ] **Organization Context**: Forms work within organization scope
- [ ] **Error Display**: Consistent error messaging and display
- [ ] **Accessibility**: Proper ARIA labels and form validation
- [ ] **TypeScript**: Full type safety throughout form system

## 🚀 Advanced Patterns

### Complex Multi-Step Forms
```typescript
// Multi-step form with state persistence
function MultiStepForm() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({})

  const steps = [
    { component: BasicInfoStep, validation: basicInfoSchema },
    { component: ContactStep, validation: contactSchema },
    { component: ReviewStep, validation: reviewSchema },
  ]

  const currentStepData = steps[currentStep - 1]

  return (
    <FormErrorBoundary>
      <div className="space-y-6">
        <StepIndicator currentStep={currentStep} totalSteps={steps.length} />
        
        <currentStepData.component
          data={formData}
          onUpdate={setFormData}
          onNext={() => setCurrentStep(prev => prev + 1)}
          onPrev={() => setCurrentStep(prev => prev - 1)}
        />
      </div>
    </FormErrorBoundary>
  )
}
```

### Real-time Collaborative Forms
```typescript
// Form with real-time updates via WebSocket
function CollaborativeForm({ documentId }: { documentId: string }) {
  const [collaborators, setCollaborators] = useState([])
  
  const autosave = useFormAutosave({
    initialData: document,
    onSave: async (data) => {
      // Save and broadcast changes
      const result = await updateDocument(data)
      broadcastChange(documentId, result)
      return result
    },
    debounceMs: 1000, // Faster autosave for collaboration
  })

  // Listen for real-time updates
  useEffect(() => {
    const subscription = subscribeToDocument(documentId, (update) => {
      if (update.userId !== currentUserId) {
        autosave.reset(update.data)
        setCollaborators(update.collaborators)
      }
    })

    return () => subscription.unsubscribe()
  }, [documentId])

  return (
    <FormErrorBoundary>
      <div className="space-y-4">
        <CollaboratorIndicator collaborators={collaborators} />
        <FormContent {...autosave} />
      </div>
    </FormErrorBoundary>
  )
}
```

This advanced form system provides comprehensive form handling with error boundaries, async validation, mutation integration, and real-time synchronization capabilities for building sophisticated user interfaces.