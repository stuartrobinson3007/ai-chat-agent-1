'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

import { Button } from '../ui/button'
import { Badge } from '../ui/badge'

import { SelectionState, BulkAction } from './types'

import { cn } from '@/taali/lib/utils'
import { useTranslation } from '@/i18n/hooks/useTranslation'


interface DataTableBulkActionsProps {
  selection: SelectionState
  totalCount: number
  onSelectAll: () => void
  onClearSelection: () => void
  bulkActions?: BulkAction[]
  className?: string
}

export function DataTableBulkActions({
  selection,
  totalCount,
  onSelectAll,
  onClearSelection,
  bulkActions = [],
  className,
}: DataTableBulkActionsProps) {
  const { t } = useTranslation('common')
  const selectedCount = selection.totalSelectedCount
  const hasSelection = selectedCount > 0
  const isAllSelected = selection.isAllSelected
  const canSelectAll = !isAllSelected && selectedCount > 0 && totalCount > selectedCount

  return (
    <AnimatePresence>
      {hasSelection && (
        <motion.div
          initial={{ y: 100, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 100, opacity: 0, scale: 0.95 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
          }}
          className={cn(
            'fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50',
            'bg-card border border-border rounded-lg shadow-lg',
            'px-4 py-3 flex items-center gap-3 min-w-fit',
            className
          )}
        >
          {/* Selection Info */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-medium">
              {isAllSelected ? (
                t('table.allItemsSelected', { count: selectedCount.toLocaleString() })
              ) : (
                t('table.itemsSelected', { selected: selectedCount, total: totalCount })
              )}
            </Badge>

            {canSelectAll && (
              <Button variant="outline" size="sm" onClick={onSelectAll} className="h-7 text-xs">
                {t('table.selectAllItems', { total: totalCount.toLocaleString() })}
              </Button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {bulkActions.map(action => {
              const Icon = action.icon
              return (
                <Button
                  key={action.id}
                  variant={action.variant || 'outline'}
                  size="sm"
                  onClick={() =>
                    action.onClick(Array.from(selection.selectedIds), selection.isAllSelected)
                  }
                  className="h-8"
                  disabled={action.disabled}
                >
                  {Icon && <Icon className="h-4 w-4 mr-1" />}
                  {action.label}
                </Button>
              )
            })}

            <Button variant="ghost" size="sm" onClick={onClearSelection} className="h-8 w-8 p-0">
              <X />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
