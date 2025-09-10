'use client'

import { Column } from '@tanstack/react-table'
import * as React from 'react'

import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Slider } from '../ui/slider'

import { cn } from '@/taali/lib/utils'
import { useTranslation } from '@/i18n/hooks/useTranslation'

interface DataTableNumberFilterProps<TData, TValue> {
  column?: Column<TData, TValue>
  title?: string
  min?: number
  max?: number
  step?: number
  isRange?: boolean
}

export function DataTableNumberFilter<TData, TValue>({
  column,
  title,
  min = 0,
  max = 100,
  step = 1,
  isRange = false,
}: DataTableNumberFilterProps<TData, TValue>) {
  const { t } = useTranslation('common')
  const [open, setOpen] = React.useState(false)
  const value = column?.getFilterValue() as number | [number, number] | undefined

  const [localValue, setLocalValue] = React.useState<number | [number, number]>(
    value || (isRange ? [min, max] : min)
  )

  React.useEffect(() => {
    setLocalValue(value || (isRange ? [min, max] : min))
  }, [value, isRange, min, max])

  const handleApply = () => {
    column?.setFilterValue(localValue)
    setOpen(false)
  }

  const handleClear = () => {
    column?.setFilterValue(undefined)
    setLocalValue(isRange ? [min, max] : min)
    setOpen(false)
  }

  const displayValue = React.useMemo(() => {
    if (!value) return title || t('filters.setValue')

    if (isRange && Array.isArray(value)) {
      return `${value[0]} - ${value[1]}`
    } else if (typeof value === 'number') {
      return value.toString()
    }

    return title || t('filters.setValue')
  }, [value, title, isRange, t])

  const hasValue = Boolean(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('h-8 border-dashed')}>
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">{title}</h4>
            {isRange ? (
              <>
                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    placeholder={t('filters.min')}
                    value={Array.isArray(localValue) ? localValue[0] : min}
                    onChange={e => {
                      const newMin = Number(e.target.value)
                      setLocalValue([newMin, Array.isArray(localValue) ? localValue[1] : max])
                    }}
                    min={min}
                    max={max}
                    step={step}
                    className="h-8"
                  />
                  <span className="text-muted-foreground">{t('filters.to')}</span>
                  <Input
                    type="number"
                    placeholder={t('filters.max')}
                    value={Array.isArray(localValue) ? localValue[1] : max}
                    onChange={e => {
                      const newMax = Number(e.target.value)
                      setLocalValue([Array.isArray(localValue) ? localValue[0] : min, newMax])
                    }}
                    min={min}
                    max={max}
                    step={step}
                    className="h-8"
                  />
                </div>
                <Slider
                  value={Array.isArray(localValue) ? localValue : [min, max]}
                  onValueChange={value => setLocalValue(value as [number, number])}
                  min={min}
                  max={max}
                  step={step}
                  className="py-2"
                />
              </>
            ) : (
              <>
                <Input
                  type="number"
                  placeholder={t('filters.value')}
                  value={typeof localValue === 'number' ? localValue : min}
                  onChange={e => setLocalValue(Number(e.target.value))}
                  min={min}
                  max={max}
                  step={step}
                  className="h-8"
                />
                <Slider
                  value={[typeof localValue === 'number' ? localValue : min]}
                  onValueChange={value => setLocalValue(value[0])}
                  min={min}
                  max={max}
                  step={step}
                  className="py-2"
                />
              </>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            {hasValue && (
              <Button variant="ghost" size="sm" onClick={handleClear} className="justify-center">
                {t('filters.clearFilter')}
              </Button>
            )}
            <Button size="sm" onClick={handleApply}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
