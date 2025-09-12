# Server Functions & API Patterns Implementation Guide

This document provides comprehensive guidance for implementing TanStack Start server functions, API routes, and server-side patterns with proper validation, middleware chains, and error handling.

## 🚨 Critical Rules

- **ALWAYS use createServerFn** - Never create custom API endpoints outside of TanStack Start patterns
- **MUST include middleware chain** - All protected operations require proper middleware
- **NEVER skip validation** - Every input must be validated using Zod schemas
- **ALWAYS handle errors properly** - Use AppError and consistent error responses
- **MUST scope by organization** - All user data operations require organization context

## ❌ Common AI Agent Mistakes

### Server Function Creation Violations
```typescript
// ❌ NEVER create server functions without proper structure
const badServerAction = async (data: any) => {
  // Missing createServerFn wrapper
  // No validation
  // No middleware
  return await db.insert(todos).values(data)
}

// ❌ NEVER skip method specification
export const action = createServerFn() // Missing method
  .handler(async ({ data }) => {
    // Implementation
  })
```

### Middleware Chain Violations
```typescript
// ❌ NEVER skip authentication middleware
export const createTodo = createServerFn({ method: 'POST' })
  .validator(schema.parse)
  .handler(async ({ data }) => {
    // Missing auth context - security vulnerability!
    await db.insert(todos).values(data)
  })

// ❌ NEVER use wrong middleware order
export const action = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware, authMiddleware]) // Wrong order!
  .handler(async ({ context }) => {
    // organizationMiddleware needs authenticated user
  })
```

### Validation Pattern Violations
```typescript
// ❌ NEVER skip input validation
export const updateTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ data, context }) => {
    // No validation - data could be anything!
    await db.update(todos).set(data)
  })

// ❌ NEVER use generic validation
.validator((data) => data as any) // Wrong - use proper Zod schema
```

### Error Handling Violations
```typescript
// ❌ NEVER throw generic errors
throw new Error('Something went wrong') // Not user-friendly

// ❌ NEVER skip error context
try {
  await db.operation()
} catch (error) {
  throw error // Missing context and translation
}
```

## ✅ Established Patterns

### 1. **Standard Server Function Pattern**
```typescript
// File: src/features/todos/lib/todos.server.ts
import { createServerFn } from '@tanstack/react-start'
import { eq, and, desc } from 'drizzle-orm'
import { z } from 'zod'
import { nanoid } from 'nanoid'

import errorTranslations from '@/i18n/locales/en/errors.json'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { checkPermission } from '@/lib/utils/permissions'
import { db } from '@/lib/db/db'
import { todos } from '@/database/schema'
import { ValidationError, AppError } from '@/lib/utils/errors'

// ALWAYS define validation schemas first
const createTodoSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.string().optional(),
  assignedTo: z.string().optional(),
})

const updateTodoSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueDate: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  completed: z.boolean().optional(),
})

// GET operation with organization scoping and validation
export const getTodoById = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }: { data: any, context: any }) => {
    const orgId = context.organizationId

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

    return {
      ...todo[0],
      priority: numberToPriority(todo[0].priority), // Transform data for client
    }
  })

// POST operation with validation and permissions
export const createTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => {
    try {
      return createTodoSchema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fields: Record<string, string[]> = {}
        error.errors.forEach((err: any) => {
          const path = err.path.join('.')
          if (!fields[path]) fields[path] = []

          if (err.code === 'too_small' && err.minimum === 1) {
            fields[path].push('VAL_REQUIRED_FIELD')
          } else {
            fields[path].push('VAL_INVALID_FORMAT')
          }
        })
        throw new ValidationError(fields, errorTranslations.server.validationFailed)
      }
      throw error
    }
  })
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const user = context.user
    const orgId = context.organizationId

    // ALWAYS check permissions
    await checkPermission('todos', ['create'], orgId)

    const newTodo = await db
      .insert(todos)
      .values({
        id: nanoid(),
        title: data.title,
        description: data.description,
        priority: priorityToNumber(data.priority),
        organizationId: orgId, // REQUIRED: Organization scoping
        createdBy: user.id,    // REQUIRED: Audit trail
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        assignedTo: data.assignedTo,
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    return {
      ...newTodo[0],
      priority: numberToPriority(newTodo[0].priority),
    }
  })

// UPDATE operation with ownership validation
export const updateTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => updateTodoSchema.parse(data))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const orgId = context.organizationId

    // CRITICAL: Verify resource belongs to organization
    const existingTodo = await db
      .select()
      .from(todos)
      .where(and(eq(todos.id, data.id), eq(todos.organizationId, orgId)))
      .limit(1)

    if (!existingTodo[0]) {
      throw AppError.notFound('Todo')
    }

    // Check permissions
    await checkPermission('todos', ['update'], orgId)

    const { id, priority, ...updateData } = data

    const updatePayload: any = {
      ...updateData,
      updatedAt: new Date(),
    }

    if (priority !== undefined) {
      updatePayload.priority = priorityToNumber(priority)
    }

    if (updateData.dueDate !== undefined) {
      updatePayload.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null
    }

    const updated = await db
      .update(todos)
      .set(updatePayload)
      .where(eq(todos.id, id))
      .returning()

    return {
      ...updated[0],
      priority: numberToPriority(updated[0].priority),
    }
  })
```

### 2. **File-Based API Routes**
```typescript
// File: src/routes/api/health.ts
import { createServerFileRoute } from '@tanstack/react-start/server'

import { redis } from '@/lib/db/redis'
import { db } from '@/lib/db/db'

export const ServerRoute = createServerFileRoute('/api/health').methods({
  GET: async () => {
    try {
      // Test database connection
      await db.execute('SELECT 1')

      // Test Redis connection
      await redis.ping()

      return Response.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
          redis: 'connected',
        },
      })
    } catch (error) {
      return Response.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  },
})
```

### 3. **Better Auth Integration**
```typescript
// File: src/routes/api/auth/$.ts
import { createServerFileRoute } from '@tanstack/react-start/server'

import { auth } from '@/lib/auth/auth'

export const ServerRoute = createServerFileRoute('/api/auth/$').methods({
  GET: async ({ request }) => {
    // All auth endpoints use Better Auth handler
    return auth.handler(request)
  },
  POST: ({ request }) => {
    return auth.handler(request)
  },
})
```

### 4. **File Upload Server Route**
```typescript
// File: src/routes/api/avatars/upload.ts
import { createServerFileRoute } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'

import { createLocalStorageService } from '@/lib/storage/local-storage-service'
import { ImageProcessor } from '@/lib/storage/image-processor'
import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/db'
import { user } from '@/database/schema'

export const ServerRoute = createServerFileRoute('/api/avatars/upload').methods({
  POST: async ({ request }) => {
    try {
      // Authenticate user
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session?.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Parse multipart form data
      const formData = await request.formData()
      const file = formData.get('avatar') as File

      if (!file) {
        return Response.json({ error: 'No file provided' }, { status: 400 })
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        return Response.json(
          {
            error: 'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.',
          },
          { status: 400 }
        )
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        return Response.json(
          {
            error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB`,
          },
          { status: 400 }
        )
      }

      // Convert file to buffer and validate
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const isValidImage = await ImageProcessor.validateImage(buffer)
      if (!isValidImage) {
        return Response.json({ error: 'File is not a valid image' }, { status: 400 })
      }

      // Process the image (resize, compress)
      const processed = await ImageProcessor.processAvatar(buffer)

      // Get current user's avatar to clean up old one
      const currentUser = await db
        .select()
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1)

      const oldAvatarUrl = currentUser[0]?.image

      // Initialize storage service
      const storage = createLocalStorageService()
      const avatarKey = storage.generateAvatarKey(session.user.id, 'jpg')

      // Upload processed avatar
      const uploadResult = await storage.uploadFile(avatarKey, processed.buffer, 'image/jpeg', {
        userId: session.user.id,
        originalFilename: file.name,
        processedAt: new Date().toISOString(),
      })

      // Update user's avatar using Better Auth API
      await auth.api.updateUser({
        headers: request.headers,
        body: {
          image: uploadResult.url,
        },
      })

      // Clean up old avatar
      if (oldAvatarUrl) {
        try {
          const oldKey = storage.extractKeyFromUrl(oldAvatarUrl)
          if (oldKey) {
            await storage.deleteFile(oldKey)
          }
        } catch (error) {
          console.warn('Failed to delete old avatar:', error)
        }
      }

      return Response.json({
        success: true,
        avatarUrl: uploadResult.url,
      })
    } catch (error) {
      console.error('Avatar upload error:', error)
      return Response.json(
        {
          error: error instanceof Error ? error.message : 'Failed to upload avatar',
        },
        { status: 500 }
      )
    }
  },
})
```

### 5. **Complex Billing Server Functions**
```typescript
// File: src/features/billing/lib/billing.server.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { eq, count } from 'drizzle-orm'

import { BILLING_PLANS } from './plans.config'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { checkPermission } from '@/lib/utils/permissions'
import { db } from '@/lib/db/db'
import { organization, todos, member } from '@/database/schema'
import { auth } from '@/lib/auth/auth'
import { AppError } from '@/lib/utils/errors'
import { ERROR_CODES } from '@/lib/errors/codes'

// GET subscription with Better Auth integration
export const getSubscription = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const orgId = context.organizationId!

    // Get organization with current plan
    const [org] = await db.select().from(organization).where(eq(organization.id, orgId))

    if (!org) {
      throw AppError.notFound('Organization')
    }

    // Use Better Auth API to list subscriptions
    let activeSubscription: any = null
    let allSubscriptions: any[] = []

    try {
      const subscriptions = await auth.api.listActiveSubscriptions({
        query: {
          referenceId: orgId,
        },
        headers: context.headers,
      })

      if (subscriptions && subscriptions.length > 0) {
        allSubscriptions = subscriptions
        activeSubscription =
          subscriptions.find((sub: any) => sub.status === 'active' || sub.status === 'trialing') ||
          subscriptions[0]
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error)
      // Continue without subscription data rather than failing
    }

    return {
      organization: org,
      subscription: activeSubscription,
      allSubscriptions,
      currentPlan: activeSubscription?.plan || org.currentPlan || 'free',
      features: BILLING_PLANS[org.currentPlan as keyof typeof BILLING_PLANS]?.features,
      limits: activeSubscription?.limits || org.planLimits || BILLING_PLANS.free.limits,
      hasStripeCustomer: !!org.stripeCustomerId || !!activeSubscription?.stripeCustomerId,
    }
  })

// POST checkout session creation
const createCheckoutSchema = z.object({
  plan: z.enum(['pro', 'business']),
  interval: z.enum(['monthly', 'annual']),
})

export const createCheckout = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => createCheckoutSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId!

    // Check billing permissions
    await checkPermission('billing', ['manage'], orgId)

    const { plan, interval } = data

    try {
      // Use Better Auth subscription API
      const result = await auth.api.upgradeSubscription({
        body: {
          plan,
          successUrl: `${process.env.BETTER_AUTH_URL}/billing?success=true`,
          cancelUrl: `${process.env.BETTER_AUTH_URL}/billing`,
          annual: interval === 'annual',
          referenceId: orgId,
        },
        headers: context.headers,
      })

      if (!result?.url) {
        throw new AppError(
          ERROR_CODES.SYS_CONFIG_ERROR,
          500,
          undefined,
          'Failed to create checkout session'
        )
      }

      return { checkoutUrl: result.url }
    } catch (error) {
      // Handle specific Stripe errors
      if ((error as any).type === 'StripeCardError') {
        throw new AppError(
          ERROR_CODES.BIZ_PAYMENT_FAILED,
          400,
          { reason: (error as any).message },
          'Payment failed'
        )
      }

      if ((error as any).type === 'StripeRateLimitError') {
        throw new AppError(ERROR_CODES.SYS_RATE_LIMIT, 429, undefined, 'Rate limit exceeded')
      }

      // Re-throw AppErrors, wrap unknown ones
      if (error instanceof AppError) {
        throw error
      }

      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        `Checkout failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  })

// Usage statistics with plan limits
export const getUsageStats = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const orgId = context.organizationId!

    // Get organization with limits
    const [org] = await db.select().from(organization).where(eq(organization.id, orgId)).limit(1)

    // Count current usage
    const todoCount = await db
      .select({ count: count(todos.id) })
      .from(todos)
      .where(eq(todos.organizationId, orgId))

    const memberCount = await db
      .select({ count: count(member.id) })
      .from(member)
      .where(eq(member.organizationId, orgId))

    const limits = org?.planLimits || BILLING_PLANS.free.limits

    return {
      usage: {
        todos: {
          used: todoCount[0]?.count || 0,
          limit: limits.todos || 0,
          percentage:
            (limits.todos || 0) === -1
              ? 0
              : Math.round(((todoCount[0]?.count || 0) / (limits.todos || 1)) * 100),
        },
        members: {
          used: memberCount[0]?.count || 0,
          limit: limits.members || 0,
          percentage:
            (limits.members || 0) === -1
              ? 0
              : Math.round(((memberCount[0]?.count || 0) / (limits.members || 1)) * 100),
        },
        storage: {
          used: 0, // Implement storage tracking as needed
          limit: limits.storage || 0,
          percentage: 0,
        },
      },
    }
  })
```

## 🔧 Step-by-Step Implementation

### 1. Server Function Template
```typescript
// Template for new server functions
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { checkPermission } from '@/lib/utils/permissions'
import { db } from '@/lib/db/db'
import { AppError } from '@/lib/utils/errors'

// 1. Define validation schema
const actionSchema = z.object({
  field1: z.string().min(1),
  field2: z.string().optional(),
})

// 2. Create server function with proper structure
export const performAction = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware]) // 3. Add middleware chain
  .validator((data: unknown) => actionSchema.parse(data)) // 4. Add validation
  .handler(async ({ data, context }) => { // 5. Implement handler
    const { user, organizationId } = context

    // 6. Check permissions
    await checkPermission('resource', ['action'], organizationId)

    // 7. Validate ownership (for updates/deletes)
    if (data.id) {
      const existing = await db
        .select()
        .from(table)
        .where(and(eq(table.id, data.id), eq(table.organizationId, organizationId)))
        .limit(1)

      if (!existing[0]) {
        throw AppError.notFound('Resource')
      }
    }

    // 8. Perform operation with organization scoping
    const result = await db
      .insert(table)
      .values({
        ...data,
        organizationId,
        createdBy: user.id,
      })
      .returning()

    return result[0]
  })
```

### 2. API Route Template
```typescript
// Template for file-based API routes
import { createServerFileRoute } from '@tanstack/react-start/server'

import { auth } from '@/lib/auth/auth'

export const ServerRoute = createServerFileRoute('/api/resource').methods({
  GET: async ({ request, params }) => {
    try {
      // Authentication if needed
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session?.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Implementation
      const data = await fetchData()

      return Response.json({ data })
    } catch (error) {
      return Response.json(
        {
          error: error instanceof Error ? error.message : 'Internal server error',
        },
        { status: 500 }
      )
    }
  },

  POST: async ({ request, params }) => {
    try {
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session?.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const body = await request.json()
      
      // Validate input
      const validatedData = schema.parse(body)

      // Process request
      const result = await processData(validatedData)

      return Response.json({ success: true, data: result })
    } catch (error) {
      return Response.json(
        {
          error: error instanceof Error ? error.message : 'Internal server error',
        },
        { status: 500 }
      )
    }
  },
})
```

## 🎯 Integration Requirements

### With TanStack Query
```typescript
// Client-side integration with server functions
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTodo, getTodoById, updateTodo } from '@/features/todos/lib/todos.server'

function useTodo(id: string) {
  return useQuery({
    queryKey: ['todos', id],
    queryFn: () => getTodoById({ data: { id } }),
  })
}

function useCreateTodo() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createTodo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
    onError: (error) => {
      // Handle error with proper user feedback
      console.error('Failed to create todo:', error)
    },
  })
}

function useUpdateTodo() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: updateTodo,
    onSuccess: (updatedTodo) => {
      // Optimistic update
      queryClient.setQueryData(['todos'], (old: any) => 
        old?.map((todo: any) => 
          todo.id === updatedTodo.id ? updatedTodo : todo
        ) || []
      )
    },
  })
}
```

### With Error Handling System
```typescript
// Consistent error handling across server functions
import { AppError, ValidationError } from '@/lib/utils/errors'
import { ERROR_CODES } from '@/lib/errors/codes'
import errorTranslations from '@/i18n/locales/en/errors.json'

// In server functions
try {
  const result = await performOperation()
  return result
} catch (error) {
  // Handle known error types
  if (error instanceof ValidationError) {
    throw error // Let validation errors bubble up
  }
  
  if (error instanceof AppError) {
    throw error // Re-throw app errors
  }
  
  // Handle database constraint errors
  if ((error as any).code === '23505') { // Unique constraint violation
    throw new AppError(
      ERROR_CODES.BIZ_DUPLICATE_ENTRY,
      409,
      { field: 'email' },
      errorTranslations.server.duplicateEntry
    )
  }
  
  // Wrap unknown errors
  throw new AppError(
    ERROR_CODES.SYS_SERVER_ERROR,
    500,
    undefined,
    error instanceof Error ? error.message : 'Unknown error'
  )
}
```

### With Request Context
```typescript
// Accessing request context in server functions
export const contextAwareAction = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    // Available context from middleware chain
    const {
      user,           // From auth middleware
      session,        // From auth middleware  
      organizationId, // From organization middleware
      headers,        // Request headers for Better Auth API calls
    } = context

    // Use context for operations
    await auth.api.someOperation({
      headers: context.headers, // Pass through for session validation
      body: { /* data */ },
    })
  })
```

## 📊 Server-Side Table Sorting

When implementing tables with `manualSorting: true`, the server must handle sorting logic. This requires proper column mapping and query building.

### Column Mapping for Sorting

Create a columnMap that maps frontend column IDs to database columns. **IMPORTANT**: Only include columns that should be sortable.

```typescript
// In your server function (e.g., getBookingsTable)
const orderBy =
  sorting.length > 0
    ? sorting
        .map((sort: { id: string; desc?: boolean }) => {
          const columnMap: Record<string, PgColumn> = {
            // Map column IDs to database columns
            bookingDate: bookings.bookingDate,
            customerName: bookings.customerName,
            status: bookings.status,
            duration: bookings.duration,
            price: bookings.price,
            // Note: Non-sortable columns like 'phone' are NOT included
            
            // Handle joined columns specially
            serviceName: services.name, // From joined table
          }
          
          const column = columnMap[sort.id]
          return column ? (sort.desc ? desc(column) : asc(column)) : null
        })
        .filter(Boolean)
    : [desc(bookings.createdAt)] // Default sort
```

### Complete Server-Side Sorting Example

```typescript
export const getTableData = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, organizationMiddleware])
  .validator(validateServerQueryParams)
  .handler(async ({ data, context }) => {
    const { organizationId } = context
    const { search, filters, sorting, pagination } = data
    
    // Build where conditions
    const conditions: SQL[] = [eq(table.organizationId, organizationId)]
    
    // ... add search and filter conditions ...
    
    // Build order by - ONLY sortable columns
    const orderBy =
      sorting.length > 0
        ? sorting.map((sort) => {
            const columnMap: Record<string, PgColumn> = {
              name: table.name,
              createdAt: table.createdAt,
              status: table.status,
              // phone: table.phone, // Excluded - not sortable
            }
            
            const column = columnMap[sort.id]
            return column ? (sort.desc ? desc(column) : asc(column)) : null
          }).filter(Boolean)
        : [desc(table.createdAt)]
    
    // Execute query with sorting
    const results = await db
      .select()
      .from(table)
      .where(and(...conditions))
      .orderBy(...(Array.isArray(orderBy) ? orderBy : [orderBy]))
      .limit(pagination.pageSize)
      .offset(pagination.pageIndex * pagination.pageSize)
    
    return { data: results, totalCount }
  })
```

### Key Points for Server-Side Sorting

1. **Column Map Requirements**:
   - Include ONLY columns that have `enableSorting: true` in the frontend
   - Map column IDs exactly as defined in the frontend ColumnDef
   - Handle joined columns by mapping to the actual joined table column

2. **Frontend-Backend Coordination**:
   - Frontend column must have `enableSorting: true`
   - Frontend column must use `DataTableHeader` with `sortable` prop
   - Backend columnMap must include the column

3. **Common Issues**:
   - Sorting not working → Column missing from server columnMap
   - Error on sort → Column ID mismatch between frontend and backend
   - Joined data not sorting → Need to map to joined table column (e.g., `services.name`)

## 🧪 Testing Requirements

### Server Function Testing
```typescript
// Testing server functions
import { describe, it, expect, vi } from 'vitest'
import { createTodo } from './todos.server'

// Mock middleware and dependencies
vi.mock('@/features/organization/lib/organization-middleware', () => ({
  organizationMiddleware: vi.fn(),
}))

vi.mock('@/lib/db/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: '1', title: 'Test Todo' }]),
      }),
    }),
  },
}))

describe('createTodo', () => {
  it('should create todo with proper organization scoping', async () => {
    const mockContext = {
      user: { id: 'user1' },
      organizationId: 'org1',
    }

    const todoData = {
      title: 'Test Todo',
      description: 'Test Description',
    }

    const result = await createTodo.handler({ data: todoData, context: mockContext })

    expect(result).toBeDefined()
    expect(result.title).toBe('Test Todo')
    expect(db.insert).toHaveBeenCalledWith(todos)
  })

  it('should validate input data', async () => {
    const invalidData = { title: '' } // Empty title should fail

    await expect(createTodo.validator(invalidData)).rejects.toThrow('VAL_REQUIRED_FIELD')
  })
})
```

### API Route Testing
```typescript
// Testing API routes
import { describe, it, expect, vi } from 'vitest'

describe('/api/health', () => {
  it('should return healthy status when services are available', async () => {
    // Mock successful database and redis connections
    vi.mocked(db.execute).mockResolvedValue(undefined)
    vi.mocked(redis.ping).mockResolvedValue('PONG')

    const request = new Request('http://localhost:3000/api/health')
    const response = await ServerRoute.GET({ request })

    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.status).toBe('healthy')
    expect(data.services.database).toBe('connected')
  })

  it('should return unhealthy status when services fail', async () => {
    vi.mocked(db.execute).mockRejectedValue(new Error('Connection failed'))

    const request = new Request('http://localhost:3000/api/health')
    const response = await ServerRoute.GET({ request })

    const data = await response.json()
    expect(response.status).toBe(500)
    expect(data.status).toBe('unhealthy')
  })
})
```

## 📋 Implementation Checklist

Before considering server function implementation complete, verify:

- [ ] **Method Specification**: All server functions specify HTTP method
- [ ] **Middleware Chain**: Proper middleware order (auth → organization)
- [ ] **Input Validation**: Zod schemas for all inputs
- [ ] **Permission Checks**: Proper permission verification
- [ ] **Organization Scoping**: All user data includes organizationId
- [ ] **Error Handling**: Consistent error types and messages
- [ ] **Context Usage**: Proper use of request context
- [ ] **Response Format**: Consistent response structure
- [ ] **Security**: No sensitive data leakage
- [ ] **Performance**: Efficient database queries

## 🚀 Advanced Patterns

### Batch Operations
```typescript
// Batch operations with transaction support
export const bulkCreateTodos = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator(z.array(createTodoSchema).max(100))
  .handler(async ({ data, context }) => {
    const { user, organizationId } = context

    await checkPermission('todos', ['create'], organizationId)

    return await db.transaction(async (tx) => {
      const results = []
      
      for (const todoData of data) {
        const result = await tx
          .insert(todos)
          .values({
            id: nanoid(),
            ...todoData,
            organizationId,
            createdBy: user.id,
          })
          .returning()
        
        results.push(result[0])
      }
      
      return results
    })
  })
```

### Streaming Responses
```typescript
// Streaming data for large datasets
export const ServerRoute = createServerFileRoute('/api/export/todos').methods({
  GET: async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const stream = new ReadableStream({
      start(controller) {
        // Stream todo data in chunks
        db.select()
          .from(todos)
          .where(eq(todos.organizationId, organizationId))
          .then(async (todos) => {
            for (const todo of todos) {
              controller.enqueue(
                new TextEncoder().encode(JSON.stringify(todo) + '\n')
              )
            }
            controller.close()
          })
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked',
      },
    })
  },
})
```

### WebSocket Integration
```typescript
// Real-time updates with WebSocket patterns
export const ServerRoute = createServerFileRoute('/api/ws/todos').methods({
  GET: async ({ request }) => {
    const upgrade = request.headers.get('upgrade')
    if (upgrade !== 'websocket') {
      return new Response('Expected websocket', { status: 426 })
    }

    // Authenticate WebSocket connection
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Handle WebSocket upgrade
    // Implementation depends on your WebSocket setup
  },
})
```

### Undo Operations Pattern

```typescript
// Undo/restore pattern for user-friendly delete operations
import { createServerFn } from '@tanstack/react-start'
import { eq, and, isNull, isNotNull } from 'drizzle-orm'
import { z } from 'zod'

import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { checkPermission } from '@/lib/utils/permissions'
import { db } from '@/lib/db/db'
import { todos } from '@/database/schema'
import { AppError } from '@/lib/utils/errors'

const todoIdSchema = z.object({
  id: z.string(),
})

// Delete operation with undo capability
export const deleteTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    
    await checkPermission('todos', ['delete'], orgId)

    // CRITICAL: Verify ownership before deletion
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

// Undo delete operation - restore deleted record
export const undoDeleteTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    
    // Use 'create' permission since we're restoring data
    await checkPermission('todos', ['create'], orgId)

    // CRITICAL: Verify record is soft-deleted and owned by organization
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

    return {
      ...restored[0],
      // Transform data for client if needed
      priority: numberToPriority(restored[0].priority),
    }
  })
```

### Client-Side Integration with Undo

```typescript
// Client integration with enhanced user experience
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteTodo, undoDeleteTodo } from '@/features/todos/lib/todos.server'
import { useErrorHandler } from '@/lib/errors/hooks'

function useDeleteTodoWithUndo() {
  const queryClient = useQueryClient()
  const { showError, showSuccess } = useErrorHandler()
  
  const deleteMutation = useMutation({
    mutationFn: deleteTodo,
    onSuccess: (result, variables) => {
      // Optimistically remove from cache
      queryClient.setQueryData(['todos'], (old: any[]) => 
        old?.filter(todo => todo.id !== variables.data.id) || []
      )

      // Show success toast with undo action
      showSuccess('Todo deleted', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              const restored = await undoDeleteTodo({ data: { id: variables.data.id } })
              
              // Restore to cache
              queryClient.setQueryData(['todos'], (old: any[]) => {
                const updated = old ? [...old] : []
                updated.push(restored)
                return updated.sort((a, b) => 
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                )
              })
              
              showSuccess('Todo restored')
            } catch (error) {
              // Handle undo failure
              showError(error)
              // Refresh data to ensure consistency
              queryClient.invalidateQueries({ queryKey: ['todos'] })
            }
          }
        }
      })
    },
    onError: (error) => {
      showError(error)
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    }
  })

  return {
    deleteTodo: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  }
}
```

### Advanced Undo Patterns

```typescript
// Bulk operations with undo support
export const bulkDeleteTodos = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator(z.object({ ids: z.array(z.string()).min(1).max(100) }))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    
    await checkPermission('todos', ['delete'], orgId)

    // Get todos that will be deleted for undo information
    const todosToDelete = await db
      .select()
      .from(todos)
      .where(and(
        inArray(todos.id, data.ids),
        eq(todos.organizationId, orgId),
        isNull(todos.deletedAt)
      ))

    if (todosToDelete.length === 0) {
      throw new AppError('BIZ_NO_RECORDS_FOUND', 404, undefined, 'No todos found to delete')
    }

    // Bulk soft delete
    await db
      .update(todos)
      .set({ 
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        inArray(todos.id, data.ids),
        eq(todos.organizationId, orgId),
        isNull(todos.deletedAt)
      ))

    return { 
      success: true, 
      deletedCount: todosToDelete.length,
      canUndo: true,
      deletedIds: todosToDelete.map(t => t.id)
    }
  })

// Bulk undo operation
export const undoBulkDeleteTodos = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator(z.object({ ids: z.array(z.string()).min(1).max(100) }))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    
    await checkPermission('todos', ['create'], orgId)

    // Restore multiple records
    const restored = await db
      .update(todos)
      .set({ 
        deletedAt: null,
        updatedAt: new Date()
      })
      .where(and(
        inArray(todos.id, data.ids),
        eq(todos.organizationId, orgId),
        isNotNull(todos.deletedAt)
      ))
      .returning()

    return {
      success: true,
      restoredCount: restored.length,
      restored: restored.map(todo => ({
        ...todo,
        priority: numberToPriority(todo.priority),
      }))
    }
  })
```

### Error Handling for Undo Operations

```typescript
// Comprehensive error handling for undo scenarios
export const undoDeleteTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    
    try {
      await checkPermission('todos', ['create'], orgId)

      const deletedTodo = await db
        .select()
        .from(todos)
        .where(and(
          eq(todos.id, data.id),
          eq(todos.organizationId, orgId),
          isNotNull(todos.deletedAt)
        ))
        .limit(1)

      if (!deletedTodo[0]) {
        throw new AppError(
          'BIZ_UNDO_NOT_AVAILABLE',
          400,
          { todoId: data.id },
          'This item is no longer available for undo',
          [{ action: 'refresh', label: 'Refresh List' }]
        )
      }

      // Check if item was deleted too long ago (e.g., 24 hours)
      const deletedAt = new Date(deletedTodo[0].deletedAt!)
      const now = new Date()
      const hoursSinceDeleted = (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60)
      
      if (hoursSinceDeleted > 24) {
        throw new AppError(
          'BIZ_UNDO_EXPIRED',
          400,
          { hoursSinceDeleted: Math.round(hoursSinceDeleted) },
          'Undo is only available for 24 hours after deletion',
          [{ action: 'create', label: 'Create New' }]
        )
      }

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

      return {
        ...restored[0],
        priority: numberToPriority(restored[0].priority),
      }
    } catch (error) {
      // Handle specific error types
      if (error instanceof AppError) {
        throw error
      }
      
      // Handle database constraint errors
      if ((error as any).code === '23505') { // Unique constraint
        throw new AppError(
          'BIZ_DUPLICATE_ENTRY',
          409,
          { field: 'title' },
          'A todo with this title already exists'
        )
      }

      // Wrap unknown errors
      throw new AppError(
        'SYS_UNDO_FAILED',
        500,
        undefined,
        'Failed to restore item. Please try refreshing the page.'
      )
    }
  })
```

### Integration with Optimistic Updates

```typescript
// Advanced client-side patterns with optimistic updates
function useOptimisticDelete() {
  const queryClient = useQueryClient()
  const { showError, showSuccess } = useErrorHandler()
  
  return useMutation({
    mutationFn: deleteTodo,
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['todos'] })
      
      // Snapshot previous value
      const previousTodos = queryClient.getQueryData(['todos'])
      
      // Optimistically remove todo
      queryClient.setQueryData(['todos'], (old: any[]) => 
        old?.filter(todo => todo.id !== variables.data.id) || []
      )
      
      return { previousTodos }
    },
    onSuccess: (result, variables, context) => {
      // Show success with undo - don't refetch yet
      showSuccess('Todo deleted', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              const restored = await undoDeleteTodo({ data: { id: variables.data.id } })
              
              queryClient.setQueryData(['todos'], (old: any[]) => {
                const todos = old || []
                todos.push(restored)
                return todos.sort((a, b) => 
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                )
              })
              
              showSuccess('Todo restored')
            } catch (error) {
              showError(error)
              queryClient.invalidateQueries({ queryKey: ['todos'] })
            }
          }
        }
      })
    },
    onError: (error, variables, context) => {
      // Revert optimistic update
      if (context?.previousTodos) {
        queryClient.setQueryData(['todos'], context.previousTodos)
      }
      showError(error)
    }
  })
}
```

This server function architecture provides a robust foundation for building type-safe, secure, and scalable API endpoints with comprehensive error handling, undo functionality, and proper integration with the authentication and multi-tenancy systems.