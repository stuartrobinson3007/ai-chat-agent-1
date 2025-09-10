'use client'

import * as React from 'react'
import { useMemo } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Clock, Trash2, Edit2, Plus, Loader2, Undo2, Check } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'


import {
  getTodosTable,
  getAllTodosIds,
  bulkDeleteTodos,
  undoBulkDeleteTodos,
  getTodoCreators,
} from '../lib/todos-table.server'
import { toggleTodo, deleteTodo, createTodo, undoDeleteTodo } from '../lib/todos.server'
import { todoKeys } from '../lib/query-keys'

import { useConfirm } from '@/ui/confirm-dialog'
import { formatDate } from '@/taali/utils/date'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { PageHeader } from '@/components/page-header'
import { useLoadingItems } from '@/taali/hooks/use-loading-state'
import { DataTable, DataTableHeader } from '@/taali/components/data-table'
import { useTableQuery } from '@/taali/components/data-table'
import {
  DataTableConfig,
  DataTableColumnMeta,
  SelectionState,
  BulkAction,
  ServerQueryParams,
} from '@/taali/components/data-table'
import { Button } from '@/ui/button'
import { Badge } from '@/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { Checkbox } from '@/ui/checkbox'
import { useClientPermissions } from '@/lib/hooks/use-permissions'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useErrorHandler } from '@/lib/errors/hooks'
import { AppError } from '@/taali/utils/errors'
import { ERROR_CODES } from '@/taali/errors/codes'
import { ErrorState } from '@/components/error-state'
import { parseError } from '@/taali/errors/client-handler'

interface Todo {
  id: string
  title: string
  description: string | null
  priority: number
  completed: boolean
  dueDate: Date | null
  createdAt: Date
  updatedAt: Date
  createdBy: string
  createdByName: string | null
  assignedTo: string | null
  organizationId: string
}

export function TodosTablePage() {
  const { activeOrganizationId } = useActiveOrganization()
  const navigate = useNavigate()
  const { canCreateTodo, canUpdateTodo, canDeleteTodo } = useClientPermissions()
  const { t } = useTranslation('todos')
  const { t: tCommon } = useTranslation('common')
  const { t: tNotifications } = useTranslation('notifications')
  const { showError, showSuccess } = useErrorHandler()
  const confirm = useConfirm()
  const [isCreating, setIsCreating] = React.useState(false)
  const [currentFilters, setCurrentFilters] = React.useState<ServerQueryParams>({})
  const [clearSelectionFn, setClearSelectionFn] = React.useState<(() => void) | null>(null)

  // Loading states for individual todo actions
  const {
    isLoading: isLoadingTodo,
    startLoading: startTodoLoading,
    stopLoading: stopTodoLoading,
    loadingItems: loadingTodos,
  } = useLoadingItems<string>()
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false)

  // Use the table query hook with hierarchical query keys
  const { data, totalCount, isLoading, isFetching, isError, error, onStateChange, refetch } = useTableQuery<Todo>({
    queryKey: activeOrganizationId ? [...todoKeys.tables(activeOrganizationId)] : [],
    queryFn: (params?: ServerQueryParams) => {
      const queryParams = params || {}
      setCurrentFilters(queryParams)
      return getTodosTable({ data: queryParams })
    },
    enabled: !!activeOrganizationId,
  })

  const handleCreateTodo = React.useCallback(async () => {
    if (!activeOrganizationId) {
      showError(
        new AppError(
          ERROR_CODES.VAL_REQUIRED_FIELD,
          400,
          { field: tCommon('labels.organization') },
          t('edit.noOrganizationMessage')
        )
      )
      return
    }

    setIsCreating(true)
    try {
      const created = await createTodo({
        data: {
          title: t('untitled'),
          description: '',
          priority: 'medium',
        },
      })

      showSuccess(t('messages.created'))
      navigate({ to: `/todos/${created.id}/edit` })
    } catch (error) {
      showError(error)
      setIsCreating(false)
    }
  }, [activeOrganizationId, navigate, showError, showSuccess, t, tCommon])

  const handleToggle = React.useCallback(
    async (id: string) => {
      startTodoLoading(id)
      try {
        await toggleTodo({ data: { id } })
        refetch()
        showSuccess(t('messages.updated'))
      } catch (error) {
        showError(error)
      } finally {
        stopTodoLoading(id)
      }
    },
    [refetch, startTodoLoading, stopTodoLoading, showError, showSuccess, t]
  )

  const handleDelete = React.useCallback(
    async (id: string) => {
      const confirmed = await confirm({
        title: tCommon('confirm.title'),
        description: t('messages.deleteConfirm'),
        confirmText: tCommon('actions.delete'),
        variant: 'destructive'
      })
      if (!confirmed) return

      startTodoLoading(id)
      try {
        await deleteTodo({ data: { id } })
        refetch()

        // Show success toast with undo action
        showSuccess(tCommon('messages.deleted'), {
          action: {
            label: tCommon('actions.undo'),
            onClick: async () => {
              try {
                await undoDeleteTodo({ data: { id } })
                refetch()
                showSuccess(tCommon('messages.restored'))
              } catch (error) {
                showError(error)
              }
            }
          }
        })
      } catch (error) {
        showError(error)
      } finally {
        stopTodoLoading(id)
      }
    },
    [refetch, startTodoLoading, stopTodoLoading, showError, showSuccess, t, confirm, tCommon]
  )

  const handleBulkDelete = React.useCallback(
    async (selectedIds: string[]) => {
      const count = selectedIds.length

      const confirmed = await confirm({
        title: tCommon('confirm.title'),
        description: tNotifications('confirmations.deleteTodos', { count, plural: count !== 1 ? 's' : '' }),
        confirmText: tCommon('actions.delete'),
        variant: 'destructive'
      })
      if (!confirmed) return

      setIsBulkDeleting(true)
      // Add all selected items to loading state
      selectedIds.forEach(id => startTodoLoading(id))

      try {
        await bulkDeleteTodos({
          data: { ids: selectedIds },
        })

        // Clear selection after successful delete
        if (clearSelectionFn) {
          clearSelectionFn()
        }

        refetch()

        // Show success toast with bulk undo action
        showSuccess(`Successfully deleted ${count} todo${count !== 1 ? 's' : ''}`, {
          action: {
            label: tCommon('actions.undo'),
            onClick: async () => {
              try {
                const undoResult = await undoBulkDeleteTodos({ data: { ids: selectedIds } })
                refetch()
                showSuccess(`Restored ${undoResult.restoredCount} todo${undoResult.restoredCount !== 1 ? 's' : ''}`)
              } catch (error) {
                showError(error)
              }
            }
          }
        })
      } catch (error) {
        showError(error)
      } finally {
        // Clear all loading states
        selectedIds.forEach(id => stopTodoLoading(id))
        setIsBulkDeleting(false)
      }
    },
    [refetch, clearSelectionFn, startTodoLoading, stopTodoLoading, showError, showSuccess, tNotifications, confirm, tCommon]
  )

  const handleSelectAll = React.useCallback(async (filters?: ServerQueryParams) => {
    const queryParams = filters || {}
    const result = await getAllTodosIds({ data: queryParams })
    return result.ids
  }, [])

  const handleSelectionChange = React.useCallback(
    (_: SelectionState, clearSelection: () => void) => {
      setClearSelectionFn(() => clearSelection)
    },
    []
  )

  const handleRowClick = React.useCallback(
    (todo: Todo) => {
      navigate({ to: `/todos/${todo.id}/edit` })
    },
    [navigate]
  )

  const columns: ColumnDef<Todo>[] = useMemo(() => {
    const cols: ColumnDef<Todo>[] = []

    // Only add select column if user can delete
    if (canDeleteTodo()) {
      cols.push({
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
            aria-label={tCommon('table.selectAll')}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={value => row.toggleSelected(!!value)}
            aria-label={tCommon('table.selectRow')}
          />
        ),
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        size: 40,
      })
    }

    // Add all other columns
    cols.push(
      {
        accessorKey: 'completed',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {t('fields.status')}
          </DataTableHeader>
        ),
        enableColumnFilter: true,
        enableSorting: true,
        size: 100,
        cell: ({ row }) => {
          const completed = row.getValue('completed') as boolean
          return (
            <Badge variant={completed ? 'success' : 'warning'} appearance="soft" status={completed}>
              {completed ? t('status.completed') : t('status.pending')}
            </Badge>
          )
        },
        meta: {
          filterConfig: {
            type: 'select',
            title: tCommon('labels.status'),
            options: [
              { label: t('status.completed'), value: 'true' },
              { label: t('status.pending'), value: 'false' },
            ],
          },
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: 'title',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {tCommon('fields.title')}
          </DataTableHeader>
        ),
        enableSorting: true,
        size: 250,
        cell: ({ row }) => {
          return (
            <div>
              <div className="font-medium truncate">{row.getValue('title')}</div>
              {row.original.description && (
                <div className="text-sm text-muted-foreground truncate">
                  {row.original.description}
                </div>
              )}
            </div>
          )
        },
        meta: {
          enableTextTruncation: true,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: 'priority',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {tCommon('fields.priority')}
          </DataTableHeader>
        ),
        enableColumnFilter: true,
        enableSorting: true,
        size: 80,
        cell: ({ row }) => {
          const priority = row.getValue('priority') as number
          return <span className="font-mono">{priority}</span>
        },
        meta: {
          filterConfig: {
            type: 'numberRange',
            title: tCommon('fields.priority'),
            min: 1,
            max: 5,
            step: 1,
          },
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: 'dueDate',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {tCommon('fields.dueDate')}
          </DataTableHeader>
        ),
        enableColumnFilter: true,
        enableSorting: true,
        size: 120,
        cell: ({ row }) => {
          const dueDate = row.getValue('dueDate') as Date | null
          if (!dueDate) return <span className="text-muted-foreground">-</span>

          return (
            <div className="flex items-center gap-1">
              <Clock className="min-w-3 h-3" />
              {formatDate(dueDate)}
            </div>
          )
        },
        meta: {
          filterConfig: {
            type: 'dateRange',
            title: tCommon('fields.dueDate'),
          },
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {t('columns.created')}
          </DataTableHeader>
        ),
        enableColumnFilter: true,
        enableSorting: true,
        size: 120,
        cell: ({ row }) => {
          return formatDate(row.getValue('createdAt'))
        },
        meta: {
          filterConfig: {
            type: 'dateRange',
            title: t('columns.created'),
          },
          enableTextTruncation: true,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: 'createdByName',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {t('columns.createdBy')}
          </DataTableHeader>
        ),
        enableColumnFilter: true,
        enableSorting: true,
        size: 130,
        cell: ({ row }) => {
          const createdByName = row.getValue('createdByName') as string | null
          return createdByName ? (
            <span className="text-sm">{createdByName}</span>
          ) : (
            <span className="text-muted-foreground text-sm">{tCommon('table.unknown')}</span>
          )
        },
        meta: {
          filterConfig: {
            type: 'dynamicMultiSelect',
            title: t('columns.createdBy'),
            loadOptions: async () => {
              const result = await getTodoCreators()
              return result
            },
          },
          enableTextTruncation: true,
        } as DataTableColumnMeta,
      },
      {
        id: 'markDone',
        enableHiding: false,
        enableResizing: false,
        size: 120,
        cell: ({ row }) => {
          const completed = row.original.completed
          const isLoading = isLoadingTodo(row.original.id)
          const canUpdate = canUpdateTodo()

          if (completed || isLoading || !canUpdate) return null

          return (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleToggle(row.original.id)}
              className="h-7"
            >
              {tCommon('actions.markComplete')}
            </Button>
          )
        },
      },
      {
        id: 'actions',
        header: () => null,
        enableHiding: false,
        enableResizing: false,
        size: 50,
        cell: ({ row }) => {
          const isLoading = isLoadingTodo(row.original.id)
          const canUpdate = canUpdateTodo()
          const canDelete = canDeleteTodo()

          // Don't show menu if user has no permissions
          if (!canUpdate && !canDelete) return null

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0" disabled={isLoading}>
                  <span className="sr-only">{tCommon('accessibility.openMenu')}</span>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreHorizontal />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canUpdate && (
                  <>
                    <DropdownMenuItem
                      onClick={() => handleToggle(row.original.id)}
                      disabled={isLoading}
                    >
                      {row.original.completed ? (
                        <>
                          <Undo2 />
                          <>{t('actions.markIncomplete')}</>
                        </>
                      ) : (
                        <>
                          <Check />
                          <>{tCommon('actions.markComplete')}</>
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate({ to: `/todos/${row.original.id}/edit` })}
                      disabled={isLoading}
                    >
                      <Edit2 />
                      {tCommon('actions.edit')}
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && (
                  <>
                    {canUpdate && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={() => handleDelete(row.original.id)}
                      disabled={isLoading}
                    >
                      <Trash2 />
                      {tCommon('actions.delete')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      }
    )

    return cols
  }, [handleToggle, handleDelete, navigate, isLoadingTodo, canUpdateTodo, canDeleteTodo, t, tCommon])

  const bulkActions: BulkAction[] = useMemo(() => {
    const actions: BulkAction[] = []

    if (canDeleteTodo()) {
      actions.push({
        id: 'delete',
        label: isBulkDeleting ? tCommon('states.uploading') : tCommon('actions.delete'),
        icon: Trash2,
        variant: 'destructive',
        onClick: handleBulkDelete,
        disabled: isBulkDeleting,
      })
    }

    return actions
  }, [handleBulkDelete, isBulkDeleting, canDeleteTodo, tCommon])

  const config = React.useMemo<DataTableConfig<Todo>>(
    () => ({
      searchConfig: {
        placeholder: t('table.search'),
      },
      paginationConfig: {
        pageSizeOptions: [10, 20, 30, 50],
        defaultPageSize: 10,
      },
      selectionConfig: {
        enableBulkActions: canDeleteTodo(),
        bulkActions,
      },
      enableColumnFilters: true,
      enableSorting: true,
      enableRowSelection: canDeleteTodo(),
      manualFiltering: true,
      manualPagination: true,
      manualSorting: true,
    }),
    [bulkActions, canDeleteTodo, t]
  )

  if (!activeOrganizationId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-2xl font-bold mb-4">{t('edit.noOrganization')}</h2>
        <p className="text-muted-foreground">{t('edit.noOrganizationDescription')}</p>
      </div>
    )
  }

  // Handle table errors
  if (isError && error && !isLoading) {
    return <ErrorState error={parseError(error)} onRetry={refetch} />
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={t('title')}
        actions={
          canCreateTodo() ? (
            <Button size="sm" onClick={handleCreateTodo} disabled={isCreating}>
              <Plus />
              {isCreating ? tCommon('states.uploading') : t('new')}
            </Button>
          ) : undefined
        }
      />

      {/* Main Content */}
      <div className="flex-1 p-4">
        {(!data || data.length === 0) && !isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed rounded-lg p-8">
            <div className="text-center space-y-4">
              <div className="bg-muted rounded-full p-4 w-16 h-16 mx-auto flex items-center justify-center">
                <Plus className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{t('empty.title')}</h3>
                <p className="text-sm text-muted-foreground mt-2">{t('empty.description')}</p>
              </div>
              {canCreateTodo() && (
                <Button onClick={handleCreateTodo} disabled={isCreating} className="mt-4">
                  <Plus />
                  {isCreating ? tCommon('states.uploading') : t('empty.title')}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={data}
            config={config}
            totalCount={totalCount}
            onStateChange={onStateChange}
            onSelectionChange={handleSelectionChange}
            onSelectAll={handleSelectAll}
            currentFilters={currentFilters}
            isLoading={isLoading}
            isFetching={isFetching}
            loadingRows={loadingTodos}
            getRowIdProp={row => row.id}
            onRowClick={handleRowClick}
            className="h-[600px]"
          />
        )}
      </div>
    </div>
  )
}
