'use client'

import {
  ColumnDef,
  ColumnFiltersState,
  ColumnSizingState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import * as React from 'react'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'


import { DataTablePagination } from './data-table-pagination'
import { DataTableToolbar } from './data-table-toolbar'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { DataTableConfig, SelectionState, ServerQueryParams } from './types'

import { cn } from '@/taali/lib/utils'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  config?: DataTableConfig<TData>
  totalCount?: number
  onStateChange?: (state: {
    search?: string
    columnFilters?: ColumnFiltersState
    sorting?: SortingState
    pagination?: { pageIndex: number; pageSize: number }
  }) => void
  onSelectionChange?: (selection: SelectionState, clearSelection: () => void) => void
  onSelectAll?: (filters: ServerQueryParams) => Promise<string[]>
  currentFilters?: ServerQueryParams
  isLoading?: boolean
  isFetching?: boolean
  loadingRows?: Set<string>
  getRowIdProp?: (row: TData) => string
  onRowClick?: (row: TData) => void
  className?: string
  toolbarClassName?: string
  containerClassName?: string
  noResultsText?: string
  resetText?: string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  config = {},
  totalCount,
  onStateChange,
  onSelectionChange,
  onSelectAll,
  currentFilters,
  isLoading = false,
  isFetching = false,
  loadingRows,
  getRowIdProp,
  onRowClick,
  className,
  toolbarClassName,
  containerClassName,
  noResultsText = 'No results.',
  resetText,
}: DataTableProps<TData, TValue>) {
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})

  // Simplified ID-based selection state
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [isAllSelected, setIsAllSelected] = React.useState(false)

  const {
    manualFiltering = false,
    manualPagination = false,
    manualSorting = false,
    enableColumnFilters = true,
    enableRowSelection = false,
    paginationConfig = {},
    selectionConfig = {},
    resizingConfig = {},
    loadingConfig = {},
  } = config

  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: paginationConfig.defaultPageSize || 10,
  })

  const {
    enableColumnResizing = true,
    columnResizeMode = 'onChange',
    columnResizeDirection = 'ltr',
  } = resizingConfig

  const { skeletonRowCount = 5, showSkeletonOnRefetch = false } = loadingConfig

  // Get ID from row data - assumes 'id' property exists
  const getRowId = React.useCallback((row: TData) => {
    if (getRowIdProp) {
      return getRowIdProp(row)
    }
    // Fallback to using the row as is if no ID extractor is provided
    return String((row as Record<string, unknown>)?.id || Math.random())
  }, [getRowIdProp])

  // Convert selectedIds to TanStack Table's index-based selection for current page
  const currentPageRowSelection = React.useMemo(() => {
    if (isAllSelected) {
      // If all are selected, show all current page rows as selected
      return Object.fromEntries(data.map((_, index) => [index.toString(), true]))
    }

    // Show only rows with IDs in selectedIds as selected
    const selection: Record<string, boolean> = {}
    data.forEach((row, index) => {
      const id = getRowId(row)
      if (selectedIds.has(id)) {
        selection[index.toString()] = true
      }
    })
    return selection
  }, [data, selectedIds, isAllSelected, getRowId])

  // Handle row selection changes from TanStack Table
  const handleRowSelectionChange = React.useCallback(
    (updater: React.SetStateAction<Record<string, boolean>>) => {
      const newIndexSelection =
        typeof updater === 'function' ? updater(currentPageRowSelection) : updater

      // Check if this is a "select/deselect all" operation (all current page items)
      const currentPageSize = data.length
      const newSelectionSize = Object.keys(newIndexSelection).filter(
        key => newIndexSelection[key]
      ).length
      const isSelectingAllCurrentPage = newSelectionSize === currentPageSize
      const isDeselectingAll = newSelectionSize === 0

      if (isDeselectingAll) {
        // Deselect all - clear everything regardless of current mode
        setSelectedIds(new Set())
        setIsAllSelected(false)
        setSelectedIds(new Set())
        return
      }

      if (isSelectingAllCurrentPage && Object.keys(currentPageRowSelection).length === 0) {
        // Selecting all on current page - just add current page items
        const newSelectedIds = new Set(selectedIds)
        data.forEach((row, index) => {
          const id = getRowId(row)
          if (newIndexSelection[index.toString()]) {
            newSelectedIds.add(id)
          }
        })
        setSelectedIds(newSelectedIds)
        setIsAllSelected(false) // Keep in normal mode, not "all selected"
        // Selection handled by ID-based system
        return
      }

      // Individual item selection/deselection
      const newSelectedIds = new Set(selectedIds)

      // If we were in "all selected" mode, exit it when individual items are toggled
      if (isAllSelected) {
        setIsAllSelected(false)
      }

      // Update selectedIds based on current page changes
      data.forEach((row, index) => {
        const id = getRowId(row)
        const indexStr = index.toString()

        if (newIndexSelection[indexStr]) {
          newSelectedIds.add(id)
        } else if (currentPageRowSelection[indexStr]) {
          // This row was previously selected but now isn't
          newSelectedIds.delete(id)
        }
      })

      setSelectedIds(newSelectedIds)
      // Selection handled by ID-based system
    },
    [currentPageRowSelection, isAllSelected, selectedIds, data, getRowId]
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection: currentPageRowSelection,
      columnFilters,
      globalFilter,
      columnSizing,
      pagination,
    },
    enableRowSelection,
    enableColumnResizing,
    columnResizeMode,
    columnResizeDirection,
    onRowSelectionChange: handleRowSelectionChange,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onColumnSizingChange: setColumnSizing,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: manualFiltering ? undefined : getFilteredRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualFiltering,
    manualPagination,
    manualSorting,
    ...(manualPagination && totalCount
      ? {
          pageCount: Math.ceil(totalCount / pagination.pageSize),
        }
      : {}),
  })

  React.useEffect(() => {
    if (onStateChange) {
      onStateChange({
        search: globalFilter,
        columnFilters,
        sorting,
        pagination: {
          pageIndex: pagination.pageIndex,
          pageSize: pagination.pageSize,
        },
      })
    }
  }, [
    globalFilter,
    columnFilters,
    sorting,
    pagination.pageIndex,
    pagination.pageSize,
    onStateChange,
  ])


  // Current selection state for parent component
  const selectionState: SelectionState = React.useMemo(
    () => ({
      selectedIds,
      isAllSelected,
      totalSelectedCount: isAllSelected ? totalCount || 0 : selectedIds.size,
    }),
    [selectedIds, isAllSelected, totalCount]
  )

  // Clear selection function to pass to parent
  const clearSelection = React.useCallback(() => {
    setSelectedIds(new Set())
    setIsAllSelected(false)
    setSelectedIds(new Set())
  }, [])

  // Notify parent of selection changes
  React.useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectionState, clearSelection)
    }
  }, [selectionState, onSelectionChange, clearSelection])

  // Clear selection when filters change
  React.useEffect(() => {
    setSelectedIds(new Set())
    setIsAllSelected(false)
    setSelectedIds(new Set())
  }, [columnFilters, globalFilter])

  return (
    <div className={cn('space-y-4', containerClassName)}>
      {enableColumnFilters && (
        <DataTableToolbar table={table} config={config} className={toolbarClassName} resetText={resetText} />
      )}
      <div
        className={cn(
          'rounded-md border overflow-x-auto',
          className,
          isFetching && !isLoading && 'animate-pulse opacity-75 pointer-events-none'
        )}
      >
        <Table className="table-fixed w-full min-w-max">
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const meta = header.column.columnDef.meta
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        header.column.getCanSort() && 'cursor-pointer select-none',
                        meta?.headerClassName,
                        'relative'
                      )}
                      style={{
                        width: header.getSize(),
                      }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}

                      {/* Resize Handle */}
                      {enableColumnResizing && header.column.getCanResize() && (
                        <div
                          className={cn(
                            'touch-hitbox z-10 absolute! inset-y-2 right-0 w-0.5 cursor-col-resize select-none touch-none ',
                            'bg-border opacity-50 hover:opacity-100',
                            'transition-opacity duration-200',
                            header.column.getIsResizing() && 'opacity-50! bg-primary w-1'
                          )}
                          onMouseDown={e => {
                            e.stopPropagation()
                            header.getResizeHandler()(e)
                          }}
                          onTouchStart={e => {
                            e.stopPropagation()
                            header.getResizeHandler()(e)
                          }}
                          onClick={e => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                        />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading || (showSkeletonOnRefetch && isFetching) ? (
              // Show skeleton rows while loading
              Array.from({ length: skeletonRowCount }).map((_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`}>
                  {table.getAllLeafColumns().map((column, colIndex) => (
                    <TableCell
                      key={`skeleton-${rowIndex}-${colIndex}`}
                      style={{
                        width: column.getSize(),
                      }}
                    >
                      <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => {
                const rowId = getRowIdProp ? getRowIdProp(row.original as TData) : row.id
                const isRowLoading = loadingRows?.has(rowId)
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className={cn(
                      isRowLoading && 'animate-pulse opacity-75 pointer-events-none',
                      onRowClick && 'cursor-pointer hover:bg-muted/50'
                    )}
                    onClick={e => {
                      // Don't trigger row click if clicking on interactive elements
                      const target = e.target as HTMLElement
                      const isInteractive = target.closest(
                        'button, input, select, textarea, a, [role="button"], [tabindex]:not([tabindex="-1"])'
                      )

                      if (!isInteractive) {
                        onRowClick?.(row.original as TData)
                      }
                    }}
                  >
                    {row.getVisibleCells().map(cell => {
                      const meta = cell.column.columnDef.meta
                      const enableTruncation = meta?.enableTextTruncation ?? false

                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            enableTruncation && 'truncate max-w-0',
                            meta?.cellClassName
                          )}
                          style={{
                            width: cell.column.getSize(),
                          }}
                          title={
                            enableTruncation && typeof cell.getValue() === 'string'
                              ? (cell.getValue() as string)
                              : undefined
                          }
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={table.getAllLeafColumns().length} className="h-24 text-center">
                  {noResultsText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} config={paginationConfig} totalCount={totalCount} />

      {/* Bulk Actions Bar */}
      {enableRowSelection &&
        selectionConfig.enableBulkActions &&
        selectionState.totalSelectedCount > 0 && (
          <DataTableBulkActions
            selection={selectionState}
            totalCount={totalCount || 0}
            onSelectAll={async () => {
              if (onSelectAll && currentFilters) {
                const allIds = await onSelectAll(currentFilters)
                setSelectedIds(new Set(allIds))
                setIsAllSelected(true)
              }
            }}
            onClearSelection={() => {
              setSelectedIds(new Set())
              setIsAllSelected(false)
              setSelectedIds(new Set())
            }}
            bulkActions={selectionConfig.bulkActions}
          />
        )}
    </div>
  )
}
