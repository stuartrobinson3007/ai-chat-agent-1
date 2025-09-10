import { QueryClient } from '@tanstack/react-query'

import { parseError } from './client-handler'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          const parsed = parseError(error)

          // Don't retry on client errors (4xx)
          if (parsed.statusCode >= 400 && parsed.statusCode < 500) {
            return false
          }

          // Don't retry on auth errors
          if (parsed.code.startsWith('AUTH_')) {
            return false
          }

          // Don't retry on validation errors
          if (parsed.code.startsWith('VAL_')) {
            return false
          }

          // Retry up to 3 times for server errors and network issues
          return failureCount < 3
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false, // Disable automatic refetch on window focus
      },
      mutations: {
        retry: false, // Don't retry mutations by default
        onError: _error => {
          // Global error handling is done in hooks
          // Mutation error is handled by error boundary or query error handling
        },
      },
    },
  })
}
