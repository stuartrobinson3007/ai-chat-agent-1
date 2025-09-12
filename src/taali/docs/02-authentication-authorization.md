# Authentication & Authorization Implementation Guide

This document provides comprehensive guidance for implementing authentication and authorization using Better Auth with multi-provider support, role-based access control, and organization-scoped permissions.

## 🚨 Critical Rules

- **ALWAYS use Better Auth** - Never implement custom authentication
- **MUST use organization middleware** after auth middleware for protected operations  
- **ALWAYS check permissions** before performing any protected action
- **NEVER bypass the established middleware chain** - auth → organization → handler
- **MUST use the established permission patterns** via `checkPermission` function

## ❌ Common AI Agent Mistakes

### Authentication Bypass
```typescript
// ❌ NEVER skip authentication checks
export const serverAction = createServerFn({ method: 'POST' })
  .handler(async ({ data }) => {
    // Missing auth middleware - security vulnerability!
    await db.insert(todos).values(data)
  })

// ❌ NEVER implement custom auth logic
const validateToken = (token: string) => {
  // Custom JWT validation - wrong approach
}
```

### Permission Check Violations
```typescript
// ❌ NEVER skip permission checks
export const deleteTodo = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, organizationMiddleware])
  .handler(async ({ data, context }) => {
    // Missing permission check!
    await db.delete(todos).where(eq(todos.id, data.id))
  })

// ❌ NEVER use direct role checks instead of permission system
if (user.role === 'admin') { // Wrong - use permission system
  // Allow action
}
```

### Middleware Order Violations
```typescript
// ❌ NEVER use wrong middleware order
export const serverAction = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware, authMiddleware]) // Wrong order!
  .handler(async ({ context }) => {
    // This will fail - organization middleware needs authenticated user
  })
```

## ✅ Established Patterns

### 1. **Better Auth Configuration**
```typescript
// File: src/lib/auth/auth.ts
import { serverOnly } from '@tanstack/react-start'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization, magicLink, admin, emailOTP } from 'better-auth/plugins'
import { stripe as stripePlugin } from '@better-auth/stripe'
import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements } from 'better-auth/plugins/organization/access'
import { reactStartCookies } from 'better-auth/react-start'

import { db } from '@/lib/db/db'
import { redis } from '@/lib/db/redis'
import * as schema from '@/database/schema'

// Define permission statements
// NOTE: defaultStatements from Better Auth includes:
// - member: ['create', 'update', 'delete'] - NO 'read' permission
// - organization: ['update', 'delete']
// - invitation: ['create', 'cancel']
// - team: ['create', 'update', 'delete']
const statement = {
  ...defaultStatements,
  todos: ['create', 'read', 'update', 'delete', 'assign'],
  billing: ['view', 'manage'],
  invitation: ['create', 'read', 'delete', 'cancel'],
} as const

// Create access control instance
const ac = createAccessControl(statement)

// Define role hierarchy
const viewer = ac.newRole({
  billing: ['view'],
})

const member = ac.newRole({
  todos: ['create', 'update', 'delete'],
  billing: ['view'],
})

const orgAdmin = ac.newRole({
  organization: ['update'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'delete', 'cancel'],
  todos: ['create', 'update', 'delete', 'assign'],
  billing: ['view', 'manage'],
})

const owner = ac.newRole({
  organization: ['update', 'delete'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'delete', 'cancel'],
  todos: ['create', 'update', 'delete', 'assign'],
  billing: ['view', 'manage'],
})

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL!,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: schema,
  }),
  user: {
    additionalFields: {
      firstName: { type: 'string', required: false },
      lastName: { type: 'string', required: false },
      onboardingCompleted: { type: 'boolean', defaultValue: false, required: false },
      language: { type: 'string', defaultValue: 'en', required: false },
    },
  },
  secondaryStorage: {
    get: async key => await redis.get(key),
    set: async (key, value, ttl) => {
      if (ttl) {
        await redis.set(key, value, { EX: ttl })
      } else {
        await redis.set(key, value)
      }
    },
    delete: async key => await redis.del(key),
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    ...(process.env.GITHUB_CLIENT_ID && {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      },
    }),
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url)
      },
      expiresIn: 60 * 5, // 5 minutes
    }),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        await sendOTPEmail(email, otp, type)
      },
      disableSignUp: false,
    }),
    admin({
      adminRoles: ['superadmin'],
      adminUserIds: process.env.ADMIN_USER_IDS?.split(',') || [],
    }),
    stripePlugin({
      stripeClient: stripe,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      createCustomerOnSignUp: false,
      // Stripe configuration
    }),
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 99,
      invitationExpiresIn: 60 * 60 * 48, // 48 hours
      sendInvitationEmail: async data => {
        const inviteUrl = `${process.env.BETTER_AUTH_URL}/invite/${data.id}`
        await sendInvitationEmail(
          data.email,
          data.inviter?.user?.name || 'A team member',
          data.organization.name,
          inviteUrl
        )
      },
      ac,
      roles: { owner, admin: orgAdmin, member, viewer },
    }),
    reactStartCookies(), // Must be last plugin
  ],
})

export const roles = { owner, admin: orgAdmin, member, viewer }
export { ac }
```

### 2. **Authentication Middleware**
```typescript
// File: src/lib/auth/auth-middleware.ts
import { createMiddleware } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'

import { auth } from './auth'

export const authMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const request = getWebRequest()
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true }, // Always fetch fresh session data
  })

  if (!session) {
    throw new Error('Unauthorized')
  }

  return next({
    context: {
      user: session.user,
      session: session.session,
    },
  })
})
```

### 3. **Client-Side Auth Setup**
```typescript
// File: src/lib/auth/auth-client.ts
import { createAuthClient } from 'better-auth/react'
import {
  organizationClient,
  magicLinkClient,
  adminClient,
  inferAdditionalFields,
  emailOTPClient,
} from 'better-auth/client/plugins'

import type { auth } from './auth'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL,
  plugins: [
    magicLinkClient(),
    emailOTPClient(),
    adminClient(),
    organizationClient(),
    inferAdditionalFields<typeof auth>(),
  ],
})
```

### 4. **Auth Hooks Integration**
```typescript
// File: src/lib/auth/auth-hooks.ts
import { createAuthHooks } from '@daveyplate/better-auth-tanstack'

import { authClient } from '@/lib/auth/auth-client'

export const authHooks = createAuthHooks(authClient)

export const {
  useSession,
  usePrefetchSession,
  useToken,
  useListAccounts,
  useListSessions,
  useUpdateUser,
  useListOrganizations,
  useAuthQuery,
  useAuthMutation,
} = authHooks
```

### 5. **Permission Checking System**
```typescript
// File: src/lib/utils/permissions.ts
import { getWebRequest } from '@tanstack/react-start/server'

import { PermissionError } from './errors'
import { auth } from '@/lib/auth/auth'

/**
 * Check if the current user has specific permissions for a resource
 * @param resource - The resource to check permissions for (e.g., 'billing', 'todos')
 * @param actions - Array of actions to check (e.g., ['view', 'manage'])
 * @param organizationId - The organization context for the permission check
 * @param customMessage - Optional custom error message if permission is denied
 */
export const checkPermission = async (
  resource: string,
  actions: string[],
  organizationId: string,
  customMessage?: string
) => {
  const request = getWebRequest()

  try {
    const hasPermission = await auth.api.hasPermission({
      headers: request.headers,
      body: {
        organizationId,
        permissions: {
          [resource]: actions,
        },
      },
    })

    if (!hasPermission.success) {
      const defaultMessage = `You don't have permission to ${actions.join('/')} ${resource}`
      throw new PermissionError(customMessage || defaultMessage)
    }
  } catch (error) {
    throw error
  }
}
```

#### Client-Side Permission Hooks

**`useClientPermissions()` - Your Primary Permission Hook**

This is the hook you'll use **99% of the time** for all UI permission decisions:

```typescript
// File: src/components/TodoActions.tsx
import { useClientPermissions } from '@/lib/hooks/use-permissions'

function TodoActions({ todo }: { todo: Todo }) {
  const { canUpdateTodo, canDeleteTodo, canCreateTodo, isLoading } = useClientPermissions()
  
  if (isLoading) {
    return <div>Loading permissions...</div>
  }
  
  return (
    <div className="flex gap-2">
      {canUpdateTodo() && (
        <Button onClick={() => editTodo(todo.id)}>
          Edit
        </Button>
      )}
      {canDeleteTodo() && (
        <Button variant="destructive" onClick={() => deleteTodo(todo.id)}>
          Delete
        </Button>
      )}
      {canCreateTodo() && (
        <Button onClick={() => createTodo()}>
          New Todo
        </Button>
      )}
    </div>
  )
}
```

**Use `useClientPermissions()` for:**
- Show/hide buttons and UI elements
- Enable/disable form fields
- Conditional rendering of components
- All UI state management based on permissions
- Fast, synchronous permission checks

**`useServerPermissions()` - Rarely Used**

This hook exists but is **almost never needed** in practice:

```typescript
// File: src/components/DebugPanel.tsx (theoretical example)
import { useServerPermissions } from '@/lib/auth/auth-hooks'

function PermissionDebugPanel() {
  // This is a contrived example - you probably won't need this
  const { data: serverPerms, isLoading } = useServerPermissions({
    permissions: { todos: ['create', 'update', 'delete'] }
  })
  
  return <div>Server says: {JSON.stringify(serverPerms)}</div>
}
```

**Why You Rarely Need `useServerPermissions()`:**
- **Server functions already validate permissions** - When a user clicks "Delete", the `deleteTodo` server function runs `checkPermission()` for security
- **Client permissions are for UX only** - They control what the user sees, not what they can do
- **Double-checking is redundant** - Server-side validation happens anyway when actions are performed

**Real-World Security Model:**
1. **Client-side (`useClientPermissions`)**: Controls UI state for better UX
2. **Server-side (`checkPermission` in server functions)**: Actual security enforcement
3. **Result**: Clean separation of concerns, no redundant checks needed

## 🔧 Step-by-Step Implementation

### 1. Environment Configuration
```bash
# Required environment variables
BETTER_AUTH_URL="http://localhost:2847"
BETTER_AUTH_SECRET="your-32-character-secret-key"
VITE_BETTER_AUTH_URL="http://localhost:2847"

# Social providers
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"  # Optional
GITHUB_CLIENT_SECRET="your-github-client-secret"  # Optional

# Database & Redis
DATABASE_URL="postgresql://user:pass@localhost:5432/db"
REDIS_URL="redis://localhost:6379"

# Stripe (for billing)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Admin users (comma-separated user IDs)
ADMIN_USER_IDS="user-id-1,user-id-2"
```

### 2. Protected Server Function Implementation
```typescript
// File: src/features/todos/lib/todos.server.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { checkPermission } from '@/lib/utils/permissions'
import { db } from '@/lib/db/db'
import { todos } from '@/database/schema'

const createTodoSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
})

export const createTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware]) // This includes authMiddleware
  .validator((data: unknown) => createTodoSchema.parse(data))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const user = context.user
    const orgId = context.organizationId

    // ALWAYS check permissions before action
    await checkPermission('todos', ['create'], orgId)

    const newTodo = await db
      .insert(todos)
      .values({
        title: data.title,
        description: data.description,
        organizationId: orgId,
        createdBy: user.id,
        completed: false,
      })
      .returning()

    return newTodo[0]
  })
```

### 3. Client-Side Authentication Components
```typescript
// Example: Magic Link Sign In Component
import { useState } from 'react'
import { authClient } from '@/lib/auth/auth-client'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'

export function MagicLinkSignIn() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleMagicLink = async () => {
    setIsLoading(true)
    try {
      await authClient.magicLink.sendMagicLink({ email })
      // Show success message
    } catch (error) {
      // Handle error
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
      />
      <Button onClick={handleMagicLink} disabled={isLoading}>
        Send Magic Link
      </Button>
    </div>
  )
}
```

## 🎯 Integration Requirements

### With Organization System
```typescript
// Organization middleware MUST come after auth middleware
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'

export const protectedAction = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware]) // Includes auth middleware internally
  .handler(async ({ context }) => {
    // context.user - authenticated user
    // context.organizationId - validated organization access
  })
```

### With Database Schema
```typescript
// User table must match Better Auth requirements
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').$defaultFn(() => false).notNull(),
  image: text('image'),
  role: text('role').default('user').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
  language: text('language').default('en').notNull(),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
})
```

### With Error Handling
```typescript
// Custom permission error handling
export class PermissionError extends Error {
  constructor(message: string, public statusCode: number = 403) {
    super(message)
    this.name = 'PermissionError'
  }
}
```

## 🧪 Testing Requirements

### Authentication Testing
```typescript
// Test authenticated server functions
import { describe, it, expect, vi } from 'vitest'
import { createTodo } from './todos.server'

describe('createTodo', () => {
  it('should require authentication', async () => {
    // Mock unauthenticated request
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    
    await expect(createTodo({ title: 'Test' })).rejects.toThrow('Unauthorized')
  })

  it('should check permissions', async () => {
    // Mock authenticated user without permissions
    vi.mocked(auth.api.hasPermission).mockResolvedValue({ success: false })
    
    await expect(createTodo({ title: 'Test' })).rejects.toThrow('PermissionError')
  })
})
```

## 🛡️ Better-Auth Error Handling Integration

### Separation of Concerns

Better-auth handles authentication-specific errors through its own error management system, which works alongside (not in conflict with) the application's error handling standards:

#### Authentication Errors (Handled by Better-Auth)
```typescript
// These hooks have built-in error handling - DO NOT wrap them
const { data: session, error: authError } = useSession()
const { data: organizations, error: orgError } = useListOrganizations() 
const updateMutation = useUpdateUser() // Built-in mutation error handling

// Better-auth automatically handles:
// - Session expiration → redirect to login
// - Invalid tokens → clear session
// - OAuth failures → user feedback
```

#### Business Logic Errors (Use Application Standards)
```typescript
// For non-auth operations, use standardized patterns
const { data: todos, isError, error } = useTableQuery({
  queryKey: ['todos'],
  queryFn: getTodosTable, // This is business logic, not auth
})

if (isError && error) {
  return <ErrorState error={parseError(error)} onRetry={refetch} />
}
```

#### DO NOT Wrap Better-Auth Hooks
```typescript
// ❌ WRONG - Don't wrap better-auth hooks in custom error handling
const { data } = useQuery({
  queryKey: ['session'],
  queryFn: () => authClient.getSession() // Don't do this
})

// ✅ CORRECT - Use better-auth hooks directly
const { data: session } = useSession() // Built-in error handling
```

#### Profile Updates Pattern
```typescript
// Profile updates should use better-auth's mutation hooks
const updateUserMutation = useUpdateUser()

const handleSave = async () => {
  try {
    await updateUserMutation.mutateAsync({
      name: `${firstName} ${lastName}`,
    })
    showSuccess('Profile updated')
  } catch (error) {
    showError(error) // Application error handler for UI feedback
  }
}
```

This ensures authentication errors are handled by the specialized better-auth system while business logic errors use the standardized application patterns.

## 📋 Implementation Checklist

Before considering authentication complete, verify:

- [ ] **Better Auth Config**: All required plugins configured
- [ ] **Database Schema**: Tables match Better Auth requirements
- [ ] **Environment Variables**: All auth-related env vars set
- [ ] **Middleware Chain**: Auth → Organization → Handler order maintained
- [ ] **Permission System**: checkPermission used for all protected actions
- [ ] **Client Integration**: Auth hooks properly configured
- [ ] **Social Providers**: Google (required) and GitHub (optional) configured
- [ ] **Email Integration**: Magic link and OTP emails working
- [ ] **Redis Storage**: Secondary storage configured for sessions
- [ ] **Error Handling**: Permission errors properly handled and translated
- [ ] **Data Fetching Integration**: Auth hooks work properly with error handling standards

## 🚀 Role Hierarchy & Permissions

### Role Definitions
```typescript
// Viewer: Read-only access
const viewer = ac.newRole({
  billing: ['view'], // Can view billing information only
})

// Member: Basic organizational member
const member = ac.newRole({
  todos: ['create', 'update', 'delete'], // Can manage their own todos
  billing: ['view'], // Can view billing information
})

// Admin: Organizational administrator
const orgAdmin = ac.newRole({
  organization: ['update'], // Can update org settings
  member: ['create', 'update', 'delete'], // Can manage members
  invitation: ['create', 'delete', 'cancel'], // Can manage invitations
  todos: ['create', 'update', 'delete', 'assign'], // Can assign todos
  billing: ['view', 'manage'], // Can manage billing
})

// Owner: Full organizational control
const owner = ac.newRole({
  organization: ['update', 'delete'], // Can delete organization
  member: ['create', 'update', 'delete'], // Full member management
  invitation: ['create', 'delete', 'cancel'], // Full invitation management
  todos: ['create', 'update', 'delete', 'assign'], // Full todo management
  billing: ['view', 'manage'], // Full billing management
})
```

### Permission Usage Examples
```typescript
// Billing management (admin/owner only)
await checkPermission('billing', ['manage'], organizationId)

// Todo assignment (admin/owner only)  
await checkPermission('todos', ['assign'], organizationId)

// Member management (admin/owner only)
await checkPermission('member', ['create', 'delete'], organizationId)

// Basic todo operations (member+ level)
await checkPermission('todos', ['create', 'update'], organizationId)

// IMPORTANT: Viewing team members
// Do NOT use: await checkPermission('member', ['read'], organizationId) 
// The 'member' resource doesn't have a 'read' permission in Better Auth
// Instead, use organizationMiddleware to verify membership:
export const getTeamMembersTable = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware]) // Gets organizationId from context, verifies membership
  .handler(async ({ data, context }) => {
    const organizationId = context.organizationId
    if (!organizationId) {
      throw new AppError('No organization context')
    }
    // organizationMiddleware already verified user is a member
    // No additional permission check needed for viewing
    // Fetch team members with pagination and filtering...
  })
```

## Route-Based Authentication Control

### Organization Check Bypass
Routes can opt out of organization selection requirements using metadata:

```typescript
// Routes that should skip organization checks
export const Route = createFileRoute('/_authenticated/onboarding')({
  staticData: {
    skipOrgCheck: true,  // Skip during onboarding flow
  }
})

export const Route = createFileRoute('/_authenticated/superadmin')({
  staticData: {
    skipOrgCheck: true,  // Superadmin transcends organizations
  }
})
```

### Implementation in _authenticated Layout
```typescript
// Check all matched routes for skipOrgCheck flag
const shouldSkipOrgCheck = matches.some(match => match.staticData?.skipOrgCheck === true)

if (!shouldSkipOrgCheck && session.user.onboardingCompleted) {
  // Perform organization validation
}
```

### When to Use skipOrgCheck
- **Onboarding flows**: Users haven't selected an organization yet
- **Organization selection**: This IS the org selection page  
- **Super admin routes**: Admin functionality that transcends organizations
- **System-level pages**: Routes that don't require organization context

This authentication system provides enterprise-grade security with fine-grained permissions, multi-provider support, and seamless integration with the organization-based multi-tenancy system.