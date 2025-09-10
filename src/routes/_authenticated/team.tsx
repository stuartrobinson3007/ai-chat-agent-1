import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import {
  UserPlus,
  Mail,
  Trash2,
  Crown,
  Shield,
  User as UserIcon,
  Eye,
  MoreHorizontal,
  Clock,
  RefreshCw,
} from 'lucide-react'

import { useConfirm } from '@/ui/confirm-dialog'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { PageHeader } from '@/components/page-header'
import { useLoadingItems } from '@/taali/hooks/use-loading-state'
import { useClientPermissions } from '@/lib/hooks/use-permissions'
import {
  DataTable,
  DataTableHeader,
  useTableQuery,
  DataTableConfig,
  DataTableColumnMeta,
} from '@/taali/components/data-table'
import {
  getTeamMembersTable,
  inviteTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  cancelTeamInvitation,
  resendTeamInvitation,
  type TeamMember,
} from '@/features/team/lib/team.server'
import { useErrorHandler } from '@/lib/errors/hooks'
import { AppError } from '@/taali/utils/errors'
import { ERROR_CODES } from '@/taali/errors/codes'
import { ErrorState } from '@/components/error-state'
import { parseError } from '@/taali/errors/client-handler'
import { formatDate } from '@/taali/utils/date'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Button } from '@/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { Badge } from '@/ui/badge'
import { Input } from '@/ui/input'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/ui/separator'
import { FormField } from '@/taali/components/form/form-field'
import { useFieldError } from '@/lib/errors/hooks'

export const Route = createFileRoute('/_authenticated/team')({
  component: Team,
})

function Team() {
  const { activeOrganizationId } = useActiveOrganization()
  const { canInviteMembers, canCancelInvitations, hasPermission } = useClientPermissions()
  const [isInviteDialogOpen, setIsInviteDialogOpen] = React.useState(false)
  const [inviteEmail, setInviteEmail] = React.useState('')
  const [inviteRole, setInviteRole] = React.useState<'viewer' | 'member' | 'admin'>('member')
  const [inviteLoading, setInviteLoading] = React.useState(false)
  const [inviteError, setInviteError] = React.useState<unknown>(null)
  const { t } = useTranslation('team')
  const { t: tNotifications } = useTranslation('notifications')
  const { t: tCommon } = useTranslation('common')
  const { showError, showSuccess } = useErrorHandler()
  const confirm = useConfirm()
  const emailError = useFieldError(inviteError, 'email')
  const roleError = useFieldError(inviteError, 'role')

  // Loading states for individual member actions
  const {
    isLoading: isLoadingMember,
    startLoading: startMemberLoading,
    stopLoading: stopMemberLoading,
    loadingItems: loadingMembers,
  } = useLoadingItems<string>()

  // Use the table query hook
  const { data, totalCount, isLoading, isFetching, isError, error, onStateChange, refetch } =
    useTableQuery<TeamMember>({
      queryKey: activeOrganizationId ? ['team', 'table', activeOrganizationId] : [],
      queryFn: params => {
        return getTeamMembersTable({
          data: params,
        })
      },
      enabled: !!activeOrganizationId,
    })

  const handleInviteMember = async () => {
    if (!canInviteMembers()) {
      showError(
        new AppError(
          ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
          403,
          undefined,
          t('messages.notAuthorizedToInvite')
        )
      )
      return
    }

    if (!inviteEmail.trim()) {
      showError(
        new AppError(ERROR_CODES.VAL_REQUIRED_FIELD, 400, { field: t('labels.emailAddress') })
      )
      return
    }

    setInviteLoading(true)
    try {
      await inviteTeamMember({
        data: {
          organizationId: activeOrganizationId || '',
          email: inviteEmail,
          role: inviteRole,
        },
      })

      showSuccess(t('messages.invitationSent'))
      setInviteEmail('')
      setInviteRole('member')
      setIsInviteDialogOpen(false)
      refetch()
    } catch (error) {
      setInviteError(error)
      showError(error)
    } finally {
      setInviteLoading(false)
    }
  }

  // Reset form when dialog closes
  const handleDialogChange = (open: boolean) => {
    setIsInviteDialogOpen(open)
    if (!open) {
      setInviteEmail('')
      setInviteRole('member')
      setInviteError(null)
    }
  }

  const handleRemoveMember = React.useCallback(
    async (memberId: string, memberName: string) => {
      if (!hasPermission('member', 'delete')) {
        showError(AppError.forbidden('remove members'))
        return
      }

      const confirmed = await confirm({
        title: tNotifications('confirmations.removeMemberTitle'),
        description: tNotifications('confirmations.removeMember', { memberName }),
        confirmText: tCommon('actions.delete'),
        variant: 'destructive'
      })
      if (!confirmed) return

      startMemberLoading(memberId)
      try {
        await removeTeamMember({
          data: {
            organizationId: activeOrganizationId || '',
            memberIdOrEmail: memberId,
          },
        })

        showSuccess(t('messages.memberRemoved'))
        refetch()
      } catch (error) {
        showError(error)
      } finally {
        stopMemberLoading(memberId)
      }
    },
    [activeOrganizationId, startMemberLoading, stopMemberLoading, refetch, hasPermission, showError, showSuccess, t, tNotifications, confirm, tCommon]
  )

  const handleUpdateRole = React.useCallback(
    async (memberId: string, newRole: 'viewer' | 'member' | 'admin' | 'owner') => {
      if (!hasPermission('member', 'update')) {
        showError(AppError.forbidden('update member roles'))
        return
      }

      startMemberLoading(memberId)
      try {
        await updateTeamMemberRole({
          data: {
            organizationId: activeOrganizationId || '',
            memberId,
            role: newRole,
          },
        })

        showSuccess(t('messages.roleUpdated'))
        refetch()
      } catch (error) {
        showError(error)
      } finally {
        stopMemberLoading(memberId)
      }
    },
    [activeOrganizationId, startMemberLoading, stopMemberLoading, refetch, hasPermission, showError, showSuccess, t]
  )

  const handleCancelInvitation = React.useCallback(
    async (invitationId: string) => {
      if (!canCancelInvitations()) {
        showError(AppError.forbidden('cancel invitations'))
        return
      }

      const confirmed = await confirm({
        title: tCommon('actions.cancel'),
        description: t('invite.cancelConfirm'),
        confirmText: tCommon('actions.cancel'),
        variant: 'destructive'
      })
      if (!confirmed) return

      startMemberLoading(invitationId)
      try {
        await cancelTeamInvitation({
          data: {
            organizationId: activeOrganizationId || '',
            invitationId,
          },
        })

        showSuccess(t('messages.invitationCancelled'))
        refetch()
      } catch (error) {
        showError(error)
      } finally {
        stopMemberLoading(invitationId)
      }
    },
    [activeOrganizationId, startMemberLoading, stopMemberLoading, refetch, canCancelInvitations, showError, showSuccess, t, confirm, tCommon]
  )

  const handleResendInvitation = React.useCallback(
    async (invitationId: string, email: string) => {
      const canCreate = hasPermission('invitation', 'create')
      const canCancel = canCancelInvitations()

      if (!canCreate || !canCancel) {
        showError(AppError.forbidden('resend invitations'))
        return
      }

      const confirmed = await confirm({
        title: tNotifications('confirmations.resendInvitationTitle'),
        description: tNotifications('confirmations.resendInvitation', { email }),
        confirmText: t('actions.resendInvitation')
      })
      if (!confirmed) return

      startMemberLoading(invitationId)
      try {
        await resendTeamInvitation({
          data: {
            organizationId: activeOrganizationId || '',
            invitationId,
          },
        })

        showSuccess(t('messages.invitationResent'))
        refetch()
      } catch (error) {
        showError(error)
      } finally {
        stopMemberLoading(invitationId)
      }
    },
    [
      activeOrganizationId,
      startMemberLoading,
      stopMemberLoading,
      refetch,
      hasPermission,
      canCancelInvitations,
      showError,
      showSuccess,
      t,
      tNotifications,
      confirm,
    ]
  )

  const getRoleIcon = React.useCallback((role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-warning" />
      case 'admin':
        return <Shield className="w-4 h-4 text-primary" />
      case 'viewer':
        return <Eye className="w-4 h-4 text-muted-foreground" />
      default:
        return <UserIcon className="w-4 h-4 text-muted-foreground" />
    }
  }, [])

  const getRoleDisplayName = React.useCallback(
    (role: string) => {
      const roleDisplayMap: Record<string, string> = {
        owner: t('roles.owner'),
        admin: t('roles.admin'),
        member: t('roles.member'),
        viewer: t('roles.viewer'),
      }
      return roleDisplayMap[role] || role
    },
    [t]
  )

  // Column definitions
  const columns = React.useMemo<ColumnDef<TeamMember>[]>(() => {
    const cols: ColumnDef<TeamMember>[] = [
      {
        id: 'member',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {t('table.member')}
          </DataTableHeader>
        ),
        enableSorting: true,
        size: 300,
        cell: ({ row }) => {
          const member = row.original
          const isLoading = isLoadingMember(member.id)
          return (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                {member.avatar ? (
                  <img src={member.avatar} alt="" className="w-8 h-8 rounded-full" />
                ) : member.type === 'invitation' ? (
                  <Mail className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <UserIcon className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <span className={`font-medium ${isLoading ? 'opacity-50' : ''}`}>
                {member.name || member.email.split('@')[0]}
              </span>
            </div>
          )
        },
        meta: {
          enableTextTruncation: true,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: 'email',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {t('table.email')}
          </DataTableHeader>
        ),
        enableSorting: true,
        size: 250,
        meta: {
          enableTextTruncation: true,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: 'role',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {t('table.role')}
          </DataTableHeader>
        ),
        enableSorting: true,
        size: 120,
        cell: ({ row }) => {
          const member = row.original
          return (
            <Badge
              variant={
                member.role === 'owner' ? 'warning' : member.role === 'admin' ? 'primary' : 'muted'
              }
              appearance="soft"
              startIcon={getRoleIcon(member.role)}
            >
              {getRoleDisplayName(member.role)}
            </Badge>
          )
        },
        meta: {
          filterConfig: {
            type: 'select',
            title: t('table.role'),
            options: [
              { label: t('roles.owner'), value: 'owner' },
              { label: t('roles.admin'), value: 'admin' },
              { label: t('roles.member'), value: 'member' },
              { label: t('roles.viewer'), value: 'viewer' },
            ],
          },
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {t('table.status')}
          </DataTableHeader>
        ),
        enableSorting: true,
        size: 100,
        cell: ({ row }) => {
          const member = row.original
          if (member.status === 'pending') {
            return (
              <Badge variant="warning" appearance="soft" startIcon={<Clock />}>
                {t('status.pending')}
              </Badge>
            )
          }
          return (
            <Badge variant="success" appearance="soft" status>
              {t('status.active')}
            </Badge>
          )
        },
        meta: {
          filterConfig: {
            type: 'select',
            title: t('table.status'),
            options: [
              { label: t('status.active'), value: 'active' },
              { label: t('status.pending'), value: 'pending' },
            ],
          },
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
      {
        accessorKey: 'joinedAt',
        header: ({ column }) => (
          <DataTableHeader column={column} sortable>
            {t('table.joined')}
          </DataTableHeader>
        ),
        enableSorting: true,
        size: 150,
        cell: ({ row }) => {
          const member = row.original
          if (member.joinedAt) {
            return (
              <span className="text-sm text-muted-foreground">{formatDate(member.joinedAt)}</span>
            )
          } else if (member.expiresAt) {
            return (
              <span className="text-sm text-muted-foreground">
                Expires {formatDate(member.expiresAt)}
              </span>
            )
          }
          return <span className="text-sm text-muted-foreground">-</span>
        },
        meta: {
          filterConfig: {
            type: 'date',
            title: t('table.joined'),
          },
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      },
    ]

    // Only add actions column if user has permissions
    const canUpdateMembers = hasPermission('member', 'update')
    const canDeleteMembers = hasPermission('member', 'delete')
    const canCancelInvitationsCheck = canCancelInvitations()
    const canResendInvitations = hasPermission('invitation', 'create') && canCancelInvitations()
    const hasAnyPermission =
      canUpdateMembers || canDeleteMembers || canCancelInvitationsCheck || canResendInvitations

    if (hasAnyPermission) {
      cols.push({
        id: 'actions',
        header: () => null,
        size: 50,
        enableResizing: false,
        cell: ({ row }) => {
          const member = row.original
          const isLoading = isLoadingMember(member.id)

          if (member.role === 'owner') {
            return null
          }

          // Check if user has any permissions for this member type
          const canActOnMember =
            member.type === 'member'
              ? canUpdateMembers || canDeleteMembers
              : canCancelInvitationsCheck || canResendInvitations

          if (!canActOnMember) return null

          return (
            <div className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={isLoading}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {member.type === 'member' ? (
                    <>
                      {canUpdateMembers && (
                        <>
                          <DropdownMenuItem
                            onClick={() => handleUpdateRole(member.id, 'viewer')}
                            disabled={member.role === 'viewer' || isLoading}
                          >
                            <Eye />
                            {t('actions.setViewer')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleUpdateRole(member.id, 'member')}
                            disabled={member.role === 'member' || isLoading}
                          >
                            <UserIcon />
                            {t('actions.setMember')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleUpdateRole(member.id, 'admin')}
                            disabled={member.role === 'admin' || isLoading}
                          >
                            <Shield />
                            {t('actions.setAsAdmin')}
                          </DropdownMenuItem>
                        </>
                      )}
                      {canUpdateMembers && canDeleteMembers && <DropdownMenuSeparator />}
                      {canDeleteMembers && (
                        <DropdownMenuItem
                          onClick={() => handleRemoveMember(member.id, member.name || member.email)}
                          disabled={isLoading}
                        >
                          <Trash2 />
                          {t('actions.removeMember')}
                        </DropdownMenuItem>
                      )}
                    </>
                  ) : (
                    <>
                      {canResendInvitations && (
                        <DropdownMenuItem
                          onClick={() => handleResendInvitation(member.id, member.email)}
                          disabled={isLoading}
                        >
                          <RefreshCw />
                          {t('actions.resendInvitation')}
                        </DropdownMenuItem>
                      )}
                      {canResendInvitations && canCancelInvitationsCheck && (
                        <DropdownMenuSeparator />
                      )}
                      {canCancelInvitationsCheck && (
                        <DropdownMenuItem
                          onClick={() => handleCancelInvitation(member.id)}
                          disabled={isLoading}
                        >
                          <Trash2 />
                          {t('actions.cancelInvitation')}
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
        enableSorting: false,
        meta: {
          enableTextTruncation: false,
        } as DataTableColumnMeta,
      })
    }

    return cols
  }, [
    getRoleIcon,
    getRoleDisplayName,
    isLoadingMember,
    handleUpdateRole,
    handleRemoveMember,
    handleCancelInvitation,
    handleResendInvitation,
    hasPermission,
    canCancelInvitations,
    t,
  ])

  // DataTable configuration
  const config = React.useMemo<DataTableConfig<TeamMember>>(
    () => ({
      searchConfig: {
        placeholder: t('table.search'),
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

  if (!activeOrganizationId) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <span className="font-semibold">{t('teamLabel')}</span>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">{t('table.noOrganization')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <PageHeader
        title={t('title')}
        actions={
          canInviteMembers() ? (
            <Button onClick={() => setIsInviteDialogOpen(true)}>
              <UserPlus />
              {t('actions.inviteMember')}
            </Button>
          ) : undefined
        }
      />

      {/* Main Content */}
      <div className="flex-1 p-6">
        <DataTable
          columns={columns}
          data={data}
          config={config}
          totalCount={totalCount}
          onStateChange={onStateChange}
          isLoading={isLoading}
          isFetching={isFetching}
          loadingRows={loadingMembers}
          getRowIdProp={row => row.id}
          className='h-[600px]'
          resetText={tCommon('actions.reset')}
          noResultsText={tCommon('messages.noResults')}
        />
      </div>

      <Dialog open={isInviteDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('invite.title')}</DialogTitle>
            <DialogDescription>{t('dialogs.inviteDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <FormField name="email" label={t('labels.emailAddress')} error={inviteError} required>
              <Input
                id="invite-email"
                type="email"
                placeholder={t('invite.emailPlaceholder')}
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                autoComplete="off"
                className={emailError ? 'border-destructive' : ''}
              />
            </FormField>

            <FormField name="role" label={t('labels.role')} error={inviteError}>
              <Select value={inviteRole} onValueChange={(value: 'viewer' | 'member' | 'admin') => setInviteRole(value)}>
                <SelectTrigger id="role" className={roleError ? 'border-destructive' : ''}>
                  <SelectValue placeholder={t('invite.role')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">
                    {t('roles.viewer')} - {t('roles.viewerDescription')}
                  </SelectItem>
                  <SelectItem value="member">
                    {t('roles.member')} - {t('roles.memberDescription')}
                  </SelectItem>
                  <SelectItem value="admin">
                    {t('roles.admin')} - {t('roles.adminDescription')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogChange(false)}>
              {t('dialogs.cancel')}
            </Button>
            <Button onClick={handleInviteMember} loading={inviteLoading}>
              {t('dialogs.sendButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
