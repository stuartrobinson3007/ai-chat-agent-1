import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

interface UseResourceQueryOptions<TData> {
  queryKey: unknown[]
  queryFn: () => Promise<TData>
  enabled?: boolean
  redirectOnError?: boolean | string
  onError?: (error: unknown) => void
  retry?: number
  staleTime?: number
  refetchOnWindowFocus?: boolean
}

/**
 * Generic hook for fetching single resources with consistent error handling
 * 
 * Features:
 * - Automatic error handling with optional redirect
 * - Customizable retry behavior
 * - Type-safe query configuration
 * - Consistent loading and error states
 */
export function useResourceQuery<TData>({
  queryKey,
  queryFn,
  enabled = true,
  redirectOnError = false,
  onError,
  retry = 1,
  staleTime = 1000 * 60 * 5, // 5 minutes
  refetchOnWindowFocus = false,
}: UseResourceQueryOptions<TData>) {
  const navigate = useNavigate()

  const query = useQuery({
    queryKey,
    queryFn,
    enabled,
    retry,
    staleTime,
    refetchOnWindowFocus,
    onError: (error: unknown) => {
      // Call custom error handler if provided
      onError?.(error)
      
      // Handle redirect on error if specified
      if (redirectOnError) {
        const redirectPath = typeof redirectOnError === 'string' ? redirectOnError : '/error'
        navigate({ to: redirectPath })
      }
    },
  } as UseQueryOptions<TData>)

  return {
    ...query,
    isLoading: query.isLoading || query.isFetching,
    isEmpty: !query.isLoading && !query.error && !query.data,
  }
}