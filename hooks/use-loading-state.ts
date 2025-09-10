import { useState, useCallback } from 'react'

/**
 * Hook for managing loading states of individual items
 * Useful for tracking which specific items are being processed in a list
 */
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

/**
 * Hook for wrapping async actions with automatic loading state management
 */
export function useAsyncAction<TArgs extends unknown[], TReturn = void>(
  action: (...args: TArgs) => Promise<TReturn>,
  options?: {
    onSuccess?: (result: TReturn) => void
    onError?: (error: Error) => void
    errorMessage?: string
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
        const error = err instanceof Error ? err : new Error(options?.errorMessage || 'An error occurred')
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

/**
 * Hook for managing multiple concurrent loading states
 */
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