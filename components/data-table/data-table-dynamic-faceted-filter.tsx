'use client'

import { Column } from '@tanstack/react-table'
import { PlusCircle, Loader2 } from 'lucide-react'
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'

import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  Faceted,
  FacetedBadgeList,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedList,
  FacetedTrigger,
} from '../ui/faceted'
import { Separator } from '../ui/separator'

import { DataTableFilterOption } from './types'

import { cn } from '@/taali/lib/utils'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { getTableFilterValue } from '@/taali/utils/type-safe-access'

interface DataTableDynamicFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>
  title?: string
  loadOptions: () => Promise<{ options: DataTableFilterOption[] }>
  multiple?: boolean
}

export function DataTableDynamicFacetedFilter<TData, TValue>({
  column,
  title,
  loadOptions,
  multiple = true,
}: DataTableDynamicFacetedFilterProps<TData, TValue>) {
  const { t } = useTranslation('common')
  const [shouldFetch, setShouldFetch] = React.useState(false)

  const selectedValues = getTableFilterValue(column?.getFilterValue())
  const normalizedValues = React.useMemo(() => {
    if (!selectedValues) return []
    if (Array.isArray(selectedValues)) return selectedValues
    return [selectedValues]
  }, [selectedValues])

  const handleValueChange = (value: string[] | string | undefined) => {
    if (multiple) {
      column?.setFilterValue(value && (value as string[]).length ? value : undefined)
    } else {
      column?.setFilterValue(value)
    }
  }

  // Trigger fetch on hover
  const handleMouseEnter = () => {
    if (!shouldFetch) {
      setShouldFetch(true)
    }
  }

  // Only fetch when shouldFetch becomes true
  const {
    data: optionsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['dynamic-filter-options', title],
    queryFn: loadOptions,
    enabled: shouldFetch,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })

  const options = optionsData?.options || []

  return (
    <Faceted
      value={multiple ? normalizedValues : normalizedValues[0]}
      onValueChange={handleValueChange}
      multiple={multiple}
    >
      <FacetedTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 border-dashed"
          onMouseEnter={handleMouseEnter}
        >
          <PlusCircle className="mr-1" />
          {title}
          {normalizedValues.length > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <FacetedBadgeList
                options={options}
                className="space-x-1"
                badgeClassName="rounded-sm px-1 font-normal lg:hidden"
              />
              <div className="hidden space-x-1 lg:flex">
                {normalizedValues.length > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {normalizedValues.length} selected
                  </Badge>
                ) : (
                  options
                    .filter(option => normalizedValues.includes(option.value))
                    .map(option => (
                      <Badge
                        variant="secondary"
                        key={option.value}
                        className="rounded-sm px-1 font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </FacetedTrigger>
      <FacetedContent className="w-[200px] p-0">
        <FacetedInput placeholder={title} />
        <FacetedList>
          {isLoading && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="animate-spin" />
              <span className="text-sm text-muted-foreground">{t('filters.loadingOptions')}</span>
            </div>
          )}
          {error && (
            <div className="p-4 text-sm text-muted-foreground">{t('filters.loadingError')}</div>
          )}
          {!isLoading && !error && options.length === 0 && (
            <FacetedEmpty>{t('filters.noOptions')}</FacetedEmpty>
          )}
          {!isLoading && !error && options.length > 0 && (
            <FacetedGroup>
              {options.map(option => {
                const isSelected = normalizedValues.includes(option.value)
                return (
                  <FacetedItem key={option.value} value={option.value}>
                    {option.icon && (
                      <option.icon
                        className={cn(
                          'text-muted-foreground',
                          isSelected && 'text-foreground'
                        )}
                      />
                    )}
                    <span>{option.label}</span>
                    {option.count !== undefined && (
                      <span className="ml-auto flex h-4 w-4 items-center justify-center font-mono text-xs">
                        {option.count}
                      </span>
                    )}
                  </FacetedItem>
                )
              })}
            </FacetedGroup>
          )}
          {normalizedValues.length > 0 && !isLoading && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={() => column?.setFilterValue(undefined)}
              >
                {t('filters.clearFilter')}
              </Button>
            </div>
          )}
        </FacetedList>
      </FacetedContent>
    </Faceted>
  )
}
