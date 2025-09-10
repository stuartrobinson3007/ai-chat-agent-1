import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { useState, useCallback, useMemo, useEffect } from 'react'

import { DataTableState, ServerQueryParams, ServerQueryResponse } from '@/taali/components/data-table/types'

interface UseTableQueryOptions<TData> {
  queryKey: string[]
  queryFn: (params: ServerQueryParams) => Promise<ServerQueryResponse<TData>>
  defaultPageSize?: number
  debounceMs?: number
  enabled?: boolean
  staleTime?: number
  refetchInterval?: number | false
}

export function useTableQuery<TData>({
  queryKey,
  queryFn,
  defaultPageSize = 10,
  debounceMs = 300,
  enabled = true,
  staleTime = 1000 * 60, // 1 minute
  refetchInterval = false,
}: UseTableQueryOptions<TData>) {
  const [tableState, setTableState] = useState<DataTableState>({
    search: '',
    columnFilters: [],
    sorting: [],
    pagination: {
      pageIndex: 0,
      pageSize: defaultPageSize,
    },
  })

  const [debouncedState, setDebouncedState] = useState(tableState)

  // Debounce state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedState(tableState)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [tableState, debounceMs])

  // Convert table state to server query params
  const serverParams = useMemo<ServerQueryParams>(() => {
    const filters: Record<string, unknown> = {}

    // Add column filters (including search which is set as a column filter)
    debouncedState.columnFilters.forEach(filter => {
      if (filter.value !== undefined && filter.value !== '') {
        filters[filter.id] = filter.value
      }
    })

    // Use global filter for search - clean and generic
    const searchValue = debouncedState.search || ''

    return {
      search: searchValue,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sorting: debouncedState.sorting.length > 0 ? debouncedState.sorting : undefined,
      pagination: debouncedState.pagination,
    }
  }, [debouncedState])

  // Create query key with params
  const fullQueryKey = useMemo(() => [...queryKey, serverParams], [queryKey, serverParams])

  // Fetch data
  const query = useQuery({
    queryKey: fullQueryKey,
    queryFn: () => queryFn(serverParams),
    enabled,
    staleTime,
    refetchInterval,
    placeholderData: previousData => previousData,
  } as UseQueryOptions<ServerQueryResponse<TData>, Error>)

  // Handler for state changes from DataTable
  const handleStateChange = useCallback((newState: Partial<DataTableState>) => {
    setTableState(prev => {
      // Check if page size is changing
      if (newState.pagination?.pageSize && newState.pagination.pageSize !== prev.pagination.pageSize) {
        // Calculate new page count with the new page size
        const newPageCount = Math.ceil((query.data?.totalCount || 0) / newState.pagination.pageSize)
        
        // Check if current page index is still valid
        if (newState.pagination.pageIndex >= newPageCount && newPageCount > 0) {
          // Reset to first page if current page is invalid
          return {
            ...prev,
            ...newState,
            pagination: {
              ...newState.pagination,
              pageIndex: 0,
            },
          }
        }
      }
      
      return {
        ...prev,
        ...newState,
      }
    })
  }, [query.data?.totalCount])

  // Reset filters
  const resetFilters = useCallback(() => {
    setTableState(prev => ({
      ...prev,
      search: '',
      columnFilters: [],
      sorting: [],
      pagination: {
        ...prev.pagination,
        pageIndex: 0,
      },
    }))
  }, [])

  // Set specific filter
  const setFilter = useCallback((columnId: string, value: unknown) => {
    setTableState(prev => {
      const existingFilterIndex = prev.columnFilters.findIndex(filter => filter.id === columnId)

      const newFilters = [...prev.columnFilters]

      if (value === undefined || value === null) {
        // Remove filter
        if (existingFilterIndex !== -1) {
          newFilters.splice(existingFilterIndex, 1)
        }
      } else {
        // Add or update filter
        if (existingFilterIndex !== -1) {
          newFilters[existingFilterIndex] = { id: columnId, value }
        } else {
          newFilters.push({ id: columnId, value })
        }
      }

      return {
        ...prev,
        columnFilters: newFilters,
        pagination: {
          ...prev.pagination,
          pageIndex: 0, // Reset to first page when filters change
        },
      }
    })
  }, [])

  return {
    data: query.data?.data || [],
    totalCount: query.data?.totalCount || 0,
    pageCount: query.data?.pageCount || 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    tableState,
    onStateChange: handleStateChange,
    resetFilters,
    setFilter,
  }
}
