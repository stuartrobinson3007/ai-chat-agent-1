# Advanced Hook Patterns Implementation Guide

This document provides comprehensive guidance for implementing advanced React hook patterns including provider composition, page context management, loading state hooks, form mutations, and async field validation.

## 🚨 Critical Rules

- **ALWAYS use provider composition patterns** - Never nest providers arbitrarily
- **MUST handle hook dependencies properly** - Use exhaustive-deps ESLint rules correctly
- **NEVER create memory leaks** - Always cleanup subscriptions and abort controllers
- **ALWAYS use proper hook ordering** - Follow React Rules of Hooks consistently
- **MUST provide stable references** - Use useCallback and useMemo appropriately

## ❌ Common AI Agent Mistakes

### Provider Composition Violations
```typescript
// ❌ NEVER nest providers without proper composition
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <AuthQueryProvider>
          <OrganizationProvider>
            {/* Deeply nested providers - hard to maintain */}
            <PageContextProvider>
              <MyApp />
            </PageContextProvider>
          </OrganizationProvider>
        </AuthQueryProvider>
      </I18nextProvider>
    </QueryClientProvider>
  )
}

// ✅ ALWAYS use centralized provider composition
import { Providers } from '@/lib/hooks/providers'

function App() {
  return (
    <Providers>
      <MyApp />
    </Providers>
  )
}
```

### Hook Dependency Violations
```typescript
// ❌ NEVER ignore exhaustive-deps warnings without proper ESLint directives
useEffect(() => {
  fetchData(externalValue)
}, []) // Missing dependency - potential stale closure

// ❌ NEVER use useCallback without proper dependencies
const memoizedFunction = useCallback(() => {
  return processData(externalState)
}, []) // Missing dependency - stale closures

// ✅ ALWAYS handle dependencies properly
useEffect(() => {
  fetchData(externalValue)
}, [externalValue])

// ✅ Use ESLint directives when dependencies are intentionally spread
useEffect(() => {
  performAction(value, ...spreadDeps)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- spreadDeps are passed as spread parameter
}, [value, ...spreadDeps])
```

### Memory Leak Violations
```typescript
// ❌ NEVER forget cleanup in custom hooks
export function useBadAsyncValidator(validationFn) {
  const validate = useCallback(async (value) => {
    const controller = new AbortController()
    return validationFn(value, controller.signal)
    // Missing cleanup - controllers accumulate!
  }, [validationFn])
  
  return validate
}

// ✅ ALWAYS cleanup properly
export function useAsyncFieldValidator(validationFn, deps = []) {
  const abortControllerRef = useRef<AbortController | undefined>(undefined)
  
  const validate = useCallback(async (value) => {
    // Cancel previous validation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new controller
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal
    
    return validationFn(value, signal)
  }, [validationFn, ...deps])
  
  // REQUIRED: Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])
  
  return validate
}
```

## ✅ Established Patterns

### 1. **Provider Composition System**
```typescript
// File: src/lib/hooks/providers.tsx
import { AuthQueryProvider } from '@daveyplate/better-auth-tanstack'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'

import { PageContextProvider } from './page-context'
import { OrganizationProvider } from '@/features/organization/lib/organization-context'
import i18n from '@/i18n/config'
import { createQueryClient } from '@/lib/errors/query-client'

// Create query client with error handling
export const queryClient = createQueryClient()

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <AuthQueryProvider>
          <OrganizationProvider>
            <PageContextProvider>
              {children}
            </PageContextProvider>
          </OrganizationProvider>
        </AuthQueryProvider>
      </I18nextProvider>
    </QueryClientProvider>
  )
}
```

### 2. **Page Context Management**
```typescript
// File: src/lib/hooks/page-context.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from '@tanstack/react-router'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageContextValue {
  title: string
  setTitle: (title: string) => void
  breadcrumbs: BreadcrumbItem[]
  setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void
  actions: ReactNode
  setActions: (actions: ReactNode) => void
  customBreadcrumb: ReactNode
  setCustomBreadcrumb: (breadcrumb: ReactNode) => void
  reset: () => void
}

const PageContext = createContext<PageContextValue | null>(null)

export function PageContextProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState('')
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([])
  const [actions, setActions] = useState<ReactNode>(null)
  const [customBreadcrumb, setCustomBreadcrumb] = useState<ReactNode>(null)
  const router = useRouter()

  // Reset context on route change
  useEffect(() => {
    const reset = () => {
      setTitle('')
      setBreadcrumbs([])
      setActions(null)
      setCustomBreadcrumb(null)
    }

    // Reset when route changes
    return router.subscribe('onBeforeLoad', reset)
  }, [router])

  const reset = () => {
    setTitle('')
    setBreadcrumbs([])
    setActions(null)
    setCustomBreadcrumb(null)
  }

  return (
    <PageContext.Provider
      value={{
        title,
        setTitle,
        breadcrumbs,
        setBreadcrumbs,
        actions,
        setActions,
        customBreadcrumb,
        setCustomBreadcrumb,
        reset,
      }}
    >
      {children}
    </PageContext.Provider>
  )
}

export function usePageContext() {
  const context = useContext(PageContext)
  if (!context) {
    throw new Error('usePageContext must be used within a PageContextProvider')
  }
  return context
}

// Hook to set page metadata
export function useSetPageMeta(
  meta: {
    title?: string
    breadcrumbs?: BreadcrumbItem[]
    actions?: ReactNode
    customBreadcrumb?: ReactNode
  },
  deps: React.DependencyList = []
) {
  const context = usePageContext()

  useEffect(() => {
    if (meta.title !== undefined) {
      context.setTitle(meta.title)
    }
    if (meta.breadcrumbs !== undefined) {
      context.setBreadcrumbs(meta.breadcrumbs)
    }
    if (meta.actions !== undefined) {
      context.setActions(meta.actions)
    }
    if (meta.customBreadcrumb !== undefined) {
      context.setCustomBreadcrumb(meta.customBreadcrumb)
    }

    return () => {
      context.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are passed as spread parameter
  }, [meta, context, ...deps])
}
```

### 3. **Loading State Management Hooks**
```typescript
// File: src/lib/hooks/use-loading-state.ts
import { useState, useCallback } from 'react'

import errorTranslations from '@/i18n/locales/en/errors.json'

// Hook for managing loading states of individual items
export function useLoadingItems<T = string>() {
  const [loadingItems, setLoadingItems] = useState<Set<T>>(new Set())

  const startLoading = useCallback((id: T) => {
    setLoadingItems(prev => new Set(prev).add(id))
  }, [])

  const stopLoading = useCallback((id: T) => {
    setLoadingItems(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const isLoading = useCallback(
    (id: T) => {
      return loadingItems.has(id)
    },
    [loadingItems]
  )

  const clearAll = useCallback(() => {
    setLoadingItems(new Set())
  }, [])

  return {
    loadingItems,
    startLoading,
    stopLoading,
    isLoading,
    clearAll,
  }
}

// Hook for wrapping async actions with loading state
export function useAsyncAction<TArgs extends unknown[], TReturn = void>(
  action: (...args: TArgs) => Promise<TReturn>,
  options?: {
    onSuccess?: (result: TReturn) => void
    onError?: (error: Error) => void
  }
) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(
    async (...args: TArgs): Promise<TReturn | undefined> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await action(...args)
        options?.onSuccess?.(result)
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error(errorTranslations.server.genericError)
        setError(error)
        options?.onError?.(error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [action, options]
  )

  return {
    execute,
    isLoading,
    error,
    reset: () => setError(null),
  }
}

// Hook for managing multiple concurrent loading states
export function useMultipleLoadingStates() {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})

  const setLoading = useCallback((key: string, isLoading: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: isLoading,
    }))
  }, [])

  const isLoading = useCallback(
    (key: string) => {
      return loadingStates[key] || false
    },
    [loadingStates]
  )

  const isAnyLoading = useCallback(() => {
    return Object.values(loadingStates).some(state => state)
  }, [loadingStates])

  const clearAll = useCallback(() => {
    setLoadingStates({})
  }, [])

  return {
    setLoading,
    isLoading,
    isAnyLoading,
    clearAll,
    loadingStates,
  }
}
```

### 4. **Form Autosave Hook (Advanced)**
```typescript
// File: src/lib/hooks/use-form-autosave.tsx (Enhanced version)
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { debounce } from 'lodash'

import errorTranslations from '@/i18n/locales/en/errors.json'

interface UseFormAutosaveOptions<T> {
  initialData: T
  onSave: (data: T) => Promise<void | T>
  debounceMs?: number
  enabled?: boolean
  validate?: (data: T) => { isValid: boolean; errors: string[] }
  compareFunction?: (a: T, b: T) => boolean
}

interface UseFormAutosaveResult<T> {
  data: T
  updateField: <K extends keyof T>(field: K, value: T[K]) => void
  updateData: (data: Partial<T>) => void
  isSaving: boolean
  lastSaved: Date | null
  saveNow: () => Promise<void>
  isDirty: boolean
  errors: string[]
  reset: (newData?: T) => void
}

export function useFormAutosave<T extends Record<string, unknown>>({
  initialData,
  onSave,
  debounceMs = 3000,
  enabled = true,
  validate,
  compareFunction,
}: UseFormAutosaveOptions<T>): UseFormAutosaveResult<T> {
  const [data, setData] = useState<T>(initialData)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const lastSavedDataRef = useRef<T>(initialData)
  const savePromiseRef = useRef<Promise<void> | null>(null)
  const mountedRef = useRef(true)
  const isInitializedRef = useRef(false)

  // Check if data is different from last saved
  const isDirty = useCallback(() => {
    if (compareFunction) {
      return !compareFunction(data, lastSavedDataRef.current)
    }
    return JSON.stringify(data) !== JSON.stringify(lastSavedDataRef.current)
  }, [data, compareFunction])

  // Save function with proper error handling
  const performSave = useCallback(async () => {
    if (!enabled || !isDirty()) {
      return
    }

    // Validate if validator provided
    if (validate) {
      const validation = validate(data)
      if (!validation.isValid) {
        setErrors(validation.errors)
        return
      }
      setErrors([])
    }

    // Prevent concurrent saves
    if (savePromiseRef.current) {
      await savePromiseRef.current
    }

    setIsSaving(true)

    const savePromise = (async () => {
      try {
        const result = await onSave(data)

        if (!mountedRef.current) return

        // If onSave returns normalized data, use it
        const savedData = result || data
        lastSavedDataRef.current = savedData as T
        setData(savedData as T)
        setLastSaved(new Date())
        setErrors([])
      } catch (error) {
        if (!mountedRef.current) return

        const message = error instanceof Error ? error.message : errorTranslations.server.saveFailed
        setErrors([message])
        console.error('Autosave failed:', error)
      } finally {
        if (mountedRef.current) {
          setIsSaving(false)
          savePromiseRef.current = null
        }
      }
    })()

    savePromiseRef.current = savePromise
    await savePromise
  }, [data, enabled, isDirty, validate, onSave])

  // Debounced save with stable reference
  const debouncedSave = useMemo(
    () =>
      debounce(() => {
        performSave()
      }, debounceMs),
    [performSave, debounceMs]
  )

  // Field update functions
  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setData(prev => {
      const updated = { ...prev, [field]: value }
      return updated
    })
  }, [])

  const updateData = useCallback((updates: Partial<T>) => {
    setData(prev => ({ ...prev, ...updates }))
  }, [])

  const saveNow = useCallback(async () => {
    debouncedSave.cancel()
    await performSave()
  }, [debouncedSave, performSave])

  const reset = useCallback(
    (newData?: T) => {
      const dataToSet = newData || initialData
      setData(dataToSet)
      lastSavedDataRef.current = dataToSet
      setLastSaved(null)
      setErrors([])
      debouncedSave.cancel()
      isInitializedRef.current = true
    },
    [initialData, debouncedSave]
  )

  // Auto-save trigger
  useEffect(() => {
    if (enabled && isDirty()) {
      debouncedSave()
    }
  }, [data, enabled, isDirty, debouncedSave])

  // Initialize data
  useEffect(() => {
    if (!isInitializedRef.current) {
      setData(initialData)
      lastSavedDataRef.current = initialData
      isInitializedRef.current = true
    }
  }, [initialData])

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      isInitializedRef.current = false
      debouncedSave.cancel()
    }
  }, [debouncedSave])

  return {
    data,
    updateField,
    updateData,
    isSaving,
    lastSaved,
    saveNow,
    isDirty: isDirty(),
    errors,
    reset,
  }
}
```

### 5. **Advanced Hook Composition**
```typescript
// Complex hook that combines multiple patterns
export function useAdvancedTodoForm(todoId?: string) {
  const { activeOrganizationId } = useActiveOrganization()
  const queryClient = useQueryClient()
  const { showError, showSuccess } = useErrorHandler()

  // Load existing todo data
  const { data: todo, isLoading } = useQuery({
    queryKey: ['todos', todoId],
    queryFn: () => getTodoById({ id: todoId! }),
    enabled: !!todoId,
  })

  // Form with validation
  const form = useForm<TodoFormData>({
    resolver: zodResolver(todoFormSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
    },
  })

  // Sync form with loaded data
  useFormSync(form, todo)

  // Async slug validation
  const validateSlug = useAsyncFieldValidator(
    async (slug: string, signal?: AbortSignal) => {
      if (!slug || slug.length < 3) return true
      
      const result = await checkSlugAvailability({ slug }, { signal })
      return result.available || 'Slug is already taken'
    },
    [todoId]
  )

  // Mutation with form integration
  const mutation = useFormMutation({
    mutationFn: todoId ? updateTodo : createTodo,
    setError: form.setError,
    onSuccess: (data) => {
      showSuccess(todoId ? 'Todo updated' : 'Todo created')
      
      // Invalidate queries
      queryClient.invalidateQueries({ 
        queryKey: ['todos'] 
      })
    },
    onError: showError,
  })

  // Autosave for edit mode
  const autosave = useFormAutosave({
    initialData: todo || form.getValues(),
    onSave: async (data) => {
      if (!todoId) return data // Don't autosave for new todos
      
      const result = await updateTodo({ id: todoId, ...data })
      return result
    },
    enabled: !!todo && !!activeOrganizationId,
    debounceMs: 2000,
    validate: (data) => {
      const validation = todoFormSchema.safeParse(data)
      return {
        isValid: validation.success,
        errors: validation.error?.issues.map(issue => issue.message) || [],
      }
    },
  })

  // Loading states
  const { loadingItems, startLoading, stopLoading, isLoading: isItemLoading } = useLoadingItems<string>()

  return {
    // Form state
    form,
    isLoading: isLoading || mutation.isPending,
    
    // Mutation
    mutation,
    onSubmit: form.handleSubmit(mutation.mutate),
    
    // Autosave (for edit mode)
    autosave: todoId ? autosave : undefined,
    
    // Validation
    validateSlug,
    
    // Loading management
    loadingItems,
    startLoading,
    stopLoading,
    isItemLoading,
    
    // Helpers
    canSubmit: form.formState.isValid && !mutation.isPending,
    hasChanges: form.formState.isDirty || (autosave?.isDirty ?? false),
  }
}
```

## 🔧 Step-by-Step Implementation

### 1. **Creating Custom Hook with Cleanup**
```typescript
// Template for hooks with proper cleanup
export function useCustomHook<T>(
  initialValue: T,
  dependencies: React.DependencyList = []
) {
  const [state, setState] = useState<T>(initialValue)
  const cleanupRef = useRef<(() => void) | undefined>(undefined)
  const mountedRef = useRef(true)

  // Main hook logic
  const performAction = useCallback(async (value: T) => {
    if (!mountedRef.current) return

    // Cleanup previous action if needed
    if (cleanupRef.current) {
      cleanupRef.current()
    }

    // Setup new action with cleanup
    const cleanup = () => {
      // Cleanup logic
    }
    
    cleanupRef.current = cleanup

    try {
      // Perform action
      setState(value)
    } catch (error) {
      console.error('Hook action failed:', error)
    }
  }, [/* dependencies */])

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [])

  // Dependency effects
  useEffect(() => {
    performAction(initialValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dependencies are spread
  }, [initialValue, ...dependencies])

  return {
    state,
    performAction,
    isReady: mountedRef.current,
  }
}
```

### 2. **Provider Setup in Root**
```typescript
// File: src/routes/__root.tsx
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { ThemeProvider } from 'next-themes'

import { Providers } from '@/lib/hooks/providers'
import { SuperAdminWrapper, useSuperAdminWrapper } from '@/features/admin/components/super-admin-wrapper'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Providers>
        <AppWithAdminWrapper />
      </Providers>
    </ThemeProvider>
  )
}

function AppWithAdminWrapper() {
  const adminState = useSuperAdminWrapper()
  
  return (
    <>
      <SuperAdminWrapper {...adminState} />
      <Outlet />
    </>
  )
}
```

### 3. **Page Context Usage**
```typescript
// Using page context in components
import { useSetPageMeta } from '@/lib/hooks/page-context'

function TodoEditPage({ todo }: { todo: Todo }) {
  const { t } = useTranslation('todos')

  // Set page metadata
  useSetPageMeta({
    title: todo.title,
    breadcrumbs: [
      { label: t('title'), href: '/todos' },
      { label: 'Edit Todo' },
    ],
    actions: (
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => navigate({ to: '/todos' })}>
          Cancel
        </Button>
        <Button onClick={saveAndClose}>
          Save & Close
        </Button>
      </div>
    ),
  }, [todo.title, t])

  return (
    <div>
      {/* Page content */}
    </div>
  )
}
```

## 🎯 Integration Requirements

### With TanStack Query
```typescript
// Hooks must integrate properly with TanStack Query
const useOptimisticTodos = () => {
  const queryClient = useQueryClient()
  
  const { loadingItems, startLoading, stopLoading } = useLoadingItems<string>()
  
  const deleteTodoOptimistic = useCallback(async (todoId: string) => {
    startLoading(todoId)
    
    try {
      // Optimistic update
      queryClient.setQueryData(['todos'], (old: Todo[] = []) =>
        old.map(todo => 
          todo.id === todoId ? { ...todo, isDeleting: true } : todo
        )
      )
      
      await deleteTodo({ id: todoId })
      
      // Remove from cache
      queryClient.setQueryData(['todos'], (old: Todo[] = []) =>
        old.filter(todo => todo.id !== todoId)
      )
    } catch (error) {
      // Revert optimistic update
      queryClient.invalidateQueries({ queryKey: ['todos'] })
      throw error
    } finally {
      stopLoading(todoId)
    }
  }, [queryClient, startLoading, stopLoading])

  return {
    deleteTodoOptimistic,
    loadingItems,
    isDeleting: (id: string) => loadingItems.has(id),
  }
}
```

### With Router System
```typescript
// Hooks that integrate with TanStack Router
export function useRouteData<T>() {
  const router = useRouter()
  const [routeData, setRouteData] = useState<T | null>(null)

  useEffect(() => {
    const subscription = router.subscribe('onLoad', ({ matches }) => {
      const data = matches[matches.length - 1]?.loaderData as T
      setRouteData(data)
    })

    return subscription
  }, [router])

  return routeData
}
```

## 🧪 Testing Requirements

### Hook Testing with Cleanup
```typescript
// Test hooks with proper cleanup validation
import { renderHook } from '@testing-library/react'
import { useAsyncFieldValidator } from '@/lib/hooks/use-async-field-validator'

describe('useAsyncFieldValidator', () => {
  it('should cleanup on unmount', () => {
    const abortSpy = vi.fn()
    const mockValidation = vi.fn()

    const { unmount } = renderHook(() =>
      useAsyncFieldValidator(mockValidation)
    )

    // Mock abort controller
    vi.spyOn(window, 'AbortController').mockImplementation(() => ({
      signal: {} as AbortSignal,
      abort: abortSpy,
    }))

    unmount()

    expect(abortSpy).toHaveBeenCalled()
  })

  it('should handle race conditions', async () => {
    const { result } = renderHook(() =>
      useAsyncFieldValidator(async (value: string) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return value === 'valid'
      })
    )

    // Start multiple validations
    const validation1 = result.current('invalid')
    const validation2 = result.current('valid')

    // Earlier validation should be cancelled (return true)
    expect(await validation1).toBe(true)
    expect(await validation2).toBe(true)
  })
})
```

### Provider Testing
```typescript
// Test provider composition
describe('Providers', () => {
  it('should provide all contexts', () => {
    const TestComponent = () => {
      const session = useSession()
      const organization = useActiveOrganization()
      const pageContext = usePageContext()
      
      return <div>All contexts available</div>
    }

    render(
      <Providers>
        <TestComponent />
      </Providers>
    )

    expect(screen.getByText('All contexts available')).toBeInTheDocument()
  })
})
```

## 📋 Implementation Checklist

Before considering advanced hook patterns complete, verify:

- [ ] **Provider Composition**: Centralized provider setup
- [ ] **Hook Dependencies**: Proper exhaustive-deps handling
- [ ] **Memory Management**: No memory leaks from missing cleanup
- [ ] **Race Condition Handling**: Async operations properly cancelled
- [ ] **State Synchronization**: Forms sync properly with async data
- [ ] **Loading States**: Comprehensive loading state management
- [ ] **Error Boundaries**: Proper error handling in hook failures
- [ ] **TypeScript**: Full type safety throughout hook system
- [ ] **Performance**: Appropriate memoization and optimization
- [ ] **Testing**: Comprehensive test coverage with cleanup validation

## 🚀 Advanced Patterns

### Custom Hook Factory
```typescript
// Factory for creating similar hooks
function createResourceHook<T>(resource: string) {
  return function useResource(id?: string) {
    const { activeOrganizationId } = useActiveOrganization()
    
    const query = useQuery({
      queryKey: [resource, activeOrganizationId, id],
      queryFn: () => getResource(resource, id),
      enabled: !!activeOrganizationId && !!id,
    })

    const mutation = useMutation({
      mutationFn: (data: T) => updateResource(resource, data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [resource] })
      },
    })

    return {
      data: query.data,
      isLoading: query.isLoading,
      update: mutation.mutate,
      isUpdating: mutation.isPending,
    }
  }
}

// Usage
const useTodo = createResourceHook<Todo>('todos')
const useProject = createResourceHook<Project>('projects')
```

### Reactive Hook Composition
```typescript
// Hooks that react to multiple contexts
export function useReactiveFormState<T>(
  initialData: T,
  dependencies: {
    organizationId?: string
    permissions?: string[]
    userRole?: string
  }
) {
  const [formData, setFormData] = useState<T>(initialData)
  const [isReadOnly, setIsReadOnly] = useState(false)

  // React to permission changes
  useEffect(() => {
    const readOnly = !dependencies.permissions?.includes('update') || 
                    !dependencies.organizationId ||
                    dependencies.userRole === 'viewer'
    
    setIsReadOnly(readOnly)
    
    if (readOnly) {
      // Reset any pending changes when becoming read-only
      setFormData(initialData)
    }
  }, [dependencies.permissions, dependencies.organizationId, dependencies.userRole, initialData])

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    if (isReadOnly) return
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [isReadOnly])

  return {
    formData,
    updateField,
    isReadOnly,
    canEdit: !isReadOnly && !!dependencies.organizationId,
  }
}
```

This advanced hook patterns system provides sophisticated state management, proper cleanup handling, and seamless integration across the entire application architecture.