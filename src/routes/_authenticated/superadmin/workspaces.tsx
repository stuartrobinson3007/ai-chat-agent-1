import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Building2, Users, Calendar, Trash2, MoreHorizontal, Eye } from 'lucide-react'

import { useConfirm } from '@/ui/confirm-dialog'
import { useErrorHandler } from '@/lib/errors/hooks'
import { ErrorState } from '@/components/error-state'
import { parseError } from '@/taali/errors/client-handler'
import { useSupportingQuery } from '@/taali/hooks/use-supporting-query'
import { authClient } from '@/lib/auth/auth-client'
import {
  DataTable,
  DataTableHeader,
  useTableQuery,
  DataTableConfig,
  DataTableColumnMeta,
} from '@/taali/components/data-table'
import {
  getAdminWorkspacesTable,
  getAdminWorkspaceStats,
  type AdminWorkspace,
} from '@/features/admin/lib/admin-workspaces.server'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/ui/tooltip'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useListOrganizations } from '@/lib/auth/auth-hooks'

export const Route = createFileRoute('/_authenticated/superadmin/workspaces')({
  component: SuperAdminWorkspaces,
})

function SuperAdminWorkspaces() {
  const { t } = useTranslation('admin')
  const { t: tCommon } = useTranslation('common')
  const { t: tNotifications } = useTranslation('notifications')
  const { showError, showSuccess } = useErrorHandler()
  const confirm = useConfirm()
  const { refetch: refetchOrganizations } = useListOrganizations()
  const [currentFilters, setCurrentFilters] = React.useState({})

  // Query for total stats (independent of filters)
  const { data: stats, showError: showStatsError } = useSupportingQuery({
    queryKey: ['admin', 'workspaces', 'stats'],
    queryFn: () => getAdminWorkspaceStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Use the table query hook
  const { data, totalCount, isLoading, isFetching, isError, error, onStateChange, refetch } =
    useTableQuery<AdminWorkspace>({
      queryKey: ['admin', 'workspaces', 'table'],
      queryFn: params => {
        setCurrentFilters(params)
        return getAdminWorkspacesTable({ data: params })
      },
      enabled: true,
    })

  const handleDeleteOrganization = React.useCallback(
    async (orgId: string, orgName: string) => {
      const confirmed = await confirm({
        title: tNotifications('confirmations.deleteOrganization'),
        description: tNotifications('confirmations.deleteOrganization', { orgName }),
        confirmText: tCommon('actions.delete'),
        variant: 'destructive'
      })
      if (!confirmed) return

      try {
        // This would need to be an admin-only delete function
        const result = await authClient.organization.delete({
          organizationId: orgId,
        })

        if (result.error) {
          showError(result.error.message || t('messages.organizationDeleteFailed'))
        } else {
          showSuccess(t('messages.organizationDeleted'))
          refetch() // Refresh admin workspaces table
          await refetchOrganizations() // Refresh organizations list
        }
      } catch (error) {
        showError(error)
      }
    },
    [refetch, refetchOrganizations, tNotifications, t, showError, showSuccess, confirm, tCommon]
  )

  const handleImpersonateOwner = React.useCallback(
    async (ownerId: string) => {
      try {
        await authClient.admin.impersonateUser({ userId: ownerId })
        showSuccess(t('messages.impersonationStarted'))
        window.location.href = '/'
      } catch (error) {
        showError(error)
      }
    },
    [t, showError, showSuccess]
  )

  const getImpersonateTooltipMessage = React.useCallback(
    (org: AdminWorkspace) => {
      if (!org.ownerId) {
        return t('workspaces.noOwnerTooltip')
      }
      if (org.ownerBanned) {
        return t('workspaces.ownerBannedTooltip')
      }
      return t('workspaces.cannotImpersonateTooltip')
    },
    [t]
  )

  // Column definitions
  const columns = React.useMemo<ColumnDef<AdminWorkspace>[]>(
    () => [
      {
        accessorKey: 'id',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            ID
          </DataTableHeader>
        ),
        enableSorting: true,
        size: 100,
        cell: ({ row }) => {
          const org = row.original
          return <div className="text-xs font-mono text-muted-foreground">{org.id}</div>
        },
        meta: {
          enableTextTruncation: true,
        } as DataTableColumnMeta,
      },
      {
        id: 'organization',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {t('workspaces.organization')}
          </DataTableHeader>
        ),
        enableSorting: true,
        size: 300,
        cell: ({ row }) => {
          const org = row.original
          return (
            <div className="flex items-center">
              <Building2 className="w-5 h-5 text-muted-foreground mr-3" />
              <div>
                <div className="text-sm font-medium text-foreground">{org.name}</div>
                <div className="text-sm text-muted-foreground">
                  {org.slug || tCommon('table.unknown')}
                </div>
              </div>
            </div>
          )
        },
        meta: {
          enableTextTruncation: true,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: 'currentPlan',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {t('workspaces.plan')}
          </DataTableHeader>
        ),
        enableSorting: true,
        enableColumnFilter: true,
        size: 120,
        cell: ({ row }) => {
          const plan = row.original.currentPlan || 'free'
          const variant = plan === 'business' ? 'success' : plan === 'pro' ? 'primary' : 'secondary'
          return (
            <Badge variant={variant} appearance="soft">
              {plan.charAt(0).toUpperCase() + plan.slice(1)}
            </Badge>
          )
        },
        meta: {
          filterConfig: {
            type: 'select',
            title: t('workspaces.plan'),
            options: [
              { value: 'free', label: 'Free' },
              { value: 'pro', label: 'Pro' },
              { value: 'business', label: 'Business' },
            ],
          },
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: 'memberCount',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {t('workspaces.members')}
          </DataTableHeader>
        ),
        enableSorting: true,
        size: 120,
        cell: ({ row }) => {
          const org = row.original
          return (
            <div className="flex items-center text-sm text-foreground">
              <Users className="w-4 h-4 mr-2 text-muted-foreground" />
              {org.memberCount || 0} {String(t('workspaces.members')).toLowerCase()}
            </div>
          )
        },
        meta: {
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: 'stripeCustomerId',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {t('workspaces.stripeCustomerId')}
          </DataTableHeader>
        ),
        enableSorting: true,
        enableColumnFilter: true,
        size: 200,
        cell: ({ row }) => {
          const customerId = row.original.stripeCustomerId
          return (
            <div className="text-xs font-mono text-muted-foreground">
              {customerId || '—'}
            </div>
          )
        },
        meta: {
          filterConfig: {
            type: 'text',
            title: t('workspaces.stripeCustomerId'),
            placeholder: t('workspaces.searchCustomerId'),
          },
          enableTextTruncation: true,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {t('workspaces.created')}
          </DataTableHeader>
        ),
        enableColumnFilter: true,
        enableSorting: true,
        size: 150,
        cell: ({ row }) => {
          const org = row.original
          return (
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className='size-4 mr-2' />
              {new Date(org.createdAt).toLocaleDateString()}
            </div>
          )
        },
        meta: {
          filterConfig: {
            type: 'dateRange',
            title: t('workspaces.createdDate'),
          },
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
      {
        id: 'status',
        header: () => <span>{tCommon('labels.status')}</span>,
        size: 100,
        cell: () => {
          return (
            <Badge variant="success" appearance="soft" status>
              {t('users.active')}
            </Badge>
          )
        },
        enableSorting: false,
        meta: {
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
      {
        id: 'actions',
        header: () => null,
        size: 50,
        enableResizing: false,
        cell: ({ row }) => {
          const org = row.original
          return (
            <div className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!org.ownerId || org.ownerBanned ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <DropdownMenuItem
                            disabled={true}
                            className="cursor-not-allowed"
                          >
                            <Eye />
                            {t('workspaces.impersonateOwner')}
                          </DropdownMenuItem>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        {getImpersonateTooltipMessage(org)}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => handleImpersonateOwner(org.ownerId!)}
                    >
                      <Eye />
                      {t('workspaces.impersonateOwner')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => handleDeleteOrganization(org.id, org.name)}>
                    <Trash2 />
                    {t('workspaces.deleteOrganization')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
        enableSorting: false,
        meta: {
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
    ],
    [handleDeleteOrganization, handleImpersonateOwner, getImpersonateTooltipMessage, t, tCommon]
  )

  // DataTable configuration
  const config = React.useMemo<DataTableConfig<AdminWorkspace>>(
    () => ({
      searchConfig: {
        placeholder: t('workspaces.search'),
        searchableColumns: ['name', 'slug', 'id', 'stripeCustomerId'],
      },
      enableColumnFilters: true,
      enableSorting: true,
      enableRowSelection: false,
      manualFiltering: true,
      manualPagination: true,
      manualSorting: true,
      paginationConfig: {
        pageSizeOptions: [10, 20, 30, 50],
        defaultPageSize: 10,
      },
      resizingConfig: {
        enableColumnResizing: true,
      },
    }),
    [t]
  )

  // Handle table errors
  if (isError && error && !isLoading) {
    return <ErrorState error={parseError(error)} onRetry={refetch} />
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-0">
        {/* Organization Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {showStatsError ? (
            <div className="col-span-full">
              <ErrorState
                error={parseError({ message: 'Unable to load workspace statistics' })}
                variant="inline"
              />
            </div>
          ) : (
            <>
              <div className="bg-card rounded-lg border p-4">
                <h3 className="text-sm font-medium mb-1">Total Organizations</h3>
                <p className="text-2xl font-bold">{stats?.totalOrganizations || 0}</p>
              </div>

              <div className="bg-card rounded-lg border p-4">
                <h3 className="text-sm font-medium mb-1">Free Organizations</h3>
                <p className="text-2xl font-bold">{stats?.freeOrganizations || 0}</p>
              </div>

              <div className="bg-card rounded-lg border p-4">
                <h3 className="text-sm font-medium mb-1">Pro Organizations</h3>
                <p className="text-2xl font-bold">{stats?.proOrganizations || 0}</p>
              </div>

              <div className="bg-card rounded-lg border p-4">
                <h3 className="text-sm font-medium mb-1">Business Organizations</h3>
                <p className="text-2xl font-bold">{stats?.businessOrganizations || 0}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 px-6 pb-6">
        <DataTable
          columns={columns}
          data={data}
          config={config}
          totalCount={totalCount}
          onStateChange={onStateChange}
          currentFilters={currentFilters}
          isLoading={isLoading}
          isFetching={isFetching}
          getRowIdProp={row => row.id}
          className='h-[600px]'
          resetText={tCommon('actions.reset')}
          noResultsText={tCommon('messages.noResults')}
        />
      </div>
    </div>
  )
}
