# Super Admin System Implementation Guide

This document provides comprehensive guidance for implementing the super admin system including user impersonation, admin layouts, user/workspace management, and visual admin wrapper components.

## 🚨 Critical Rules

- **ALWAYS validate super admin permissions** - Never skip admin role verification
- **MUST use visual impersonation indicators** - Clear visual feedback when impersonating
- **NEVER bypass security in admin functions** - Admin operations still require proper validation
- **ALWAYS provide exit mechanisms** - Users must be able to exit impersonation easily
- **MUST audit admin actions** - Log all administrative operations for security

## ❌ Common AI Agent Mistakes

### Admin Permission Bypass
```typescript
// ❌ NEVER skip admin role verification
export const adminAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // No admin check - security vulnerability!
    await db.delete(user).where(eq(user.id, userId))
  })

// ✅ ALWAYS verify admin permissions
export const adminAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // REQUIRED: Admin role verification
    if (context.user.role !== 'superadmin') {
      throw new AppError('FORBIDDEN', 403, undefined, 'Admin access required')
    }
    
    // Safe to perform admin operation
    await db.delete(user).where(eq(user.id, userId))
  })
```

### Impersonation UI Violations
```typescript
// ❌ NEVER implement impersonation without visual indicators
function AdminUserManagement() {
  const startImpersonation = (userId: string) => {
    // No visual feedback - users won't know they're impersonating
    await authClient.admin.impersonateUser({ userId })
  }
}

// ✅ ALWAYS use SuperAdminWrapper for visual feedback
import { SuperAdminWrapper, useSuperAdminWrapper } from '@/features/admin/components/super-admin-wrapper'

function App() {
  const adminState = useSuperAdminWrapper()
  
  return (
    <div>
      <SuperAdminWrapper {...adminState} />
      <MainApp />
    </div>
  )
}
```

### Admin Layout Violations
```typescript
// ❌ NEVER use regular layouts for admin pages
function AdminPage() {
  return (
    <RegularLayout> {/* Wrong layout for admin functionality */}
      <AdminContent />
    </RegularLayout>
  )
}

// ✅ ALWAYS use SuperAdminLayout for admin pages
import { SuperAdminLayout } from '@/features/admin/components/super-admin-layout'

function AdminPage() {
  return (
    <SuperAdminLayout>
      <AdminContent />
    </SuperAdminLayout>
  )
}
```

## ✅ Established Patterns

### 1. **Super Admin Wrapper Component**
```typescript
// File: src/features/admin/components/super-admin-wrapper.tsx
import { useCallback, useMemo, memo } from 'react'
import { ShieldUser, X } from 'lucide-react'

import { authClient } from '@/lib/auth/auth-client'
import { useSession } from '@/lib/auth/auth-hooks'
import { useTranslation } from '@/i18n/hooks/useTranslation'

interface SuperAdminWrapperProps {
  isSuperAdmin: boolean
  user?: User | undefined
  isImpersonating?: boolean
  impersonatedUser?: User | undefined
  onExitImpersonation?: () => void
  onOpenSettings?: () => void
}

export const SuperAdminWrapper = memo(function SuperAdminWrapper({
  isImpersonating = false,
  impersonatedUser,
  onExitImpersonation,
  onOpenSettings,
}: SuperAdminWrapperProps) {
  const { t } = useTranslation('admin')

  // Show frame when superadmin is impersonating a user
  const shouldShowFrame = isImpersonating

  if (!shouldShowFrame) {
    return null
  }

  const displayName =
    `${impersonatedUser?.firstName || ''} ${impersonatedUser?.lastName || ''}`.trim() ||
    impersonatedUser?.email

  const handleExitClick = () => {
    if (onExitImpersonation) {
      onExitImpersonation()
    }
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none outline outline-purple-700 outline-5 -outline-offset-5">
      {/* Corner masks for rounded appearance */}
      <CornerMask corner="top-left" />
      <CornerMask corner="top-right" />
      <CornerMask corner="bottom-left" />
      <CornerMask corner="bottom-right" />

      {/* Admin controls strip */}
      <div
        className="bg-purple-700 text-white px-5 py-2 flex items-center justify-between pointer-events-auto"
        style={{ height: '40px' }}
      >
        {/* Left side - Impersonation indicator */}
        <div className="flex items-center gap-2 text-sm">
          <ShieldUser className="size-6" />
          <div className="flex items-center gap-2 bg-purple-950 py-1 px-2.5 rounded-md text-purple-50">
            <span className="font-medium">{t('impersonation.impersonating', { displayName })}</span>
          </div>
        </div>

        {/* Right side - Admin controls */}
        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center justify-center w-8 h-8 bg-purple-600 hover:bg-purple-500 rounded-md transition-colors"
            >
              ⚙️
            </button>
          )}
          <button
            onClick={handleExitClick}
            title={t('users.exitImpersonation')}
            className="flex items-center justify-center w-8 h-8 bg-purple-600 hover:bg-purple-500 rounded-md transition-colors text-white"
          >
            <X />
          </button>
        </div>
      </div>
    </div>
  )
})

// Hook for managing super admin state
export function useSuperAdminWrapper() {
  const { data: session } = useSession()

  const handleExitImpersonation = useCallback(async () => {
    try {
      await authClient.admin.stopImpersonating()
      window.location.href = '/superadmin/users'
    } catch (error) {
      console.error('Failed to stop impersonation:', error)
    }
  }, [])

  const isSuperAdmin = session?.user?.role === 'superadmin'
  const isImpersonating = !!session?.session?.impersonatedBy

  return useMemo(
    () => ({
      isSuperAdmin,
      isImpersonating,
      impersonatedUser: isImpersonating ? session?.user : undefined,
      user: session?.user,
      onExitImpersonation: handleExitImpersonation,
      shouldShowSuperAdminFrame: isImpersonating,
      superAdminBarHeight: 40,
    }),
    [
      isSuperAdmin,
      isImpersonating,
      session?.user,
      handleExitImpersonation,
    ]
  )
}
```

### 2. **Super Admin Layout**
```typescript
// File: src/features/admin/components/super-admin-layout.tsx
import { useRouterState } from '@tanstack/react-router'

import { SuperAdminSidebar } from './super-admin-sidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { useSession } from '@/lib/auth/auth-hooks'
import { PageHeader } from '@/components/page-header'
import { useTranslation } from '@/i18n/hooks/useTranslation'

interface SuperAdminLayoutProps {
  children: React.ReactNode
}

const getPageNames = (t: (key: string) => string): Record<string, string> => ({
  '/superadmin': t('pages.dashboard'),
  '/superadmin/users': t('pages.userManagement'),
  '/superadmin/workspaces': t('pages.workspaceManagement'),
  '/superadmin/analytics': t('pages.analytics'),
  '/superadmin/settings': t('pages.systemSettings'),
})

export function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const { data: session } = useSession()
  const { t } = useTranslation('admin')

  // Check superadmin access
  const isSuperAdmin = session?.user?.role === 'superadmin'

  // Get current path for page title
  const currentPath = useRouterState({
    select: state => state.location.pathname,
  })

  // Security check
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
          <p className="text-muted-foreground mt-2">You don't have permission to access this area.</p>
        </div>
      </div>
    )
  }

  const pageNames = getPageNames(t)
  const currentPageName = pageNames[currentPath] || t('pages.unknown')

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-purple-50/30">
        <SuperAdminSidebar />
        <SidebarInset className="flex-1 flex flex-col">
          <PageHeader
            title={currentPageName}
            description={t('layout.description')}
            className="border-b bg-background/60 backdrop-blur"
          />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
```

### 3. **Admin User Management Server Functions**
```typescript
// File: src/features/admin/lib/admin-users.server.ts
import { createServerFn } from '@tanstack/react-start'
import { ilike, desc, asc, count, or, eq, and, SQL } from 'drizzle-orm'
import { PgColumn } from 'drizzle-orm/pg-core'
import { z } from 'zod'

import { authMiddleware } from '@/lib/auth/auth-middleware'
import { db } from '@/lib/db/db'
import { user } from '@/database/schema'
import { buildColumnFilter, parseFilterValue, preprocessFilterValue } from '@/lib/utils/table-filters'

export type AdminUser = {
  id: string
  name: string | null
  email: string
  role: 'user' | 'admin' | 'superadmin'
  banned: boolean
  createdAt: string
  emailVerified: boolean
}

const queryParamsSchema = z.object({
  search: z.string().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  sorting: z.array(z.object({
    id: z.string(),
    desc: z.boolean()
  })).optional(),
  pagination: z.object({
    pageIndex: z.number(),
    pageSize: z.number()
  }).optional()
})

export const getAdminUsersTable = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: unknown) => queryParamsSchema.parse(data))
  .handler(async ({ data, context }) => {
    // REQUIRED: Verify superadmin role
    if (context.user.role !== 'superadmin') {
      throw new AppError('FORBIDDEN', 403, undefined, 'Admin access required')
    }

    const pageIndex = data.pagination?.pageIndex ?? 0
    const pageSize = data.pagination?.pageSize ?? 10
    const offset = pageIndex * pageSize
    const searchTerm = data.search || ''

    try {
      // Build search conditions
      const conditions: SQL[] = []
      if (searchTerm) {
        const searchCondition = or(
          ilike(user.email, `%${searchTerm}%`),
          ilike(user.name, `%${searchTerm}%`),
          ilike(user.id, `%${searchTerm}%`)
        )
        if (searchCondition) {
          conditions.push(searchCondition)
        }
      }

      // Apply column filters
      if (data.filters) {
        Object.entries(data.filters).forEach(([columnId, value]) => {
          if (value === undefined || value === null) return

          const { operator, value: filterValue } = parseFilterValue(value)

          let column: PgColumn | undefined
          switch (columnId) {
            case 'role':
              column = user.role
              break
            case 'status':
              column = user.banned
              break
            case 'createdAt':
              column = user.createdAt
              break
            default:
              return
          }

          if (column) {
            const processedValue = preprocessFilterValue(columnId, filterValue)
            const filter = buildColumnFilter({
              column,
              operator,
              value: processedValue,
            })
            if (filter) {
              conditions.push(filter)
            }
          }
        })
      }

      // Build sorting
      let orderBy
      if (data.sorting && data.sorting.length > 0) {
        const sort = data.sorting[0]
        const sortFn = sort.desc ? desc : asc

        switch (sort.id) {
          case 'name':
            orderBy = sortFn(user.name)
            break
          case 'email':
            orderBy = sortFn(user.email)
            break
          case 'role':
            orderBy = sortFn(user.role)
            break
          case 'createdAt':
            orderBy = sortFn(user.createdAt)
            break
          default:
            orderBy = desc(user.createdAt)
        }
      } else {
        orderBy = desc(user.createdAt)
      }

      // Execute parallel queries
      const baseQuery = db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          banned: user.banned,
          createdAt: user.createdAt,
          emailVerified: user.emailVerified,
        })
        .from(user)

      const query = conditions.length > 0 
        ? baseQuery.where(and(...conditions)).orderBy(orderBy)
        : baseQuery.orderBy(orderBy)

      const totalCountQuery = conditions.length > 0
        ? db.select({ count: count(user.id) }).from(user).where(and(...conditions))
        : db.select({ count: count(user.id) }).from(user)

      const [usersResult, totalCountResult] = await Promise.all([
        query.limit(pageSize).offset(offset),
        totalCountQuery,
      ])

      // Transform to admin user format
      const transformedUsers: AdminUser[] = usersResult.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: (user.role as 'user' | 'admin' | 'superadmin') || 'user',
        banned: !!user.banned,
        createdAt: user.createdAt.toISOString(),
        emailVerified: !!user.emailVerified,
      }))

      const totalCount = Number(totalCountResult[0]?.count || 0)
      const pageCount = Math.ceil(totalCount / pageSize)

      return {
        data: transformedUsers,
        totalCount,
        pageCount,
      }
    } catch (error) {
      console.error('Error loading admin users:', error)
      return {
        data: [],
        totalCount: 0,
        pageCount: 0,
      }
    }
  })

// Admin user statistics
export const getAdminUserStats = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // REQUIRED: Verify superadmin role
    if (context.user.role !== 'superadmin') {
      throw new AppError('FORBIDDEN', 403, undefined, 'Admin access required')
    }

    try {
      const [totalUsersResult, activeUsersResult, bannedUsersResult] = await Promise.all([
        db.select({ count: count(user.id) }).from(user),
        db.select({ count: count(user.id) }).from(user).where(eq(user.banned, false)),
        db.select({ count: count(user.id) }).from(user).where(eq(user.banned, true)),
      ])

      return {
        totalUsers: Number(totalUsersResult[0]?.count || 0),
        activeUsers: Number(activeUsersResult[0]?.count || 0),
        bannedUsers: Number(bannedUsersResult[0]?.count || 0),
      }
    } catch (error) {
      console.error('Error loading user stats:', error)
      return {
        totalUsers: 0,
        activeUsers: 0,
        bannedUsers: 0,
      }
    }
  })
```

### 4. **Admin Workspace Management**
```typescript
// File: src/features/admin/lib/admin-workspaces.server.ts
import { createServerFn } from '@tanstack/react-start'
import { ilike, desc, asc, count, or, eq, and } from 'drizzle-orm'
import { z } from 'zod'

import { authMiddleware } from '@/lib/auth/auth-middleware'
import { db } from '@/lib/db/db'
import { organization, member } from '@/database/schema'

export type AdminWorkspace = {
  id: string
  name: string
  slug: string | null
  createdAt: string
  memberCount?: number
}

export const getAdminWorkspacesTable = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(queryParamsSchema.parse)
  .handler(async ({ data, context }) => {
    // REQUIRED: Admin permission check
    if (context.user.role !== 'superadmin') {
      throw new AppError('FORBIDDEN', 403, undefined, 'Admin access required')
    }

    const pageIndex = data.pagination?.pageIndex ?? 0
    const pageSize = data.pagination?.pageSize ?? 10
    const offset = pageIndex * pageSize
    const searchTerm = data.search || ''

    try {
      // Build conditions
      const conditions: SQL[] = []
      if (searchTerm) {
        const searchCondition = or(
          ilike(organization.name, `%${searchTerm}%`),
          ilike(organization.slug, `%${searchTerm}%`),
          ilike(organization.id, `%${searchTerm}%`)
        )
        if (searchCondition) {
          conditions.push(searchCondition)
        }
      }

      // Execute queries with member count
      const baseQuery = db
        .select({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          createdAt: organization.createdAt,
          memberCount: count(member.id),
        })
        .from(organization)
        .leftJoin(member, eq(organization.id, member.organizationId))
        .groupBy(organization.id)

      const query = conditions.length > 0 
        ? baseQuery.having(and(...conditions))
        : baseQuery

      const [workspacesResult, totalCountResult] = await Promise.all([
        query.orderBy(desc(organization.createdAt)).limit(pageSize).offset(offset),
        db.select({ count: count(organization.id) }).from(organization),
      ])

      const transformedWorkspaces: AdminWorkspace[] = workspacesResult.map(workspace => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        createdAt: workspace.createdAt.toISOString(),
        memberCount: Number(workspace.memberCount || 0),
      }))

      const totalCount = Number(totalCountResult[0]?.count || 0)
      const pageCount = Math.ceil(totalCount / pageSize)

      return {
        data: transformedWorkspaces,
        totalCount,
        pageCount,
      }
    } catch (error) {
      console.error('Error loading admin workspaces:', error)
      return {
        data: [],
        totalCount: 0,
        pageCount: 0,
      }
    }
  })
```

### 5. **Impersonation Functions**
```typescript
// Admin impersonation server functions
export const startUserImpersonation = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ userId: z.string() }).parse)
  .handler(async ({ data, context }) => {
    // REQUIRED: Verify superadmin role
    if (context.user.role !== 'superadmin') {
      throw new AppError('FORBIDDEN', 403, undefined, 'Admin access required')
    }

    const { userId } = data

    // Verify target user exists
    const targetUser = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)

    if (!targetUser[0]) {
      throw AppError.notFound('User')
    }

    // Don't allow impersonating other superadmins
    if (targetUser[0].role === 'superadmin') {
      throw new AppError(
        'FORBIDDEN',
        403,
        undefined,
        'Cannot impersonate other super administrators'
      )
    }

    // Start impersonation using Better Auth
    try {
      await authClient.admin.impersonateUser({
        userId,
      })

      // Audit log the impersonation
      console.log('ADMIN_AUDIT', {
        action: 'START_IMPERSONATION',
        adminId: context.user.id,
        targetUserId: userId,
        timestamp: new Date().toISOString(),
      })

      return { success: true }
    } catch (error) {
      throw new AppError(
        'SYS_SERVER_ERROR',
        500,
        undefined,
        'Failed to start impersonation'
      )
    }
  })

export const stopUserImpersonation = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // Must be in impersonation mode
    if (!context.session.impersonatedBy) {
      throw new AppError('BIZ_INVALID_STATE', 400, undefined, 'Not currently impersonating')
    }

    try {
      await authClient.admin.stopImpersonating()

      // Audit log
      console.log('ADMIN_AUDIT', {
        action: 'STOP_IMPERSONATION',
        adminId: context.session.impersonatedBy,
        targetUserId: context.user.id,
        timestamp: new Date().toISOString(),
      })

      return { success: true }
    } catch (error) {
      throw new AppError(
        'SYS_SERVER_ERROR',
        500,
        undefined,
        'Failed to stop impersonation'
      )
    }
  })
```

## 🔧 Step-by-Step Implementation

### 1. **Admin Route Setup**
```typescript
// File: src/routes/_authenticated/superadmin.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Outlet } from '@tanstack/react-router'

import { SuperAdminLayout } from '@/features/admin/components/super-admin-layout'
import { useSession } from '@/lib/auth/auth-hooks'

export const Route = createFileRoute('/_authenticated/superadmin')({
  beforeLoad: async ({ context }) => {
    // Check admin access at route level
    if (context.user?.role !== 'superadmin') {
      throw redirect({
        to: '/',
        search: {
          redirect: '/superadmin'
        }
      })
    }
  },
  component: SuperAdminRouteComponent,
})

function SuperAdminRouteComponent() {
  return (
    <SuperAdminLayout>
      <Outlet />
    </SuperAdminLayout>
  )
}
```

### 2. **Admin User Management Page**
```typescript
// File: src/routes/_authenticated/superadmin/users.tsx
import { createFileRoute } from '@tanstack/react-router'
import { ColumnDef } from '@tanstack/react-table'

import { DataTable } from '@/ui/data-table'
import { useTableQuery } from '@/ui/hooks/use-table-query'
import { getAdminUsersTable, AdminUser } from '@/features/admin/lib/admin-users.server'
import { Button } from '@/ui/button'
import { Badge } from '@/ui/badge'

export const Route = createFileRoute('/_authenticated/superadmin/users')({
  component: AdminUsersPage,
})

function AdminUsersPage() {
  const {
    data,
    totalCount,
    isLoading,
    tableState,
    onStateChange,
  } = useTableQuery<AdminUser>({
    queryKey: ['admin-users'],
    queryFn: getAdminUsersTable,
    defaultPageSize: 25,
  })

  const columns: ColumnDef<AdminUser>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      meta: {
        filterConfig: {
          type: 'text',
          placeholder: 'Search names...',
        },
      },
    },
    {
      accessorKey: 'email',
      header: 'Email',
      meta: {
        filterConfig: {
          type: 'text',
          placeholder: 'Search emails...',
        },
      },
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => (
        <Badge variant={
          row.original.role === 'superadmin' ? 'destructive' :
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
            { label: 'Super Admin', value: 'superadmin' },
            { label: 'Admin', value: 'admin' },
            { label: 'User', value: 'user' },
          ],
        },
      },
    },
    {
      accessorKey: 'banned',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.banned ? 'destructive' : 'default'}>
          {row.original.banned ? 'Banned' : 'Active'}
        </Badge>
      ),
      meta: {
        filterConfig: {
          type: 'select',
          options: [
            { label: 'All', value: '' },
            { label: 'Active', value: 'false' },
            { label: 'Banned', value: 'true' },
          ],
        },
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => startImpersonation(row.original.id)}
            disabled={row.original.role === 'superadmin'}
          >
            Impersonate
          </Button>
          <Button
            size="sm"
            variant={row.original.banned ? 'default' : 'destructive'}
            onClick={() => toggleUserBan(row.original.id)}
          >
            {row.original.banned ? 'Unban' : 'Ban'}
          </Button>
        </div>
      ),
    },
  ]

  const startImpersonation = async (userId: string) => {
    try {
      await authClient.admin.impersonateUser({ userId })
      window.location.href = '/' // Redirect to main app as impersonated user
    } catch (error) {
      console.error('Failed to start impersonation:', error)
    }
  }

  const toggleUserBan = async (userId: string) => {
    // Implementation for user ban/unban
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-muted-foreground">Manage users across all organizations</p>
      </div>

      <DataTable
        columns={columns}
        data={data}
        totalCount={totalCount}
        isLoading={isLoading}
        config={{
          enableColumnFilters: true,
          enableRowSelection: false,
          manualFiltering: true,
          manualPagination: true,
          manualSorting: true,
          searchConfig: {
            placeholder: 'Search users by name, email, or ID...',
          },
          paginationConfig: {
            pageSizeOptions: [10, 25, 50, 100],
            defaultPageSize: 25,
          },
        }}
        onStateChange={onStateChange}
      />
    </div>
  )
}
```

## 🎯 Integration Requirements

### With Authentication System
```typescript
// Admin functions must integrate with Better Auth admin plugin
import { authClient } from '@/lib/auth/auth-client'

// Impersonation actions
await authClient.admin.impersonateUser({ userId })
await authClient.admin.stopImpersonating()

// Admin user management
await authClient.admin.listUsers()
await authClient.admin.updateUser({ userId, data })
```

### With Better Auth Configuration
```typescript
// File: src/lib/auth/auth.ts (admin plugin section)
import { admin } from 'better-auth/plugins'

export const auth = betterAuth({
  plugins: [
    admin({
      adminRoles: ['superadmin'],
      adminUserIds: ['specific-superadmin-user-id'], // Hardcoded fallback
    }),
    // ... other plugins
  ],
})
```

### With Route Protection
```typescript
// Protected admin routes
export const Route = createFileRoute('/_authenticated/superadmin')({
  beforeLoad: async ({ context }) => {
    // Route-level admin check
    if (context.user?.role !== 'superadmin') {
      throw redirect({
        to: '/',
        search: { error: 'admin_access_required' }
      })
    }
  },
  component: SuperAdminLayout,
})
```

## 🧪 Testing Requirements

### Admin Permission Testing
```typescript
// Test admin access control
describe('Admin Functions', () => {
  it('should require superadmin role', async () => {
    const regularUserContext = {
      user: { id: 'user1', role: 'user' }
    }

    await expect(
      getAdminUsersTable.handler({
        data: {},
        context: regularUserContext
      })
    ).rejects.toThrow('Admin access required')
  })

  it('should allow superadmin access', async () => {
    const adminContext = {
      user: { id: 'admin1', role: 'superadmin' }
    }

    const result = await getAdminUsersTable.handler({
      data: { pagination: { pageIndex: 0, pageSize: 10 } },
      context: adminContext
    })

    expect(result.data).toBeDefined()
  })
})
```

### Impersonation Testing
```typescript
// Test impersonation functionality
describe('User Impersonation', () => {
  it('should prevent impersonating other superadmins', async () => {
    const targetUser = { id: 'user2', role: 'superadmin' }
    vi.mocked(db.select).mockResolvedValue([targetUser])

    await expect(
      startUserImpersonation.handler({
        data: { userId: 'user2' },
        context: { user: { role: 'superadmin' } }
      })
    ).rejects.toThrow('Cannot impersonate other super administrators')
  })
})
```

## 📋 Implementation Checklist

Before considering super admin system complete, verify:

- [ ] **Role Verification**: All admin functions verify superadmin role
- [ ] **Visual Indicators**: Impersonation clearly visible to users
- [ ] **Exit Mechanisms**: Easy exit from impersonation mode
- [ ] **Admin Layout**: Dedicated layout for admin functionality
- [ ] **User Management**: Complete user administration features
- [ ] **Workspace Management**: Organization oversight and management
- [ ] **Audit Logging**: All admin actions properly logged
- [ ] **Security**: No admin privilege escalation possible
- [ ] **Better Auth Integration**: Proper use of admin plugin features
- [ ] **Route Protection**: Admin routes properly protected

## 🚀 Advanced Patterns

### Admin Dashboard with Analytics
```typescript
// Admin dashboard with system metrics
function AdminDashboard() {
  const { data: userStats } = useQuery({
    queryKey: ['admin-user-stats'],
    queryFn: getAdminUserStats,
  })

  const { data: systemMetrics } = useQuery({
    queryKey: ['admin-system-metrics'],
    queryFn: getSystemMetrics,
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard
        title="Total Users"
        value={userStats?.totalUsers || 0}
        trend={+12}
      />
      <MetricCard
        title="Active Users"
        value={userStats?.activeUsers || 0}
        trend={+5}
      />
      <MetricCard
        title="Organizations"
        value={systemMetrics?.totalOrganizations || 0}
        trend={+3}
      />
      <MetricCard
        title="Storage Used"
        value={formatBytes(systemMetrics?.storageUsed || 0)}
        trend={+15}
      />
    </div>
  )
}
```

### Bulk Admin Operations
```typescript
// Bulk operations for admin management
export const bulkUpdateUsers = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({
    userIds: z.array(z.string()),
    action: z.enum(['ban', 'unban', 'delete', 'changeRole']),
    params: z.record(z.unknown()).optional(),
  }).parse)
  .handler(async ({ data, context }) => {
    if (context.user.role !== 'superadmin') {
      throw new AppError('FORBIDDEN', 403, undefined, 'Admin access required')
    }

    const { userIds, action, params } = data

    return await db.transaction(async (tx) => {
      const results = []

      for (const userId of userIds) {
        switch (action) {
          case 'ban':
            const banResult = await tx
              .update(user)
              .set({ banned: true, banReason: params?.reason as string })
              .where(eq(user.id, userId))
              .returning()
            results.push(banResult[0])
            break

          case 'unban':
            const unbanResult = await tx
              .update(user)
              .set({ banned: false, banReason: null })
              .where(eq(user.id, userId))
              .returning()
            results.push(unbanResult[0])
            break

          default:
            throw new AppError('VAL_INVALID_FORMAT', 400, undefined, 'Invalid action')
        }

        // Audit log each action
        console.log('ADMIN_AUDIT', {
          action: action.toUpperCase(),
          adminId: context.user.id,
          targetUserId: userId,
          params,
          timestamp: new Date().toISOString(),
        })
      }

      return results
    })
  })
```

This super admin system provides comprehensive administrative capabilities with proper security, audit logging, and user-friendly impersonation features for managing large-scale SaaS applications.