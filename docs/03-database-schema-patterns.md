# Database Schema & Patterns Implementation Guide

This document provides comprehensive guidance for implementing database schemas and patterns using Drizzle ORM with PostgreSQL, focusing on multi-tenant architecture, relationship management, and type-safe database operations.

## 🚨 Critical Rules

- **ALWAYS use Drizzle ORM** - Never write raw SQL queries
- **MUST include schema in database connection** - Required for type safety and relations
- **ALWAYS use consistent timestamp patterns** - Use `.defaultNow().notNull()` for all timestamps
- **NEVER bypass foreign key constraints** - All relationships must be properly constrained
- **MUST scope data by organization** - All user data MUST include organizationId

## ❌ Common AI Agent Mistakes

### Database Connection Without Schema
```typescript
// ❌ NEVER create database connection without schema
import { drizzle } from 'drizzle-orm/postgres-js'
export const db = drizzle(client) // Missing schema - breaks type safety!
```

### Inconsistent Timestamp Patterns
```typescript
// ❌ NEVER mix timestamp default patterns
createdAt: timestamp('created_at').$defaultFn(() => new Date()) // Wrong
createdAt: timestamp('created_at').defaultNow()                // Missing .notNull()
createdAt: timestamp('created_at').notNull()                   // Missing default
```

### Missing Foreign Key Constraints
```typescript
// ❌ NEVER create relationships without proper constraints
organizationId: text('organization_id').notNull() // Missing .references()

// ❌ NEVER use inconsistent onDelete behaviors without reason
userId: text('user_id').references(() => user.id) // Missing onDelete constraint
```

### Multi-Tenancy Violations
```typescript
// ❌ NEVER create user data without organization scoping
export const userPosts = pgTable('user_posts', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => user.id),
  title: text('title').notNull(),
  // Missing organizationId - security vulnerability!
})
```

## ✅ Established Patterns

### 1. **Database Connection with Schema**
```typescript
// File: src/lib/db/db.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from '@/database/schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required')
}

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(client, { schema })
export { client }
```

### 2. **Core Authentication Schema**
```typescript
// File: src/database/schema.ts
import { pgTable, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core'
import { nanoid } from 'nanoid'

// User table - Better Auth compatible
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').$defaultFn(() => false).notNull(),
  image: text('image'),
  role: text('role').default('user').notNull(),
  
  // Additional user fields
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
  language: text('language').default('en').notNull(),
  
  // Consistent timestamp pattern
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Account table - Better Auth OAuth accounts
export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Session table - Better Auth session management
export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  activeOrganizationId: text('active_organization_id'),
  impersonatedBy: text('impersonated_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Verification table - Better Auth email verification
export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

### 3. **Multi-Tenancy Schema**
```typescript
// Organization table - Multi-tenancy root
export const organization = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  logo: text('logo'),

  // Billing integration
  currentPlan: text('current_plan').default('free').notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  planLimits: jsonb('plan_limits').$type<{
    todos?: number
    members?: number
    storage?: number
  }>(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: text('metadata'),
})

// Member table - Organization membership
export const member = pgTable('member', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').default('member').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Invitation table - Team member invitations
export const invitation = pgTable('invitation', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role'),
  status: text('status').default('pending').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  inviterId: text('inviter_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})
```

### 4. **Feature Data Schema (Todos Example)**
```typescript
// Todos table - Organization-scoped user data with soft delete support
export const todos = pgTable('todos', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  title: text('title').notNull(),
  description: text('description'),
  
  // REQUIRED: Organization scoping
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  
  // User relationships with different cascade behaviors
  createdBy: text('created_by')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  assignedTo: text('assigned_to')
    .references(() => user.id, { onDelete: 'set null' }), // Keep todo if assignee deleted
  
  // Feature-specific fields
  completed: boolean('completed').default(false).notNull(),
  priority: integer('priority').default(3).notNull(),
  dueDate: timestamp('due_date'),
  
  // Soft delete support - RECOMMENDED for user data recovery
  deletedAt: timestamp('deleted_at'), // NULL = active, timestamp = soft deleted
  
  // Consistent timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

### 5. **Billing Schema (Stripe Integration)**
```typescript
// Subscription table - Better Auth Stripe integration
export const subscription = pgTable('subscription', {
  id: text('id').primaryKey(),
  plan: text('plan').notNull(),
  referenceId: text('reference_id').notNull(), // Organization ID
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  status: text('status').default('incomplete'),
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  trialStart: timestamp('trial_start'),
  trialEnd: timestamp('trial_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  seats: integer('seats'),
  
  // Additional Stripe fields for compatibility
  userId: text('user_id').references(() => user.id),
  stripePriceId: text('stripe_price_id'),
  stripeCurrentPeriodEnd: timestamp('stripe_current_period_end'),
  stripeCurrentPeriodStart: timestamp('stripe_current_period_start'),
  stripeCancelAt: timestamp('stripe_cancel_at'),
  stripeCancelAtPeriodEnd: boolean('stripe_cancel_at_period_end'),
  stripeTrialStart: timestamp('stripe_trial_start'),
  stripeTrialEnd: timestamp('stripe_trial_end'),
  limits: jsonb('limits'), // Plan limits (todos, members, storage)
  metadata: jsonb('metadata'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

## 🔧 Step-by-Step Implementation

### 1. Database Configuration
```typescript
// File: drizzle.config.ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/database/schema.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  },
  migrations: {
    prefix: 'timestamp',
    table: '__drizzle_migrations__',
    schema: 'public'
  },
  schemaFilter: 'public',
  tablesFilter: '*',
  verbose: true,
  strict: true,
  breakpoints: true
} satisfies Config
```

### 2. Creating New Feature Tables
```typescript
// ALWAYS follow this pattern for new feature tables
export const newFeature = pgTable('new_feature', {
  // Primary key
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  
  // Feature-specific fields
  title: text('title').notNull(),
  description: text('description'),
  
  // REQUIRED: Organization scoping
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  
  // User relationships
  createdBy: text('created_by')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Optional user relationships (decide cascade behavior)
  assignedTo: text('assigned_to')
    .references(() => user.id, { onDelete: 'set null' }),
  
  // REQUIRED: Consistent timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

### 3. Database Queries with Type Safety
```typescript
// File: src/features/todos/lib/todos.server.ts
import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db/db'
import { todos } from '@/database/schema'

// ALWAYS include organization scoping AND soft delete filtering in queries
export const getTodoById = async (id: string, organizationId: string) => {
  const result = await db
    .select()
    .from(todos)
    .where(and(
      eq(todos.id, id),
      eq(todos.organizationId, organizationId),
      isNull(todos.deletedAt) // CRITICAL: Filter out soft-deleted records
    ))
    .limit(1)
  
  if (!result[0]) {
    throw AppError.notFound('Todo')
  }
  return result[0]
}

// ALWAYS validate organization access in mutations
export const createTodo = async (data: CreateTodoInput, organizationId: string, userId: string) => {
  return await db
    .insert(todos)
    .values({
      title: data.title,
      description: data.description,
      organizationId, // REQUIRED
      createdBy: userId, // REQUIRED
      completed: false,
    })
    .returning()
}

// ALWAYS scope updates and deletes by organization
// RECOMMENDED: Use soft delete for user data recovery
export const deleteTodo = async (todoId: string, organizationId: string) => {
  // Soft delete: set deletedAt timestamp instead of removing record
  return await db
    .update(todos)
    .set({ 
      deletedAt: new Date(),
      updatedAt: new Date()
    })
    .where(and(
      eq(todos.id, todoId),
      eq(todos.organizationId, organizationId), // REQUIRED for security
      isNull(todos.deletedAt) // Only delete active records
    ))
    .returning()
}

// Restore functionality for undo operations
export const restoreTodo = async (todoId: string, organizationId: string) => {
  return await db
    .update(todos)
    .set({ 
      deletedAt: null,
      updatedAt: new Date()
    })
    .where(and(
      eq(todos.id, todoId),
      eq(todos.organizationId, organizationId), // REQUIRED for security
      isNotNull(todos.deletedAt) // Only restore deleted records
    ))
    .returning()
}
```

## 🎯 Integration Requirements

### With Better Auth
```typescript
// Database adapter configuration
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/lib/db/db'
import * as schema from '@/database/schema'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: schema, // MUST include schema for proper table mapping
  }),
})
```

### With Migrations
```bash
# Generate migration
pnpm drizzle-kit generate

# Run migrations
pnpm drizzle-kit migrate

# View migrations
pnpm drizzle-kit up
```

### With Development Tools
```bash
# Database studio
pnpm drizzle-kit studio

# Push schema changes (development only)
pnpm drizzle-kit push
```

## 🧪 Testing Requirements

### Database Testing Setup
```typescript
// File: src/test/db-setup.ts
import { beforeEach, afterEach } from 'vitest'
import { db, client } from '@/lib/db/db'

beforeEach(async () => {
  // Start transaction for test isolation
  await db.execute('BEGIN')
})

afterEach(async () => {
  // Rollback transaction
  await db.execute('ROLLBACK')
})
```

### Query Testing Patterns
```typescript
// Test organization scoping
import { describe, it, expect } from 'vitest'
import { getTodoById, createTodo } from './todos.server'

describe('getTodoById', () => {
  it('should only return todo if it belongs to the specified organization', async () => {
    // Create todos in different organizations
    const todo1 = await createTodo({ title: 'Org 1 Todo' }, 'org1', 'user1')
    const todo2 = await createTodo({ title: 'Org 2 Todo' }, 'org2', 'user1')
    
    // Should get correct todo for org1
    const org1Todo = await getTodoById(todo1.id, 'org1')
    expect(org1Todo.title).toBe('Org 1 Todo')
    
    // Should throw when trying to access org2's todo from org1 context
    await expect(getTodoById(todo2.id, 'org1')).rejects.toThrow('Todo not found')
  })
})
```

## 📋 Implementation Checklist

Before considering database implementation complete, verify:

- [ ] **Schema Import**: Database connection includes schema parameter
- [ ] **Timestamp Consistency**: All timestamps use `.defaultNow().notNull()`
- [ ] **Foreign Key Constraints**: All relationships properly constrained
- [ ] **Organization Scoping**: All user data includes organizationId
- [ ] **Better Auth Compatibility**: User/account/session tables match requirements
- [ ] **Migration Configuration**: Drizzle config properly set up
- [ ] **Type Safety**: All queries use proper Drizzle operators
- [ ] **Cascade Behaviors**: onDelete behaviors are intentional and consistent
- [ ] **Primary Keys**: All tables have appropriate primary key strategy
- [ ] **Index Strategy**: Performance-critical queries have appropriate indexes

## 🚀 Advanced Patterns

### Complex Queries with Joins
```typescript
// Multi-table queries with proper typing
import { alias } from 'drizzle-orm/pg-core'

export const getTodoByIdWithAssignee = async (id: string, organizationId: string) => {
  const assigneeUser = alias(user, 'assignee_user')
  const creatorUser = alias(user, 'creator_user')
  
  return await db
    .select({
      todo: todos,
      assignee: {
        id: assigneeUser.id,
        name: assigneeUser.name,
        email: assigneeUser.email,
      },
      creator: {
        id: creatorUser.id,
        name: creatorUser.name,
      }
    })
    .from(todos)
    .leftJoin(assigneeUser, eq(todos.assignedTo, assigneeUser.id))
    .leftJoin(creatorUser, eq(todos.createdBy, creatorUser.id))
    .where(eq(todos.organizationId, organizationId))
}
```

### Batch Operations with Transactions
```typescript
// Transaction for atomic operations
export const bulkCreateTodos = async (
  todoData: CreateTodoInput[],
  organizationId: string,
  userId: string
) => {
  return await db.transaction(async (tx) => {
    const results = []
    
    for (const data of todoData) {
      const result = await tx
        .insert(todos)
        .values({
          ...data,
          organizationId,
          createdBy: userId,
        })
        .returning()
      
      results.push(result[0])
    }
    
    return results
  })
}
```

### JSONB Field Usage
```typescript
// Typed JSONB fields
export const settings = pgTable('settings', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  preferences: jsonb('preferences').$type<{
    theme: 'light' | 'dark'
    notifications: {
      email: boolean
      push: boolean
    }
    language: string
  }>(),
})

// Query JSONB fields
const settingsWithDarkTheme = await db
  .select()
  .from(settings)
  .where(
    and(
      eq(settings.organizationId, orgId),
      eq(settings.preferences.theme, 'dark')
    )
  )
```

## 🗑️ Soft Delete Implementation Pattern

### When to Use Soft Delete vs Hard Delete

**Use Soft Delete For:**
- ✅ User-generated content (todos, posts, comments)
- ✅ Important business records that may need recovery
- ✅ Data that users might accidentally delete
- ✅ Records that need audit trails
- ✅ Data with complex relationships that are expensive to rebuild

**Use Hard Delete For:**
- ❌ Sensitive data that must be permanently removed (GDPR compliance)
- ❌ Large datasets where storage cost is a concern
- ❌ Session data, temporary files, logs
- ❌ Data that becomes invalid over time
- ❌ System-generated data with no recovery value

### Complete Soft Delete Implementation

```typescript
// File: src/features/todos/lib/todos.server.ts - Complete soft delete pattern
import { createServerFn } from '@tanstack/react-start'
import { eq, and, desc, isNull, isNotNull } from 'drizzle-orm'
import { z } from 'zod'

import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { checkPermission } from '@/lib/utils/permissions'
import { db } from '@/lib/db/db'
import { todos } from '@/database/schema'
import { AppError } from '@/lib/utils/errors'

const todoIdSchema = z.object({
  id: z.string(),
})

// GET - Always filter out soft-deleted records
export const getTodoById = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId

    const todo = await db
      .select()
      .from(todos)
      .where(and(
        eq(todos.id, data.id),
        eq(todos.organizationId, orgId),
        isNull(todos.deletedAt) // CRITICAL: Exclude soft-deleted
      ))
      .limit(1)

    if (!todo[0]) {
      throw AppError.notFound('Todo')
    }

    return todo[0]
  })

// DELETE - Soft delete with undo capability
export const deleteTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    
    // Check permissions
    await checkPermission('todos', ['delete'], orgId)

    // Verify todo exists and is not already deleted
    const existingTodo = await db
      .select()
      .from(todos)
      .where(and(
        eq(todos.id, data.id), 
        eq(todos.organizationId, orgId),
        isNull(todos.deletedAt) // Only active todos can be deleted
      ))
      .limit(1)

    if (!existingTodo[0]) {
      throw AppError.notFound('Todo')
    }

    // Soft delete: set deletedAt timestamp
    await db
      .update(todos)
      .set({ 
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        eq(todos.id, data.id),
        eq(todos.organizationId, orgId)
      ))

    return { success: true, canUndo: true }
  })

// RESTORE - Undo delete operation
export const undoDeleteTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    
    // Check permissions - use 'create' since we're restoring data
    await checkPermission('todos', ['create'], orgId)

    // Verify todo exists and is soft-deleted
    const deletedTodo = await db
      .select()
      .from(todos)
      .where(and(
        eq(todos.id, data.id),
        eq(todos.organizationId, orgId),
        isNotNull(todos.deletedAt) // Only deleted todos can be restored
      ))
      .limit(1)

    if (!deletedTodo[0]) {
      throw AppError.notFound('Deleted Todo')
    }

    // Restore: clear deletedAt timestamp
    const restored = await db
      .update(todos)
      .set({ 
        deletedAt: null,
        updatedAt: new Date()
      })
      .where(and(
        eq(todos.id, data.id),
        eq(todos.organizationId, orgId)
      ))
      .returning()

    return restored[0]
  })

// CLEANUP - Permanent delete for old soft-deleted records
export const permanentlyDeleteOldTodos = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const orgId = context.organizationId
    
    await checkPermission('todos', ['delete'], orgId)

    // Delete records soft-deleted more than 30 days ago
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const deleted = await db
      .delete(todos)
      .where(and(
        eq(todos.organizationId, orgId),
        isNotNull(todos.deletedAt),
        // Add condition for deletedAt < thirtyDaysAgo
      ))
      .returning()

    return { deletedCount: deleted.length }
  })
```

### Database Indexes for Soft Delete

```sql
-- Essential indexes for soft delete pattern
-- Composite index for active records (most common query)
CREATE INDEX CONCURRENTLY idx_todos_active_org 
ON todos (organization_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Index for finding deleted records (for admin/cleanup)
CREATE INDEX CONCURRENTLY idx_todos_deleted_org 
ON todos (organization_id, deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Unique constraint that considers soft delete
CREATE UNIQUE INDEX CONCURRENTLY idx_todos_unique_title_active
ON todos (organization_id, title)
WHERE deleted_at IS NULL;
```

### Migration Script for Adding Soft Delete

```sql
-- Migration: Add soft delete to existing table
BEGIN;

-- Add deletedAt column
ALTER TABLE todos ADD COLUMN deleted_at TIMESTAMP NULL;

-- Add comment for documentation
COMMENT ON COLUMN todos.deleted_at IS 'Timestamp when record was soft deleted. NULL = active, timestamp = deleted';

-- Create indexes
CREATE INDEX CONCURRENTLY idx_todos_active_org 
ON todos (organization_id, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY idx_todos_deleted_org 
ON todos (organization_id, deleted_at) 
WHERE deleted_at IS NOT NULL;

COMMIT;
```

### Performance Considerations

```typescript
// Efficient bulk operations with soft delete
export const bulkDeleteTodos = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator(z.object({ ids: z.array(z.string()) }))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    
    await checkPermission('todos', ['delete'], orgId)

    // Bulk soft delete - much faster than individual operations
    const deleted = await db
      .update(todos)
      .set({ 
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        inArray(todos.id, data.ids),
        eq(todos.organizationId, orgId),
        isNull(todos.deletedAt) // Only delete active records
      ))
      .returning({ id: todos.id })

    return { 
      success: true, 
      deletedCount: deleted.length,
      canUndo: true 
    }
  })
```

### Testing Soft Delete Implementation

```typescript
// Test soft delete behavior
describe('Soft Delete Implementation', () => {
  it('should soft delete records without removing from database', async () => {
    const todo = await createTodo(mockData)
    
    await deleteTodo(todo.id, orgId)
    
    // Record should still exist in database
    const directQuery = await db
      .select()
      .from(todos)
      .where(eq(todos.id, todo.id))
    
    expect(directQuery[0]).toBeDefined()
    expect(directQuery[0].deletedAt).not.toBeNull()
    
    // But should not appear in normal queries
    await expect(getTodoById(todo.id, orgId)).rejects.toThrow('Todo not found')
  })

  it('should restore soft deleted records', async () => {
    const todo = await createTodo(mockData)
    await deleteTodo(todo.id, orgId)
    
    const restored = await undoDeleteTodo(todo.id, orgId)
    
    expect(restored.deletedAt).toBeNull()
    
    // Should appear in normal queries again
    const activeTodo = await getTodoById(todo.id, orgId)
    expect(activeTodo.id).toBe(todo.id)
  })
})
```

This database architecture provides a robust foundation for multi-tenant SaaS applications with proper data isolation, type safety, scalability considerations, and comprehensive soft delete support for improved user experience and data recovery.