# Multi-Tenancy Implementation Guide

This document provides comprehensive guidance for implementing organization-based multi-tenancy with secure data isolation, context switching, and proper middleware patterns using Better Auth's organization system.

## 🚨 Critical Rules

- **ALWAYS scope data by organizationId** - Every user data table MUST include organizationId
- **MUST validate organization membership** - Users can only access organizations they belong to
- **NEVER bypass organization middleware** - All protected operations must use organizationMiddleware
- **ALWAYS use tab-specific storage** - Use sessionStorage for organization context to support multiple tabs
- **MUST maintain middleware order** - auth → organization → handler sequence is mandatory

## ❌ Common AI Agent Mistakes

### Data Isolation Violations
```typescript
// ❌ NEVER create queries without organization scoping
export const getTodoById = async (id: string) => {
  return await db.select().from(todos).where(eq(todos.id, id)) // Security vulnerability - shows todo from any org!
}

// ❌ NEVER bypass organization validation
export const updateTodo = createServerFn({ method: 'POST' })
  .middleware([authMiddleware]) // Missing organizationMiddleware!
  .handler(async ({ data, context }) => {
    // User can update todos from any organization!
    await db.update(todos).set(data).where(eq(todos.id, data.id))
  })
```

### Middleware Chain Violations
```typescript
// ❌ NEVER use wrong middleware order
export const serverAction = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware, authMiddleware]) // Wrong order!
  .handler(async ({ context }) => {
    // organizationMiddleware needs authenticated user from authMiddleware
  })

// ❌ NEVER skip organization validation
export const createItem = createServerFn({ method: 'POST' })
  .middleware([authMiddleware]) // Missing organizationMiddleware
  .handler(async ({ context }) => {
    // No organization context - security vulnerability!
  })
```

### Client-Side Context Violations
```typescript
// ❌ NEVER use localStorage for tab-specific organization state
localStorage.setItem('activeOrganizationId', orgId) // Wrong - affects all tabs

// ❌ NEVER create organization context without proper validation
const setActiveOrganization = (orgId: string) => {
  setActiveOrgId(orgId) // Missing membership validation!
}
```

## ✅ Established Patterns

### 1. **Organization Middleware - Server-Side Validation**
```typescript
// File: src/features/organization/lib/organization-middleware.ts
import { createMiddleware } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { authMiddleware } from '@/lib/auth/auth-middleware'
import { db } from '@/lib/db/db'
import { member } from '@/database/schema'

export const organizationMiddleware = createMiddleware({ type: 'function' })
  .middleware([authMiddleware]) // MUST chain with auth middleware
  .client(async ({ next }) => {
    // Read organizationId from sessionStorage (tab-specific)
    const organizationId =
      typeof window !== 'undefined' ? sessionStorage.getItem('activeOrganizationId') : null

    return next({
      sendContext: {
        organizationId,
      },
    })
  })
  .server(async ({ next, context }) => {
    const request = getWebRequest()
    let validatedOrgId: string | null = null

    if (context.organizationId && context.user) {
      try {
        // Validate it's a string
        const orgId = z.string().parse(context.organizationId)

        // CRITICAL: Verify user has access to this organization
        const membership = await db
          .select()
          .from(member)
          .where(and(eq(member.userId, context.user.id), eq(member.organizationId, orgId)))
          .limit(1)

        if (membership.length > 0) {
          validatedOrgId = orgId
        }
        // User is not a member - validatedOrgId stays null
      } catch {
        // Error validating organization - validatedOrgId stays null
      }
    }

    return next({
      context: {
        ...context, // Preserve existing context from auth middleware
        organizationId: validatedOrgId,
        headers: request.headers,
      },
    })
  })
```

### 2. **Organization Context - Client-Side Management**
```typescript
// File: src/features/organization/lib/organization-context.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

import { getActiveOrganizationId, setActiveOrganizationId as setOrgId } from './organization-utils'
import { useListOrganizations } from '@/lib/auth/auth-hooks'

interface OrganizationContextValue {
  activeOrganizationId: string | null
  activeOrganization: any | null
  setActiveOrganization: (orgId: string) => void
  isLoading: boolean
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined)

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { data: organizations, isPending } = useListOrganizations()
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null)

  // Initialize active organization from storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const orgId = getActiveOrganizationId()
      if (orgId) {
        setActiveOrganizationId(orgId)
      }
    }
  }, [organizations])

  // Listen for storage changes (cross-tab sync)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'activeOrganizationId' && e.newValue) {
        sessionStorage.setItem('activeOrganizationId', e.newValue)
        setActiveOrganizationId(e.newValue)
      }
    }

    const handleOrgChange = (e: CustomEvent) => {
      setActiveOrganizationId(e.detail)
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('org-changed' as any, handleOrgChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('org-changed' as any, handleOrgChange)
    }
  }, [])

  const setActiveOrganization = (orgId: string) => {
    setOrgId(orgId) // Updates both sessionStorage and localStorage
    setActiveOrganizationId(orgId)
  }

  const activeOrganization = organizations?.find(org => org.id === activeOrganizationId) || null

  return (
    <OrganizationContext.Provider
      value={{
        activeOrganizationId,
        activeOrganization,
        setActiveOrganization,
        isLoading: isPending,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useActiveOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useActiveOrganization must be used within an OrganizationProvider')
  }
  return context
}
```

### 3. **Organization Storage Utilities**
```typescript
// File: src/features/organization/lib/organization-utils.ts

/**
 * Sets the active organization ID in both sessionStorage (per-tab) and localStorage (cross-tab fallback)
 * Also dispatches a custom event to notify components in the same tab
 * 
 * NOTE: This implementation supports per-tab organization independence:
 * - sessionStorage: Tab-specific active organization (allows different orgs per tab)
 * - localStorage: Fallback for new tabs (inheritance from most recent selection)
 * - NO cross-tab syncing: Each tab can have different organization independently
 */
export function setActiveOrganizationId(organizationId: string): void {
  if (typeof window === 'undefined') return

  // Update both storages - sessionStorage for tab isolation, localStorage for fallback
  sessionStorage.setItem('activeOrganizationId', organizationId)
  localStorage.setItem('activeOrganizationId', organizationId)

  // Notify other components in same tab (does NOT affect other tabs)
  window.dispatchEvent(new CustomEvent('org-changed', { detail: organizationId }))
}

/**
 * Gets the active organization ID from storage
 * Priority: sessionStorage (tab-specific) → localStorage (fallback)
 */
export function getActiveOrganizationId(): string | null {
  if (typeof window === 'undefined') return null

  // Priority: sessionStorage (tab-specific) → localStorage (fallback)
  const sessionOrgId = sessionStorage.getItem('activeOrganizationId')
  const localOrgId = localStorage.getItem('activeOrganizationId')

  return sessionOrgId || localOrgId
}

/**
 * Clears the active organization from storage
 * Useful when user logs out or needs to reset organization selection
 */
export function clearActiveOrganizationId(): void {
  if (typeof window === 'undefined') return

  sessionStorage.removeItem('activeOrganizationId')
  localStorage.removeItem('activeOrganizationId')

  window.dispatchEvent(new CustomEvent('org-changed', { detail: null }))
}
```

## Organization Middleware vs Explicit Parameters

### Two Patterns for Organization Handling

#### Active Organization Pattern (organizationMiddleware)
Use for operations on the user's current active organization:
- **Middleware**: `organizationMiddleware`
- **Organization source**: Context from storage (sessionStorage → localStorage)
- **Examples**: todos, billing, team viewing
- **Validation**: Automatic membership verification by middleware

```typescript
export const getTodoById = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const organizationId = context.organizationId
    if (!organizationId) {
      throw new AppError('No organization context')
    }
    // organizationMiddleware already verified membership
    // Continue with operation...
  })
```

#### Explicit Organization Pattern (authMiddleware + parameter)
Use for operations specifying which organization to act on:
- **Middleware**: `authMiddleware`
- **Organization source**: `data.organizationId` parameter
- **Examples**: invitations, member management, admin functions
- **Validation**: Manual `checkPermission()` calls

```typescript
export const inviteMember = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({
    organizationId: z.string(),
    email: z.string().email(),
    role: z.enum(['viewer', 'member', 'admin'])
  }).parse(data))
  .handler(async ({ data }) => {
    // checkPermission verifies both permissions AND membership
    await checkPermission('invitation', ['create'], data.organizationId)
    // Continue with operation...
  })
```

### Per-Tab Organization Support
- **sessionStorage**: Each tab has independent active organization
- **localStorage**: New tabs inherit from most recently selected
- **No cross-tab syncing**: Changing org in one tab doesn't affect others

### 4. **Organization-Scoped Server Functions**
```typescript
// File: src/features/todos/lib/todos.server.ts
import { createServerFn } from '@tanstack/react-start'
import { eq, and, desc } from 'drizzle-orm'
import { z } from 'zod'

import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { checkPermission } from '@/lib/utils/permissions'
import { db } from '@/lib/db/db'
import { todos } from '@/database/schema'

const createTodoSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
})

// Get single todo for current organization ONLY
export const getTodoById = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }: { data: any, context: any }) => {
    const orgId = context.organizationId

    // ALWAYS scope queries by organization
    const todo = await db
      .select()
      .from(todos)
      .where(and(
        eq(todos.id, data.id),
        eq(todos.organizationId, orgId)
      ))
      .limit(1)

    if (!todo[0]) {
      throw AppError.notFound('Todo')
    }

    return todo[0]
  })

// Create todo in current organization context
export const createTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => createTodoSchema.parse(data))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const user = context.user
    const orgId = context.organizationId

    // ALWAYS check permissions
    await checkPermission('todos', ['create'], orgId)

    const newTodo = await db
      .insert(todos)
      .values({
        title: data.title,
        description: data.description,
        organizationId: orgId, // REQUIRED: Organization scoping
        createdBy: user.id,
        completed: false,
      })
      .returning()

    return newTodo[0]
  })

// Update todo with organization validation
export const updateTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const orgId = context.organizationId

    // CRITICAL: Validate todo belongs to organization
    const existingTodo = await db
      .select()
      .from(todos)
      .where(and(eq(todos.id, data.id), eq(todos.organizationId, orgId)))
      .limit(1)

    if (!existingTodo[0]) {
      throw new Error('Todo not found or access denied')
    }

    await checkPermission('todos', ['update'], orgId)

    const updated = await db
      .update(todos)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(todos.id, data.id), eq(todos.organizationId, orgId))) // Double-check org scoping
      .returning()

    return updated[0]
  })
```

### 5. **Organization Switcher Component**
```typescript
// File: src/features/organization/components/organization-switcher.tsx
import { useState, memo, useCallback } from 'react'
import { Check, ChevronsUpDown, Plus, Loader2, Building2 } from 'lucide-react'

import { Button } from '@/components/taali-ui/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/taali-ui/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/taali-ui/ui/popover'
import { authClient } from '@/lib/auth/auth-client'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { useListOrganizations } from '@/lib/auth/auth-hooks'

const OrganizationSwitcher = memo(function OrganizationSwitcher() {
  const [open, setOpen] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)

  const { data: organizations, isPending: isLoading } = useListOrganizations()
  const { activeOrganization, setActiveOrganization } = useActiveOrganization()

  const handleWorkspaceSelect = useCallback(
    async (organizationId: string) => {
      if (organizationId === activeOrganization?.id) {
        setOpen(false)
        return
      }

      try {
        setIsSwitching(true)
        await setActiveOrganization(organizationId)
        setOpen(false)
      } catch (error) {
        console.error('Failed to switch workspace:', error)
      } finally {
        setIsSwitching(false)
      }
    },
    [activeOrganization?.id, setActiveOrganization]
  )

  if (isLoading) {
    return <div>Loading organizations...</div>
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between ${isSwitching ? 'opacity-50' : ''}`}
          disabled={isSwitching}
        >
          {activeOrganization ? (
            <span className="text-sm font-medium truncate">
              {activeOrganization.name}
            </span>
          ) : (
            <span>Select workspace</span>
          )}
          {isSwitching ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search workspaces..." />
          <CommandEmpty>No workspaces found.</CommandEmpty>
          {organizations && organizations.length > 0 && (
            <CommandGroup>
              {organizations.map(organization => (
                <CommandItem
                  key={organization.id}
                  value={organization.name}
                  onSelect={() => handleWorkspaceSelect(organization.id)}
                  className="flex items-center justify-between"
                >
                  <span className="truncate">{organization.name}</span>
                  {activeOrganization?.id === organization.id && (
                    <Check />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
})

export { OrganizationSwitcher }
```

## 🔧 Step-by-Step Implementation

### 1. Database Schema Setup
```sql
-- ALWAYS include organizationId in user data tables
CREATE TABLE todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  assigned_to TEXT REFERENCES user(id) ON DELETE SET NULL,
  completed BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create index for organization queries
CREATE INDEX idx_todos_organization_id ON todos(organization_id);
CREATE INDEX idx_todos_organization_created_at ON todos(organization_id, created_at);
```

### 2. Server Function Implementation Pattern
```typescript
// Template for organization-scoped server functions
export const organizationScopedAction = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware]) // REQUIRED
  .validator(validationSchema.parse)
  .handler(async ({ data, context }) => {
    const { user, organizationId } = context

    // 1. Check permissions
    await checkPermission('resource', ['action'], organizationId)

    // 2. Validate data belongs to organization (for updates/deletes)
    if (data.id) {
      const existing = await db
        .select()
        .from(table)
        .where(and(eq(table.id, data.id), eq(table.organizationId, organizationId)))
        .limit(1)

      if (!existing[0]) {
        throw new Error('Resource not found or access denied')
      }
    }

    // 3. Perform operation with organization scoping
    return await db
      .insert(table)
      .values({
        ...data,
        organizationId, // REQUIRED
        createdBy: user.id, // REQUIRED for audit
      })
      .returning()
  })
```

### 3. Client-Side Integration
```typescript
// File: src/routes/__root.tsx - Provider setup
import { OrganizationProvider } from '@/features/organization/lib/organization-context'

export const Route = createRootRoute({
  component: () => (
    <OrganizationProvider>
      <App />
    </OrganizationProvider>
  ),
})

// File: Any component needing organization context
import { useActiveOrganization } from '@/features/organization/lib/organization-context'

function MyComponent() {
  const { activeOrganization, activeOrganizationId } = useActiveOrganization()

  if (!activeOrganizationId) {
    return <div>Please select an organization</div>
  }

  // Component implementation with organization context
  return <div>Current org: {activeOrganization?.name}</div>
}
```

## 🎯 Integration Requirements

### With Authentication System
```typescript
// Organization middleware MUST come after auth middleware
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'

// CORRECT chain order
export const protectedAction = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware]) // Includes authMiddleware internally
  .handler(async ({ context }) => {
    // context.user - from auth middleware
    // context.organizationId - validated organization access
  })
```

### With Database Queries
```typescript
// ALWAYS include organization scoping in queries
import { eq, and } from 'drizzle-orm'

// Correct: Organization-scoped query
const userTodos = await db
  .select()
  .from(todos)
  .where(and(
    eq(todos.organizationId, organizationId),
    eq(todos.createdBy, userId)
  ))

// For joins, maintain organization scoping
const todosWithMembers = await db
  .select()
  .from(todos)
  .leftJoin(member, and(
    eq(todos.assignedTo, member.userId),
    eq(member.organizationId, organizationId) // REQUIRED
  ))
  .where(eq(todos.organizationId, organizationId))
```

### With Better Auth Organization System
```typescript
// Better Auth organization integration
import { authClient } from '@/lib/auth/auth-client'

// Create organization
const newOrg = await authClient.organization.create({
  name: 'My Organization',
  slug: 'my-org',
})

// Invite member
await authClient.organization.inviteUser({
  organizationId: orgId,
  email: 'user@example.com',
  role: 'member',
})
```

## 🧪 Testing Requirements

### Multi-Tenancy Testing
```typescript
// Test organization isolation
import { describe, it, expect } from 'vitest'

describe('Organization Isolation', () => {
  it('should only return data for current organization', async () => {
    // Create data in different organizations
    await createTodo({ title: 'Org 1 Todo' }, 'org1', 'user1')
    await createTodo({ title: 'Org 2 Todo' }, 'org2', 'user1')

    // User should only see their org's data
    const org1Todo = await getTodoById(todoId1, 'org1')
    const org2Todo = await getTodoById(todoId2, 'org2')

    expect(org1Todo.organizationId).toBe('org1')
    expect(org2Todo.organizationId).toBe('org2')
    expect(org1Todos[0].organizationId).toBe('org1')
    expect(org2Todos[0].organizationId).toBe('org2')
  })

  it('should prevent cross-organization access', async () => {
    const todo = await createTodo({ title: 'Test' }, 'org1', 'user1')

    // Try to access from different organization
    await expect(
      updateTodo({ id: todo.id, title: 'Updated' }, 'org2', 'user1')
    ).rejects.toThrow('not found or access denied')
  })
})
```

## 📋 Implementation Checklist

Before considering multi-tenancy complete, verify:

- [ ] **Middleware Chain**: organizationMiddleware used in all protected operations
- [ ] **Data Scoping**: All user data tables include organizationId
- [ ] **Query Isolation**: All queries scoped by organization
- [ ] **Membership Validation**: Server-side organization access validation
- [ ] **Client Context**: Organization context provider configured
- [ ] **Storage Strategy**: sessionStorage for tab isolation, localStorage for fallback
- [ ] **Permission System**: Organization-scoped permission checks
- [ ] **Cross-Tab Support**: Storage events handle organization changes
- [ ] **Organization Switcher**: UI component for organization selection
- [ ] **Error Handling**: Proper error messages for access denied scenarios

## 🚀 Advanced Patterns

### Multi-Organization Users
```typescript
// Handle users belonging to multiple organizations
export const getUserOrganizations = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const memberships = await db
      .select({
        organization: organization,
        role: member.role,
        joinedAt: member.createdAt,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(eq(member.userId, context.user.id))

    return memberships
  })
```

### Organization-Specific Configuration
```typescript
// Organization-level settings
export const organizationSettings = pgTable('organization_settings', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  settings: jsonb('settings').$type<{
    features: {
      todos: boolean
      billing: boolean
      analytics: boolean
    }
    limits: {
      maxTodos: number
      maxMembers: number
    }
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

### Bulk Organization Operations
```typescript
// Batch operations across organization data
import { inArray } from 'drizzle-orm'

export const bulkDeleteTodos = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator(z.object({ todoIds: z.array(z.string()) }))
  .handler(async ({ data, context }) => {
    const { todoIds } = data
    const { organizationId } = context

    await checkPermission('todos', ['delete'], organizationId)

    return await db.transaction(async (tx) => {
      // Verify all todos belong to organization
      const validTodos = await tx
        .select({ id: todos.id })
        .from(todos)
        .where(and(
          eq(todos.organizationId, organizationId),
          inArray(todos.id, todoIds)
        ))

      const validIds = validTodos.map(t => t.id)

      // Delete only validated todos
      return await tx
        .delete(todos)
        .where(and(
          eq(todos.organizationId, organizationId),
          inArray(todos.id, validIds)
        ))
        .returning()
    })
  })
```

This multi-tenancy implementation provides enterprise-grade data isolation with seamless user experience across multiple organizations while maintaining security and performance at scale.