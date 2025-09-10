import { useCallback, useRef, useEffect } from 'react'

/**
 * Hook for async field validation with proper race condition handling
 * 
 * Features:
 * - Cancels in-flight validations when new ones start
 * - Returns valid if validation was cancelled (prevents stale errors)
 * - Handles race conditions properly
 * - Generic error message handling
 */
export function useAsyncFieldValidator<T = string>(
  validator: (value: T, signal?: AbortSignal) => Promise<boolean | string>,
  deps: React.DependencyList = [],
  errorMessages?: {
    validationFailed?: string
  }
) {
  const abortControllerRef = useRef<AbortController | null>(null)

  const validate = useCallback(async (value: T) => {
    // Cancel any in-flight validation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new controller for this validation
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal
    
    try {
      const result = await validator(value, signal)
      
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
      
      // Return a user-friendly error message for unexpected errors
      return errorMessages?.validationFailed || 'Validation failed'
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validator, ...deps])
  
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