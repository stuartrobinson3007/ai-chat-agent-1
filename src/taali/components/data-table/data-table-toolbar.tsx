'use client'

import { Table } from '@tanstack/react-table'
import { X } from 'lucide-react'
import * as React from 'react'

import { Button } from '../ui/button'
import { Input } from '../ui/input'


import { DataTableFacetedFilter } from './data-table-faceted-filter'
import { DataTableDynamicFacetedFilter } from './data-table-dynamic-faceted-filter'
import { DataTableDateFilter } from './data-table-date-filter'
import { DataTableNumberFilter } from './data-table-number-filter'
import { DataTableConfig, DataTableColumnMeta } from './types'

import { cn } from '@/taali/lib/utils'
import { useTranslation } from '@/i18n/hooks/useTranslation'

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  config?: DataTableConfig<TData>
  className?: string
  resetText?: string
}

export function DataTableToolbar<TData>({
  table,
  config = {},
  className,
  resetText = 'Reset',
}: DataTableToolbarProps<TData>) {
  const { t: tCommon } = useTranslation('common')
  const isFiltered = table.getState().columnFilters.length > 0
  const { searchConfig } = config

  const handleSearch = React.useCallback(
    (value: string) => {
      table.setGlobalFilter(value)
    },
    [table]
  )

  const globalFilter = table.getState().globalFilter
  const searchValue = React.useMemo(() => {
    return (globalFilter ?? '') as string
  }, [globalFilter])

  const renderFilter = (columnId: string) => {
    const column = table.getColumn(columnId)
    if (!column) return null

    const meta = column.columnDef.meta as DataTableColumnMeta
    const filterConfig = meta?.filterConfig
    if (!filterConfig) return null

    switch (filterConfig.type) {
      case 'select':
      case 'multiSelect':
        return (
          <DataTableFacetedFilter
            key={columnId}
            column={column}
            title={filterConfig.title || (column.columnDef.header as string)}
            options={filterConfig.options || []}
            multiple={filterConfig.type === 'multiSelect'}
          />
        )
      case 'dynamicSelect':
      case 'dynamicMultiSelect':
        if (!filterConfig.loadOptions) return null
        return (
          <DataTableDynamicFacetedFilter
            key={columnId}
            column={column}
            title={filterConfig.title || (column.columnDef.header as string)}
            loadOptions={filterConfig.loadOptions}
            multiple={filterConfig.type === 'dynamicMultiSelect'}
          />
        )
      case 'date':
      case 'dateRange':
        return (
          <DataTableDateFilter
            key={columnId}
            column={column}
            title={filterConfig.title || (column.columnDef.header as string)}
            isRange={filterConfig.type === 'dateRange'}
          />
        )
      case 'number':
      case 'numberRange':
        return (
          <DataTableNumberFilter
            key={columnId}
            column={column}
            title={filterConfig.title || (column.columnDef.header as string)}
            min={filterConfig.min}
            max={filterConfig.max}
            step={filterConfig.step}
            isRange={filterConfig.type === 'numberRange'}
          />
        )
      default:
        return null
    }
  }

  const columnsWithFilters = React.useMemo(() => {
    return table.getAllColumns().filter(column => {
      const meta = column.columnDef.meta as DataTableColumnMeta
      return !!meta?.filterConfig
    })
  }, [table])

  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder={searchConfig?.placeholder || tCommon('actions.search')}
          value={searchValue}
          onChange={event => {
            handleSearch(event.target.value)
          }}
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {columnsWithFilters.map(column => renderFilter(column.id))}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            {resetText}
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
