# Team Management System Implementation Guide

This document provides comprehensive guidance for implementing team management functionality including member invitations, role management, member removal, and team collaboration features with proper permission controls.

## 🚨 Critical Rules

- **ALWAYS check member permissions** - Verify user can manage the organization before operations
- **MUST validate invitation states** - Check invitation status before operations
- **NEVER allow role escalation attacks** - Prevent users from granting themselves higher roles
- **ALWAYS use Better Auth organization API** - Leverage built-in member management features
- **MUST handle duplicate invitations** - Prevent multiple invitations to same email

## ❌ Common AI Agent Mistakes

### Permission Bypass in Member Management
```typescript
// ❌ NEVER skip organization membership validation
export const inviteMember = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ data }) => {
    // No organization permission check - security vulnerability!
    await auth.api.createInvitation(data)
  })

// ✅ ALWAYS validate organization access
export const inviteMember = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(inviteMemberSchema.parse)
  .handler(async ({ data, context }) => {
    // REQUIRED: Check invitation permissions
    await checkPermission('invitation', ['create'], data.organizationId)

    await auth.api.createInvitation({
      organizationId: data.organizationId,
      email: data.email,
      role: data.role,
    })
  })
```

### Role Escalation Vulnerabilities
```typescript
// ❌ NEVER allow users to grant roles higher than their own
export const updateMemberRole = createServerFn({ method: 'POST' })
  .handler(async ({ data }) => {
    // No role validation - users could grant owner permissions!
    await auth.api.updateMemberRole(data)
  })

// ✅ ALWAYS validate role hierarchy
export const updateMemberRole = createServerFn({ method: 'POST' })
  .handler(async ({ data, context }) => {
    // Get current user's role
    const currentMember = await db
      .select()
      .from(member)
      .where(and(
        eq(member.userId, context.user.id),
        eq(member.organizationId, data.organizationId)
      ))
      .limit(1)

    // Prevent role escalation
    const roleHierarchy = ['viewer', 'member', 'admin', 'owner']
    const currentRoleLevel = roleHierarchy.indexOf(currentMember[0]?.role || 'viewer')
    const targetRoleLevel = roleHierarchy.indexOf(data.role)

    if (targetRoleLevel >= currentRoleLevel) {
      throw new AppError('FORBIDDEN', 403, undefined, 'Cannot grant equal or higher role')
    }

    await auth.api.updateMemberRole(data)
  })
```

### Duplicate Invitation Issues
```typescript
// ❌ NEVER skip duplicate invitation checks
export const inviteUser = createServerFn({ method: 'POST' })
  .handler(async ({ data }) => {
    // No duplicate check - could spam users with invitations
    await auth.api.createInvitation(data)
  })

// ✅ ALWAYS check for existing members and invitations
export const inviteUser = createServerFn({ method: 'POST' })
  .handler(async ({ data }) => {
    // Check existing member
    const existingMember = await db
      .select()
      .from(member)
      .leftJoin(user, eq(member.userId, user.id))
      .where(and(
        eq(member.organizationId, data.organizationId),
        eq(user.email, data.email)
      ))
      .limit(1)

    if (existingMember.length > 0) {
      throw new AppError('BIZ_DUPLICATE_ENTRY', 400, undefined, 'User is already a member')
    }

    // Check pending invitation
    const existingInvite = await db
      .select()
      .from(invitation)
      .where(and(
        eq(invitation.organizationId, data.organizationId),
        eq(invitation.email, data.email),
        eq(invitation.status, 'pending')
      ))
      .limit(1)

    if (existingInvite.length > 0) {
      throw new AppError('BIZ_DUPLICATE_ENTRY', 400, undefined, 'Invitation already sent')
    }

    await auth.api.createInvitation(data)
  })
```

## ✅ Established Patterns

### 1. **Team Member Data Structure**
```typescript
// File: src/features/team/lib/team.server.ts
export type TeamMember = {
  id: string
  type: 'member' | 'invitation'
  email: string
  name: string | null
  role: string
  status: 'active' | 'pending'
  joinedAt: Date | null
  expiresAt: Date | null
  avatar: string | null
  userId: string | null
}
```

### 2. **Team Members with DataTable Integration**
```typescript
// Import organizationMiddleware for proper access control
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
// Complete team management with pagination and filtering
export const getTeamMembersTable = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware]) // Gets organizationId from context, verifies membership
  .validator((data: unknown) => {
    // organizationId comes from middleware context, not data parameter
    const params = data as ServerQueryParams
    return params
  })
  .handler(async ({ data, context }) => {
    const organizationId = context.organizationId
    if (!organizationId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: 'organizationId' },
        'No organization context'
      )
    }
    
    // NOTE: organizationMiddleware already verified user is a member
    // Better Auth's defaultStatements for 'member' only includes ['create', 'update', 'delete']
    // There is no 'read' permission - viewing is controlled by organization membership

    const pageIndex = data.pagination?.pageIndex ?? 0
    const pageSize = data.pagination?.pageSize ?? 10
    const offset = pageIndex * pageSize
    const searchTerm = data.search || ''

    // Fetch members with user details
    const membersQuery = db
      .select({
        id: member.id,
        userId: member.userId,
        role: member.role,
        createdAt: member.createdAt,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
      })
      .from(member)
      .leftJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, organizationId))

    // Fetch pending invitations
    const invitationsQuery = db
      .select({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        inviterName: user.name,
      })
      .from(invitation)
      .leftJoin(user, eq(invitation.inviterId, user.id))
      .where(
        and(
          eq(invitation.organizationId, organizationId),
          eq(invitation.status, 'pending')
        )
      )

    const [membersResult, invitationsResult] = await Promise.all([membersQuery, invitationsQuery])

    // Transform and merge data
    let teamMembers: TeamMember[] = [
      // Active members
      ...membersResult.map(m => ({
        id: m.id,
        type: 'member' as const,
        email: m.userEmail || '',
        name: m.userName,
        role: m.role || 'member',
        status: 'active' as const,
        joinedAt: m.createdAt,
        expiresAt: null,
        avatar: m.userImage,
        userId: m.userId,
      })),
      // Pending invitations
      ...invitationsResult.map(i => ({
        id: i.id,
        type: 'invitation' as const,
        email: i.email,
        name: null,
        role: i.role || 'member',
        status: 'pending' as const,
        joinedAt: null,
        expiresAt: i.expiresAt,
        avatar: null,
        userId: null,
      })),
    ]

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      teamMembers = teamMembers.filter(
        member =>
          member.name?.toLowerCase().includes(searchLower) ||
          member.email.toLowerCase().includes(searchLower)
      )
    }

    // Apply role filter
    if (data.filters?.role) {
      teamMembers = teamMembers.filter(member => member.role === data.filters!.role)
    }

    // Apply status filter
    if (data.filters?.status) {
      teamMembers = teamMembers.filter(member => member.status === data.filters!.status)
    }

    // Apply sorting
    if (data.sorting && data.sorting.length > 0) {
      const sort = data.sorting[0]
      teamMembers.sort((a, b) => {
        let compareValue = 0

        switch (sort.id) {
          case 'name': {
            const aName = a.name || a.email
            const bName = b.name || b.email
            compareValue = aName.localeCompare(bName)
            break
          }
          case 'email':
            compareValue = a.email.localeCompare(b.email)
            break
          case 'role': {
            const roleOrder = { owner: 0, admin: 1, member: 2, viewer: 3 }
            compareValue =
              (roleOrder[a.role as keyof typeof roleOrder] || 99) -
              (roleOrder[b.role as keyof typeof roleOrder] || 99)
            break
          }
          case 'status':
            compareValue = a.status.localeCompare(b.status)
            break
          case 'joinedAt': {
            const aDate = a.joinedAt || a.expiresAt || new Date(0)
            const bDate = b.joinedAt || b.expiresAt || new Date(0)
            compareValue = aDate.getTime() - bDate.getTime()
            break
          }
        }

        return sort.desc ? -compareValue : compareValue
      })
    }

    const totalCount = teamMembers.length
    const pageCount = Math.ceil(totalCount / pageSize)
    const paginatedMembers = teamMembers.slice(offset, offset + pageSize)

    return {
      data: paginatedMembers,
      totalCount,
      pageCount,
    }
  })
```

### 3. **Member Invitation Management**
```typescript
// Comprehensive invitation management
export const inviteTeamMember = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(inviteMemberSchema.parse)
  .handler(async ({ data }) => {
    // REQUIRED: Check invitation permissions
    await checkPermission('invitation', ['create'], data.organizationId)

    const request = getWebRequest()

    // Check if user is already a member
    const existingMember = await db
      .select()
      .from(member)
      .leftJoin(user, eq(member.userId, user.id))
      .where(and(eq(member.organizationId, data.organizationId), eq(user.email, data.email)))
      .limit(1)

    if (existingMember.length > 0) {
      throw new AppError(
        ERROR_CODES.BIZ_DUPLICATE_ENTRY,
        400,
        { resource: 'member' },
        'User is already a member of this organization'
      )
    }

    // Check for existing pending invitation
    const existingInvite = await db
      .select()
      .from(invitation)
      .where(
        and(
          eq(invitation.organizationId, data.organizationId),
          eq(invitation.email, data.email),
          eq(invitation.status, 'pending')
        )
      )
      .limit(1)

    if (existingInvite.length > 0) {
      throw new AppError(
        ERROR_CODES.BIZ_DUPLICATE_ENTRY,
        400,
        { resource: 'invitation' },
        'Invitation already sent to this email'
      )
    }

    // Create invitation using Better Auth
    const result = await auth.api.createInvitation({
      headers: request.headers,
      body: {
        organizationId: data.organizationId,
        email: data.email,
        role: data.role,
      },
    })

    if (!result) {
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'Failed to create invitation'
      )
    }

    return result
  })

// Resend invitation with proper validation
export const resendTeamInvitation = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(resendInvitationSchema.parse)
  .handler(async ({ data }) => {
    await checkPermission('invitation', ['create'], data.organizationId)
    await checkPermission('invitation', ['cancel'], data.organizationId)

    const request = getWebRequest()

    // Verify invitation exists and belongs to organization
    const invite = await db
      .select()
      .from(invitation)
      .where(eq(invitation.id, data.invitationId))
      .limit(1)

    if (!invite[0] || invite[0].organizationId !== data.organizationId) {
      throw AppError.notFound('Invitation')
    }

    if (invite[0].status !== 'pending') {
      throw new AppError(
        ERROR_CODES.BIZ_INVALID_STATE,
        400,
        undefined,
        'Only pending invitations can be resent'
      )
    }

    // Cancel existing invitation
    const cancelResult = await auth.api.cancelInvitation({
      headers: request.headers,
      body: { invitationId: data.invitationId },
    })

    if (!cancelResult) {
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'Failed to cancel existing invitation'
      )
    }

    // Create new invitation with same details
    const result = await auth.api.createInvitation({
      headers: request.headers,
      body: {
        organizationId: data.organizationId,
        email: invite[0].email,
        role: (invite[0].role as 'member' | 'admin' | 'owner' | 'viewer') || 'member',
      },
    })

    if (!result) {
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'Failed to create new invitation'
      )
    }

    return result
  })
```

### 4. **Member Role Management**
```typescript
// Role update with hierarchy validation
export const updateTeamMemberRole = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(updateMemberRoleSchema.parse)
  .handler(async ({ data, context }) => {
    await checkPermission('member', ['update'], data.organizationId)

    const request = getWebRequest()

    // Get current user's role in organization
    const currentUserMember = await db
      .select()
      .from(member)
      .where(and(
        eq(member.userId, context.user.id),
        eq(member.organizationId, data.organizationId)
      ))
      .limit(1)

    if (!currentUserMember[0]) {
      throw AppError.forbidden('access organization')
    }

    // Get target member's current role
    const targetMember = await db
      .select()
      .from(member)
      .where(eq(member.id, data.memberId))
      .limit(1)

    if (!targetMember[0]) {
      throw AppError.notFound('Member')
    }

    // Prevent changing owner role (only owner can transfer ownership)
    if (targetMember[0].role === 'owner' && currentUserMember[0].role !== 'owner') {
      throw new AppError(
        ERROR_CODES.BIZ_INVALID_STATE,
        400,
        undefined,
        'Only owners can change owner roles'
      )
    }

    // Prevent granting roles equal to or higher than current user's role
    const roleHierarchy = ['viewer', 'member', 'admin', 'owner']
    const currentRoleLevel = roleHierarchy.indexOf(currentUserMember[0].role || 'member')
    const targetRoleLevel = roleHierarchy.indexOf(data.role)

    if (targetRoleLevel >= currentRoleLevel && currentUserMember[0].role !== 'owner') {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        403,
        undefined,
        'Cannot grant equal or higher role'
      )
    }

    const result = await auth.api.updateMemberRole({
      headers: request.headers,
      body: {
        organizationId: data.organizationId,
        memberId: data.memberId,
        role: data.role,
      },
    })

    if (!result) {
      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        'Failed to update member role'
      )
    }

    return result
  })
```

### 5. **Member Removal**
```typescript
// Safe member removal with validation
export const removeTeamMember = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(removeMemberSchema.parse)
  .handler(async ({ data, context }) => {
    await checkPermission('member', ['delete'], data.organizationId)

    const request = getWebRequest()

    // Prevent self-removal if owner
    const currentMember = await db
      .select()
      .from(member)
      .where(and(
        eq(member.userId, context.user.id),
        eq(member.organizationId, data.organizationId)
      ))
      .limit(1)

    // Find target member to prevent removing owners
    const targetMember = await db
      .select()
      .from(member)
      .leftJoin(user, eq(member.userId, user.id))
      .where(and(
        eq(member.organizationId, data.organizationId),
        or(
          eq(member.id, data.memberIdOrEmail),
          eq(user.email, data.memberIdOrEmail)
        )
      ))
      .limit(1)

    if (targetMember[0]?.role === 'owner') {
      throw new AppError(
        ERROR_CODES.BIZ_INVALID_STATE,
        400,
        undefined,
        'Cannot remove organization owner'
      )
    }

    // Prevent non-owners from removing admins
    if (targetMember[0]?.role === 'admin' && currentMember[0]?.role !== 'owner') {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        403,
        undefined,
        'Only owners can remove admins'
      )
    }

    const result = await auth.api.removeMember({
      headers: request.headers,
      body: {
        organizationId: data.organizationId,
        memberIdOrEmail: data.memberIdOrEmail,
      },
    })

    if (!result) {
      throw new AppError(ERROR_CODES.SYS_SERVER_ERROR, 500, undefined, 'Failed to remove member')
    }

    return result
  })
```

### 6. **Client-Side Team Management Hook**
```typescript
// Comprehensive team management hook
export function useTeamManagement(organizationId: string) {
  const queryClient = useQueryClient()
  const { showError, showSuccess } = useErrorHandler()

  // Team members query with data table integration
  const membersTableQuery = useTableQuery<TeamMember>({
    queryKey: ['team-members', organizationId],
    queryFn: (params) => getTeamMembersTable({ ...params, organizationId }),
    enabled: !!organizationId,
    defaultPageSize: 20,
  })

  // Invite member mutation
  const inviteMutation = useMutation({
    mutationFn: inviteTeamMember,
    onSuccess: () => {
      showSuccess('Invitation sent successfully')
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
    onError: showError,
  })

  // Update member role mutation
  const updateRoleMutation = useMutation({
    mutationFn: updateTeamMemberRole,
    onSuccess: () => {
      showSuccess('Member role updated successfully')
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
    onError: showError,
  })

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: removeTeamMember,
    onSuccess: () => {
      showSuccess('Member removed successfully')
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
    onError: showError,
  })

  // Resend invitation mutation
  const resendInviteMutation = useMutation({
    mutationFn: resendTeamInvitation,
    onSuccess: () => {
      showSuccess('Invitation resent successfully')
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
    onError: showError,
  })

  // Cancel invitation mutation
  const cancelInviteMutation = useMutation({
    mutationFn: cancelTeamInvitation,
    onSuccess: () => {
      showSuccess('Invitation cancelled')
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
    onError: showError,
  })

  return {
    // Data table integration
    ...membersTableQuery,
    
    // Actions
    inviteMember: inviteMutation.mutate,
    updateMemberRole: updateRoleMutation.mutate,
    removeMember: removeMemberMutation.mutate,
    resendInvitation: resendInviteMutation.mutate,
    cancelInvitation: cancelInviteMutation.mutate,
    
    // Loading states
    isInviting: inviteMutation.isPending,
    isUpdatingRole: updateRoleMutation.isPending,
    isRemoving: removeMemberMutation.isPending,
    isResending: resendInviteMutation.isPending,
    isCancelling: cancelInviteMutation.isPending,
  }
}
```

## 🔧 Step-by-Step Implementation

### 1. **Team Management Page Component**
```typescript
// Complete team management interface
import { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, UserPlus, Mail, Trash2 } from 'lucide-react'

function TeamManagementPage() {
  const { activeOrganizationId } = useActiveOrganization()
  const { t } = useTranslation(['team', 'common'])
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)

  const teamManagement = useTeamManagement(activeOrganizationId!)

  const columns: ColumnDef<TeamMember>[] = [
    {
      accessorKey: 'name',
      header: 'Member',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={row.original.avatar || undefined} />
            <AvatarFallback>
              {(row.original.name || row.original.email)[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">
              {row.original.name || row.original.email}
            </div>
            {row.original.name && (
              <div className="text-sm text-muted-foreground">
                {row.original.email}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => (
        <Badge variant={
          row.original.role === 'owner' ? 'destructive' :
          row.original.role === 'admin' ? 'default' : 'secondary'
        }>
          {row.original.role}
        </Badge>
      ),
      meta: {
        filterConfig: {
          type: 'select',
          options: [
            { label: 'All Roles', value: '' },
            { label: 'Owner', value: 'owner' },
            { label: 'Admin', value: 'admin' },
            { label: 'Member', value: 'member' },
            { label: 'Viewer', value: 'viewer' },
          ],
        },
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>
          {row.original.status === 'pending' ? 'Invited' : 'Active'}
        </Badge>
      ),
      meta: {
        filterConfig: {
          type: 'select',
          options: [
            { label: 'All', value: '' },
            { label: 'Active', value: 'active' },
            { label: 'Pending', value: 'pending' },
          ],
        },
      },
    },
    {
      accessorKey: 'joinedAt',
      header: 'Joined',
      cell: ({ row }) => {
        const date = row.original.joinedAt || row.original.expiresAt
        return date ? formatDate(date) : 'Pending'
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.original.type === 'invitation' ? (
              <>
                <DropdownMenuItem onClick={() => teamManagement.resendInvitation({ 
                  invitationId: row.original.id,
                  organizationId: activeOrganizationId 
                })}>
                  <Mail />
                  Resend Invitation
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => teamManagement.cancelInvitation({ 
                  invitationId: row.original.id,
                  organizationId: activeOrganizationId 
                })}>
                  <Trash2 />
                  Cancel Invitation
                </DropdownMenuItem>
              </>
            ) : (
              <>
                {row.original.role !== 'owner' && (
                  <>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Change Role</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {['viewer', 'member', 'admin'].map((role) => (
                          <DropdownMenuItem
                            key={role}
                            onClick={() => teamManagement.updateMemberRole({
                              memberId: row.original.id,
                              role: role as 'viewer' | 'member' | 'admin',
                              organizationId: activeOrganizationId,
                            })}
                            disabled={role === row.original.role}
                          >
                            {role}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem
                      onClick={() => teamManagement.removeMember({
                        memberIdOrEmail: row.original.id,
                        organizationId: activeOrganizationId,
                      })}
                      className="text-destructive"
                    >
                      <Trash2 />
                      Remove Member
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)}>
          <UserPlus />
          {t('actions.inviteMember')}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={teamManagement.data}
        totalCount={teamManagement.totalCount}
        isLoading={teamManagement.isLoading}
        config={{
          enableColumnFilters: true,
          enableRowSelection: false,
          manualFiltering: true,
          manualPagination: true,
          manualSorting: true,
          searchConfig: {
            placeholder: t('search.placeholder'),
          },
          paginationConfig: {
            pageSizeOptions: [10, 20, 50],
            defaultPageSize: 20,
          },
        }}
        onStateChange={teamManagement.onStateChange}
      />

      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onInvite={(data) => {
          teamManagement.inviteMember({ ...data, organizationId: activeOrganizationId })
          setInviteDialogOpen(false)
        }}
      />
    </div>
  )
}
```

## 🎯 Integration Requirements

### With Better Auth Organization Plugin
```typescript
// Team management integrates with Better Auth organization features
import { auth } from '@/lib/auth/auth'

// All member operations use Better Auth API
await auth.api.createInvitation({ organizationId, email, role })
await auth.api.updateMemberRole({ organizationId, memberId, role })
await auth.api.removeMember({ organizationId, memberIdOrEmail })
await auth.api.cancelInvitation({ invitationId })
```

### With Permission System
```typescript
// IMPORTANT: Viewing team members does NOT require permission checks
// All organization members can view the team - access is controlled by organizationMiddleware
// Better Auth's defaultStatements for 'member' only includes ['create', 'update', 'delete']

// Modifying team members requires proper permissions:
await checkPermission('invitation', ['create'], organizationId)  // For inviting
await checkPermission('member', ['update'], organizationId)      // For role changes
await checkPermission('member', ['delete'], organizationId)      // For removal
await checkPermission('invitation', ['cancel'], organizationId)  // For canceling
```

### With Email System
```typescript
// Invitations automatically trigger emails via Better Auth
// Email content managed through email system documentation
export const auth = betterAuth({
  plugins: [
    organization({
      sendInvitationEmail: async (data) => {
        const inviteUrl = `${process.env.BETTER_AUTH_URL}/invite/${data.id}`
        await sendInvitationEmail(
          data.email,
          data.inviter?.user?.name || 'A team member',
          data.organization.name,
          inviteUrl
        )
      },
    }),
  ],
})
```

## 🧪 Testing Requirements

### Team Management Testing
```typescript
// Test team operations with proper security
describe('Team Management', () => {
  it('should prevent role escalation', async () => {
    const memberContext = {
      user: { id: 'user1', role: 'user' },
    }

    await expect(
      updateTeamMemberRole.handler({
        data: { 
          memberId: 'member1', 
          role: 'owner', 
          organizationId: 'org1' 
        },
        context: memberContext,
      })
    ).rejects.toThrow('Cannot grant equal or higher role')
  })

  it('should prevent duplicate invitations', async () => {
    vi.mocked(db.select).mockResolvedValue([{ email: 'test@example.com' }])

    await expect(
      inviteTeamMember.handler({
        data: {
          email: 'test@example.com',
          role: 'member',
          organizationId: 'org1',
        }
      })
    ).rejects.toThrow('Invitation already sent')
  })
})
```

## 📋 Implementation Checklist

Before considering team management complete, verify:

- [ ] **Permission Checks**: All team operations verify proper permissions
- [ ] **Role Hierarchy**: Role escalation prevention implemented
- [ ] **Duplicate Prevention**: Existing member and invitation checks
- [ ] **Owner Protection**: Owner role changes restricted appropriately
- [ ] **Better Auth Integration**: All operations use Better Auth organization API
- [ ] **Email Integration**: Invitations trigger proper email notifications
- [ ] **Data Table Support**: Team management integrates with advanced data tables
- [ ] **Error Handling**: Comprehensive error messages and user feedback
- [ ] **Security Validation**: All operations validate organization membership
- [ ] **Audit Logging**: Administrative actions properly logged

This team management system provides comprehensive member administration with proper security controls, role hierarchy enforcement, and seamless integration with the Better Auth organization system.