import { useQuery, UseQueryOptions } from '@tanstack/react-query'

interface UseSupportingQueryOptions<TData> {
  queryKey: unknown[]
  queryFn: () => Promise<TData>
  fallback?: TData
  enabled?: boolean
  retry?: number
  staleTime?: number
  refetchInterval?: number | false
}

/**
 * Hook for supporting/secondary data that's nice-to-have but not critical for page function.
 * Provides graceful degradation with fallback values and error indicators.
 * 
 * Use this for:
 * - Statistics/metrics
 * - Usage data
 * - Secondary metadata
 * - Supplementary information
 */
export function useSupportingQuery<TData>({
  queryKey,
  queryFn,
  fallback,
  enabled = true,
  retry = 1,
  staleTime = 30 * 1000,
  refetchInterval = false
}: UseSupportingQueryOptions<TData>) {
  const query = useQuery({
    queryKey,
    queryFn,
    enabled,
    retry,
    staleTime,
    refetchInterval
  } as UseQueryOptions<TData>)
  
  return {
    ...query,
    data: query.data ?? fallback,
    hasError: query.isError,
    showError: query.isError && !query.isLoading
  }
}