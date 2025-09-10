import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Ban, UserCheck, Eye, MoreHorizontal, Monitor, User, Shield, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { authClient } from '@/lib/auth/auth-client'
import { useErrorHandler } from '@/lib/errors/hooks'
import { ErrorState } from '@/components/error-state'
// Better-auth session type (different from our Session interface)
interface BetterAuthSession {
  id: string
  userId: string
  token: string
  expiresAt: Date | string
  ipAddress?: string | null
  userAgent?: string | null
  createdAt?: Date | string
  updatedAt?: Date | string
  impersonatedBy?: string | null
}
import { parseError } from '@/taali/errors/client-handler'
import { useSupportingQuery } from '@/taali/hooks/use-supporting-query'
import { formatDate, formatDateTime } from '@/taali/utils/date'
import { Badge } from '@/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { Button } from '@/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/ui/sheet'
import {
  DataTable,
  DataTableHeader,
  useTableQuery,
  DataTableConfig,
  DataTableColumnMeta,
} from '@/taali/components/data-table'
import {
  getAdminUsersTable,
  getAdminUserStats,
  type AdminUser,
} from '@/features/admin/lib/admin-users.server'
import { useTranslation } from '@/i18n/hooks/useTranslation'

export const Route = createFileRoute('/_authenticated/superadmin/users')({
  component: SuperAdminUsers,
})

function SuperAdminUsers() {
  const { t } = useTranslation('admin')
  const { t: tNotifications } = useTranslation('notifications')
  const { t: tCommon } = useTranslation('common')
  const { showError } = useErrorHandler()
  const [selectedUser, setSelectedUser] = React.useState<AdminUser | null>(null)
  const [userSessions, setUserSessions] = React.useState<BetterAuthSession[]>([])
  const [sessionsLoading, setSessionsLoading] = React.useState(false)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [currentFilters, setCurrentFilters] = React.useState({})

  // Query for total stats (independent of filters)
  const { data: stats, showError: showStatsError } = useSupportingQuery({
    queryKey: ['admin', 'users', 'stats'],
    queryFn: () => getAdminUserStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Use the table query hook
  const { data, totalCount, isLoading, isFetching, isError, error, onStateChange, refetch } =
    useTableQuery<AdminUser>({
      queryKey: ['admin', 'users', 'table'],
      queryFn: params => {
        setCurrentFilters(params)
        return getAdminUsersTable({ data: params })
      },
      enabled: true,
    })

  const loadUserSessions = React.useCallback(
    async (userId: string) => {
      setSessionsLoading(true)
      try {
        const result = await authClient.admin.listUserSessions({
          userId,
        })
        setUserSessions((result.data?.sessions as BetterAuthSession[]) || [])
      } catch (error) {
        showError(error)
        setUserSessions([])
      } finally {
        setSessionsLoading(false)
      }
    },
    [showError]
  )

  const handleBanUser = React.useCallback(
    async (userId: string, banned: boolean) => {
      try {
        if (banned) {
          await authClient.admin.banUser({
            userId,
            banReason: t('users.adminAction'),
          })
        } else {
          await authClient.admin.unbanUser({
            userId,
          })
        }
        toast.success(
          banned ? tNotifications('success.userBanned') : tNotifications('success.userUnbanned')
        )
        refetch()
      } catch (error) {
        showError(error)
      }
    },
    [refetch, t, tNotifications, showError]
  )

  const handleRevokeUserSessions = React.useCallback(
    async (userId: string) => {
      try {
        await authClient.admin.revokeUserSessions({
          userId,
        })
        toast.success(t('messages.allSessionsRevoked'))
        // Reload sessions if we're viewing them
        if (selectedUser && selectedUser.id === userId) {
          loadUserSessions(userId)
        }
      } catch (error) {
        showError(error)
      }
    },
    [selectedUser, t, showError, loadUserSessions]
  )

  const handleRevokeSession = React.useCallback(
    async (sessionToken: string) => {
      try {
        await authClient.admin.revokeUserSession({
          sessionToken,
        })
        toast.success(t('messages.sessionRevoked'))
        // Reload sessions for the current user
        if (selectedUser) {
          loadUserSessions(selectedUser.id)
        }
      } catch (error) {
        showError(error)
      }
    },
    [selectedUser, t, showError, loadUserSessions]
  )

  const handleViewSessions = React.useCallback(
    async (user: AdminUser) => {
      setSelectedUser(user)
      setSheetOpen(true)
      await loadUserSessions(user.id)
    },
    [loadUserSessions]
  )

  const handleImpersonate = React.useCallback(
    async (userId: string) => {
      try {
        await authClient.admin.impersonateUser({ userId })
        toast.success(t('messages.impersonationStarted'))
        window.location.href = '/'
      } catch (error) {
        showError(error)
      }
    },
    [t, showError]
  )

  // Column definitions
  const columns = React.useMemo<ColumnDef<AdminUser>[]>(
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
          const user = row.original
          return <div className="text-xs font-mono text-muted-foreground">{user.id}</div>
        },
        meta: {
          enableTextTruncation: true,
        } as DataTableColumnMeta,
      },
      {
        id: 'user',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {t('users.user')}
          </DataTableHeader>
        ),
        enableSorting: true,
        size: 300,
        cell: ({ row }) => {
          const user = row.original
          return (
            <div>
              <div className="text-sm font-medium text-foreground">
                {user.name || tCommon('table.unknown')}
              </div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
            </div>
          )
        },
        meta: {
          enableTextTruncation: true,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: 'role',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {tCommon('labels.role')}
          </DataTableHeader>
        ),
        enableColumnFilter: true,
        enableSorting: true,
        size: 120,
        cell: ({ row }) => {
          const user = row.original
          return (
            <Badge
              variant={
                user.role === 'superadmin'
                  ? 'destructive'
                  : user.role === 'admin'
                    ? 'primary'
                    : 'muted'
              }
              appearance="soft"
              startIcon={
                user.role === 'superadmin' ? (
                  <Shield />
                ) : user.role === 'admin' ? (
                  <Shield />
                ) : (
                  <User />
                )
              }
            >
              {user.role === 'superadmin'
                ? t('users.superAdminRole')
                : user.role === 'admin'
                  ? t('users.admin')
                  : t('users.user')}
            </Badge>
          )
        },
        meta: {
          filterConfig: {
            type: 'select',
            title: tCommon('labels.role'),
            options: [
              { label: t('users.user'), value: 'user' },
              { label: t('users.admin'), value: 'admin' },
              { label: t('users.superAdminRole'), value: 'superadmin' },
            ],
          },
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: 'banned',
        id: 'status',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {tCommon('labels.status')}
          </DataTableHeader>
        ),
        enableColumnFilter: true,
        enableSorting: true,
        size: 100,
        cell: ({ row }) => {
          const user = row.original
          return user.banned ? (
            <Badge variant="destructive" appearance="soft">
              {t('users.bannedStatus')}
            </Badge>
          ) : (
            <Badge variant="success" appearance="soft" status>
              {t('users.active')}
            </Badge>
          )
        },
        meta: {
          filterConfig: {
            type: 'select',
            title: tCommon('labels.status'),
            options: [
              { label: t('users.active'), value: 'false' },
              { label: t('users.bannedStatus'), value: 'true' },
            ],
          },
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {t('users.joinedDate')}
          </DataTableHeader>
        ),
        enableColumnFilter: true,
        enableSorting: true,
        size: 150,
        cell: ({ row }) => {
          const user = row.original
          return <span className="text-sm text-muted-foreground">{formatDate(user.createdAt)}</span>
        },
        meta: {
          filterConfig: {
            type: 'dateRange',
            title: t('users.joinedDate'),
          },
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
      {
        id: 'actions',
        header: () => null,
        size: 50,
        enableResizing: false,
        cell: ({ row }) => {
          const user = row.original
          return (
            <div className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleImpersonate(user.id)}
                    disabled={user.banned}
                  >
                    <Eye />
                    {t('users.impersonate')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBanUser(user.id, !user.banned)}>
                    {user.banned ? (
                      <>
                        <UserCheck />
                        {t('users.unban')}
                      </>
                    ) : (
                      <>
                        <Ban />
                        {t('users.ban')}
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleViewSessions(user)}>
                    <Monitor />
                    {t('users.viewSessions')}
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
    [handleBanUser, handleImpersonate, handleViewSessions, t, tCommon]
  )

  // DataTable configuration
  const config = React.useMemo<DataTableConfig<AdminUser>>(
    () => ({
      searchConfig: {
        placeholder: t('users.search'),
        searchableColumns: ['name', 'email', 'id'],
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
        {/* User Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {showStatsError ? (
            <div className="col-span-full">
              <ErrorState
                error={parseError({ message: 'Unable to load user statistics' })}
                variant="inline"
              />
            </div>
          ) : (
            <>
              <div className="bg-card rounded-lg border p-4">
                <h3 className="text-sm font-medium mb-1">{t('analytics.totalUsers')}</h3>
                <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
              </div>

              <div className="bg-card rounded-lg border p-4">
                <h3 className="text-sm font-medium mb-1">{t('analytics.activeUsers')}</h3>
                <p className="text-2xl font-bold">{stats?.activeUsers || 0}</p>
              </div>

              <div className="bg-card rounded-lg border p-4">
                <h3 className="text-sm font-medium mb-1">{t('analytics.bannedUsers')}</h3>
                <p className="text-2xl font-bold">{stats?.bannedUsers || 0}</p>
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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[500px] sm:w-[540px] flex flex-col gap-0">
          <SheetHeader className="shrink-0 px-6 py-6 border-b">
            <SheetTitle>
              {selectedUser
                ? `${selectedUser.name || selectedUser.email}'s Sessions`
                : t('users.userSessions')}
              {!sessionsLoading && userSessions.length > 0 && ` (${userSessions.length})`}
            </SheetTitle>
            <SheetDescription>{t('sessions.description')}</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-6">
              {sessionsLoading ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              ) : userSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('sessions.noSessions')}
                </div>
              ) : (
                <div className="space-y-4">
                  {userSessions.map(session => (
                    <div key={session.id} className="border rounded-lg p-4 space-y-3">
                      <div className="grid gap-2 flex-1">
                        <div className="grid gap-1">
                          <div className="text-sm font-medium">{t('tables.sessionToken')}</div>
                          <div className="text-sm text-muted-foreground font-mono">
                            {session.token
                              ? session.token.substring(0, 16) + '...'
                              : t('users.unknown')}
                          </div>
                        </div>

                        <div className="grid gap-1">
                          <div className="text-sm font-medium">{t('tables.created')}</div>
                          <div className="text-sm text-muted-foreground">
                            {session.createdAt
                              ? formatDateTime(session.createdAt)
                              : t('users.unknown')}
                          </div>
                        </div>

                        {session.expiresAt && (
                          <div className="grid gap-1">
                            <div className="text-sm font-medium">{t('tables.expires')}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatDateTime(session.expiresAt)}
                            </div>
                          </div>
                        )}

                        {session.userAgent && (
                          <div className="grid gap-1">
                            <div className="text-sm font-medium">{t('tables.device')}</div>
                            <div className="text-sm text-muted-foreground">{session.userAgent}</div>
                          </div>
                        )}

                        {session.ipAddress && (
                          <div className="grid gap-1">
                            <div className="text-sm font-medium">{t('tables.ipAddress')}</div>
                            <div className="text-sm text-muted-foreground">{session.ipAddress}</div>
                          </div>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevokeSession(session.token || session.id)}
                        className="w-full"
                      >
                        {t('sessions.revoke')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 px-6 py-4 border-t bg-background">
            <Button
              variant="destructive"
              onClick={() => selectedUser && handleRevokeUserSessions(selectedUser.id)}
              disabled={sessionsLoading || userSessions.length === 0}
              className="w-full"
            >
              {t('sessions.revokeAll')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
