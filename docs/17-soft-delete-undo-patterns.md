# Soft Delete & Undo Functionality Implementation Guide

This document provides comprehensive guidance for implementing soft delete patterns with undo functionality, creating user-friendly data management experiences while maintaining data integrity and recovery capabilities.

## 🚨 Critical Rules

- **ALWAYS use soft delete for irreplaceable user-created content** - Enables data recovery and undo functionality
- **MUST filter soft-deleted records in all queries** - Prevent deleted data from appearing in normal operations
- **ALWAYS verify permissions for undo operations** - Use 'create' permissions when restoring data
- **MUST provide time-limited undo windows** - Implement reasonable time constraints for undo operations
- **ALWAYS handle undo failures gracefully** - Provide fallback options when undo operations fail

## ❌ Common AI Agent Mistakes

### Missing Soft Delete Filtering
```typescript
// ❌ NEVER forget to filter out soft-deleted records
export const getTodoById = async (id: string, orgId: string) => {
  return await db
    .select()
    .from(todos)
    .where(and(
      eq(todos.id, id),
      eq(todos.organizationId, orgId) // Missing deletedAt filter!
    ))
    .limit(1)
}

// ✅ ALWAYS filter soft-deleted records
export const getTodoById = async (id: string, orgId: string) => {
  const result = await db
    .select()
    .from(todos)
    .where(and(
      eq(todos.id, id),
      eq(todos.organizationId, orgId),
      isNull(todos.deletedAt) // CRITICAL: Exclude soft-deleted
    ))
    .limit(1)
  
  if (!result[0]) {
    throw AppError.notFound('Todo')
  }
  return result[0]
}
```

### Hard Delete Instead of Soft Delete
```typescript
// ❌ NEVER use hard delete for user-created content with unique data
await db.delete(todos).where(eq(todos.id, todoId)) // Unique content lost forever!

// ✅ ALWAYS use soft delete for recoverable operations
await db
  .update(todos)
  .set({ 
    deletedAt: new Date(),
    updatedAt: new Date()
  })
  .where(eq(todos.id, todoId))
```

### Missing Undo Validation
```typescript
// ❌ NEVER skip validation for undo operations
export const undoDelete = async (id: string) => {
  // Missing organization check and deleted state validation
  await db.update(todos).set({ deletedAt: null }).where(eq(todos.id, id))
}

// ✅ ALWAYS validate undo operations thoroughly
export const undoDelete = async (id: string, orgId: string) => {
  const deletedTodo = await db
    .select()
    .from(todos)
    .where(and(
      eq(todos.id, id),
      eq(todos.organizationId, orgId),
      isNotNull(todos.deletedAt) // Only restore deleted records
    ))
    .limit(1)

  if (!deletedTodo[0]) {
    throw AppError.notFound('Deleted Todo')
  }

  return await db
    .update(todos)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(and(eq(todos.id, id), eq(todos.organizationId, orgId)))
    .returning()
}
```

## ✅ Complete Implementation Pattern

### 1. **Database Schema with Soft Delete Support**

```typescript
// File: src/database/schema.ts - Schema with soft delete field
export const todos = pgTable('todos', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  title: text('title').notNull(),
  description: text('description'),
  
  // Organization scoping (required for multi-tenancy)
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  
  // User relationships
  createdBy: text('created_by')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  assignedTo: text('assigned_to')
    .references(() => user.id, { onDelete: 'set null' }),
  
  // Business fields
  completed: boolean('completed').default(false).notNull(),
  priority: integer('priority').default(3).notNull(),
  dueDate: timestamp('due_date'),
  
  // Soft delete support
  deletedAt: timestamp('deleted_at'), // NULL = active, timestamp = deleted
  
  // Audit timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Essential indexes for performance
CREATE INDEX CONCURRENTLY idx_todos_active_org 
ON todos (organization_id, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY idx_todos_deleted_org 
ON todos (organization_id, deleted_at) 
WHERE deleted_at IS NOT NULL;
```

### 2. **Server Functions with Soft Delete**

```typescript
// File: src/features/todos/lib/todos.server.ts - Complete server implementation
import { createServerFn } from '@tanstack/react-start'
import { eq, and, desc, isNull, isNotNull } from 'drizzle-orm'
import { z } from 'zod'

import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { checkPermission } from '@/lib/utils/permissions'
import { db } from '@/lib/db/db'
import { todos } from '@/database/schema'
import { AppError } from '@/lib/utils/errors'
import { ERROR_CODES } from '@/lib/errors/codes'

const todoIdSchema = z.object({
  id: z.string(),
})

// GET - Always filter out soft-deleted records when fetching by ID
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

    // Transform data for client
    return {
      ...todo[0],
      priority: numberToPriority(todo[0].priority),
    }
  })

// DELETE - Soft delete with undo capability
export const deleteTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    
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

    return { 
      success: true, 
      canUndo: true,
      undoTimeLimit: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    }
  })

// UNDO - Restore soft-deleted record
export const undoDeleteTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    
    // Use 'create' permission since we're restoring data
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
      throw new AppError(
        ERROR_CODES.BIZ_UNDO_NOT_AVAILABLE,
        400,
        { todoId: data.id },
        'This item is no longer available for undo'
      )
    }

    // Check time limit (24 hours)
    const deletedAt = new Date(deletedTodo[0].deletedAt!)
    const now = new Date()
    const hoursSinceDeleted = (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceDeleted > 24) {
      throw new AppError(
        ERROR_CODES.BIZ_UNDO_EXPIRED,
        400,
        { hoursSinceDeleted: Math.round(hoursSinceDeleted) },
        'Undo is only available for 24 hours after deletion'
      )
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
      priority: numberToPriority(restored[0].priority),
    }
  })
```

### 3. **Enhanced Toast System with Action Buttons**

```typescript
// File: src/lib/errors/hooks.ts - Enhanced success toast with actions
import { useCallback } from 'react'
import { toast } from 'sonner'

import { useTranslation } from '@/i18n/hooks/useTranslation'

export function useErrorHandler() {
  const { t } = useTranslation('errors')

  const showSuccess = useCallback(
    (message: string, options?: { action?: { label: string; onClick: () => void } }) => {
      const translatedMessage = message.includes('.') ? t(message) : message
      
      if (options?.action) {
        toast.success(translatedMessage, {
          action: {
            label: options.action.label,
            onClick: options.action.onClick,
          },
          duration: 10000, // Extended duration for undo actions
          position: 'bottom-right',
        })
      } else {
        toast.success(translatedMessage, {
          duration: 4000, // Standard duration
        })
      }
    },
    [t]
  )

  return { showError, showSuccess }
}
```

### 4. **Client-Side Integration with React Query**

```typescript
// File: src/features/todos/components/todos-table-page.tsx - Client integration
import React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteTodo, undoDeleteTodo } from '../lib/todos.server'
import { useErrorHandler } from '@/lib/errors/hooks'
import { useTranslation } from '@/i18n/hooks/useTranslation'

export function TodosTablePage() {
  const queryClient = useQueryClient()
  const { showError, showSuccess } = useErrorHandler()
  const { t } = useTranslation('common')

  const handleDelete = React.useCallback(
    async (id: string) => {
      try {
        const result = await deleteTodo({ data: { id } })
        
        // Optimistically remove from cache
        queryClient.setQueryData(['todos'], (old: any[]) => 
          old?.filter(todo => todo.id !== id) || []
        )
        
        // Show success toast with undo action
        showSuccess(t('messages.deleted'), {
          action: {
            label: t('actions.undo'),
            onClick: async () => {
              try {
                const restored = await undoDeleteTodo({ data: { id } })
                
                // Restore to cache
                queryClient.setQueryData(['todos'], (old: any[]) => {
                  const updated = old ? [...old] : []
                  updated.push(restored)
                  return updated.sort((a, b) => 
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  )
                })
                
                showSuccess(t('messages.restored'))
              } catch (error) {
                showError(error)
                // Refresh on undo failure to ensure consistency
                queryClient.invalidateQueries({ queryKey: ['todos'] })
              }
            }
          }
        })
      } catch (error) {
        showError(error)
        // Revert optimistic update on error
        queryClient.invalidateQueries({ queryKey: ['todos'] })
      }
    },
    [showSuccess, showError, t, queryClient]
  )

  return (
    // Component implementation with delete handlers
    <div>
      {/* Table with delete buttons that call handleDelete */}
    </div>
  )
}
```

## 🔧 Advanced Implementation Patterns

### Bulk Operations with Undo

```typescript
// Bulk delete with collective undo
export const bulkDeleteTodos = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator(z.object({ ids: z.array(z.string()).min(1).max(100) }))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    
    await checkPermission('todos', ['delete'], orgId)

    // Get todos that will be deleted (for undo information)
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
      deletedIds: todosToDelete.map(t => t.id),
      undoTimeLimit: 24 * 60 * 60 * 1000
    }
  })

// Bulk undo operation
export const undoBulkDeleteTodos = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator(z.object({ ids: z.array(z.string()).min(1).max(100) }))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    
    await checkPermission('todos', ['create'], orgId)

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
      restored: restored
    }
  })
```

### Cleanup Job for Old Soft-Deleted Records

```typescript
// Scheduled cleanup job for old soft-deleted records
export const cleanupOldDeletedTodos = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const orgId = context.organizationId
    
    await checkPermission('todos', ['delete'], orgId)

    // Hard delete records soft-deleted more than 30 days ago
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const deleted = await db
      .delete(todos)
      .where(and(
        eq(todos.organizationId, orgId),
        isNotNull(todos.deletedAt),
        lt(todos.deletedAt, thirtyDaysAgo)
      ))
      .returning({ id: todos.id })

    return { 
      success: true, 
      permanentlyDeleted: deleted.length,
      cleanupDate: thirtyDaysAgo.toISOString()
    }
  })

// Admin endpoint to list soft-deleted records
export const getDeletedTodos = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const orgId = context.organizationId
    
    await checkPermission('todos', ['read'], orgId)

    const deletedTodos = await db
      .select()
      .from(todos)
      .where(and(
        eq(todos.organizationId, orgId),
        isNotNull(todos.deletedAt)
      ))
      .orderBy(desc(todos.deletedAt))

    return deletedTodos.map(todo => ({
      ...todo,
      priority: numberToPriority(todo.priority),
      canRestore: (new Date().getTime() - new Date(todo.deletedAt!).getTime()) < (24 * 60 * 60 * 1000)
    }))
  })
```

## 🧪 Testing Soft Delete Implementation

### Unit Tests for Soft Delete Logic

```typescript
// File: src/features/todos/lib/__tests__/todos.server.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '@/lib/db/db'
import { todos } from '@/database/schema'
import { deleteTodo, undoDeleteTodo, getTodoById } from '../todos.server'

describe('Soft Delete Implementation', () => {
  let testTodo: any
  let testOrgId = 'test-org-1'
  let testUserId = 'test-user-1'

  beforeEach(async () => {
    // Create test todo
    const [created] = await db
      .insert(todos)
      .values({
        id: 'test-todo-1',
        title: 'Test Todo',
        organizationId: testOrgId,
        createdBy: testUserId,
      })
      .returning()
    
    testTodo = created
  })

  afterEach(async () => {
    // Cleanup
    await db.delete(todos).where(eq(todos.id, testTodo.id))
  })

  it('should soft delete records without removing from database', async () => {
    // Delete the todo
    await deleteTodo.handler({ 
      data: { id: testTodo.id }, 
      context: { organizationId: testOrgId } 
    })
    
    // Record should still exist in database
    const directQuery = await db
      .select()
      .from(todos)
      .where(eq(todos.id, testTodo.id))
    
    expect(directQuery[0]).toBeDefined()
    expect(directQuery[0].deletedAt).not.toBeNull()
    
    // But should not appear in normal queries
    await expect(
      getTodoById.handler({
        data: { id: testTodo.id },
        context: { organizationId: testOrgId }
      })
    ).rejects.toThrow(AppError.notFound('Todo'))
  })

  it('should restore soft deleted records', async () => {
    // Delete then restore
    await deleteTodo.handler({ 
      data: { id: testTodo.id }, 
      context: { organizationId: testOrgId } 
    })
    
    const restored = await undoDeleteTodo.handler({
      data: { id: testTodo.id },
      context: { organizationId: testOrgId }
    })
    
    expect(restored.deletedAt).toBeNull()
    
    // Should appear in normal queries again
    const activeTodo = await getTodoById.handler({
      data: { id: testTodo.id },
      context: { organizationId: testOrgId }
    })
    expect(activeTodo.id).toBe(testTodo.id)
  })

  it('should prevent undo after time limit', async () => {
    // Create a todo with old deletion timestamp
    await db
      .update(todos)
      .set({ 
        deletedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        updatedAt: new Date()
      })
      .where(eq(todos.id, testTodo.id))

    await expect(
      undoDeleteTodo.handler({
        data: { id: testTodo.id },
        context: { organizationId: testOrgId }
      })
    ).rejects.toThrow('Undo is only available for 24 hours')
  })
})
```

### Integration Tests for Client Components

```typescript
// File: src/features/todos/components/__tests__/todos-table.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import { TodosTablePage } from '../todos-table-page'
import * as todosServer from '../../lib/todos.server'

// Mock server functions
vi.mock('../../lib/todos.server', () => ({
  deleteTodo: vi.fn(),
  undoDeleteTodo: vi.fn(),
  getTodoById: vi.fn(),
}))

describe('Todos Table with Undo', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
  })

  it('should show success toast with undo button after delete', async () => {
    vi.mocked(todosServer.deleteTodo).mockResolvedValue({ 
      success: true, 
      canUndo: true 
    })

    render(
      <QueryClientProvider client={queryClient}>
        <TodosTablePage />
      </QueryClientProvider>
    )

    // Click delete button
    const deleteButton = screen.getByRole('button', { name: /delete/i })
    fireEvent.click(deleteButton)

    // Should show success toast
    await waitFor(() => {
      expect(screen.getByText('Todo deleted successfully')).toBeInTheDocument()
    })

    // Should show undo button
    const undoButton = screen.getByRole('button', { name: /undo/i })
    expect(undoButton).toBeInTheDocument()
  })

  it('should restore todo when undo button is clicked', async () => {
    const mockRestored = { id: 'test-1', title: 'Restored Todo' }
    
    vi.mocked(todosServer.deleteTodo).mockResolvedValue({ 
      success: true, 
      canUndo: true 
    })
    vi.mocked(todosServer.undoDeleteTodo).mockResolvedValue(mockRestored)

    render(
      <QueryClientProvider client={queryClient}>
        <TodosTablePage />
      </QueryClientProvider>
    )

    // Delete todo
    const deleteButton = screen.getByRole('button', { name: /delete/i })
    fireEvent.click(deleteButton)

    // Click undo
    await waitFor(() => {
      const undoButton = screen.getByRole('button', { name: /undo/i })
      fireEvent.click(undoButton)
    })

    // Should call undo function
    expect(todosServer.undoDeleteTodo).toHaveBeenCalledWith({
      data: { id: expect.any(String) }
    })

    // Should show restoration success
    await waitFor(() => {
      expect(screen.getByText('Todo restored successfully')).toBeInTheDocument()
    })
  })
})
```

## 🎯 Best Practices Summary

### ✅ **Do:**

1. **Use soft delete for user-generated content** - Enables recovery and better UX
2. **Filter deleted records in all queries** - Prevent accidental exposure
3. **Implement time-limited undo windows** - Balance UX with storage concerns
4. **Show clear action buttons in toasts** - Make undo discoverable
5. **Handle undo failures gracefully** - Provide fallback options
6. **Test soft delete behavior thoroughly** - Ensure data integrity
7. **Create indexes for performance** - Optimize queries with WHERE deleted_at IS NULL
8. **Implement cleanup jobs** - Remove old soft-deleted data
9. **Check permissions for restore operations** - Use create permissions for undo
10. **Provide bulk undo capabilities** - Handle mass operations efficiently

### ❌ **Don't:**

1. **Use hard delete for recoverable data** - Data loss is permanent
2. **Forget to filter deleted records** - Can expose deleted data
3. **Skip organization scoping** - Security vulnerability
4. **Make undo windows too long** - Storage and performance impact
5. **Show undo for non-recoverable operations** - Misleading to users
6. **Ignore time limits on undo** - Can cause data inconsistencies
7. **Skip error handling for undo failures** - Poor user experience
8. **Forget to update timestamps** - Breaks audit trails
9. **Use soft delete for sensitive data** - GDPR compliance issues
10. **Overwhelm users with too many undo options** - Decision fatigue

## 🎯 **Content vs Relationship Table Decision Matrix**

| Table Type | Example | Contains | Recovery Method | Pattern |
|------------|---------|----------|----------------|---------|
| **Content** | `todos` | Title, description, due dates, priority | Cannot recreate → Soft delete | ✅ Use `deletedAt` |
| **Content** | `posts` | Article text, media, user writing | Cannot recreate → Soft delete | ✅ Use `deletedAt` |
| **Content** | `documents` | File content, annotations, versions | Cannot recreate → Soft delete | ✅ Use `deletedAt` |
| **Relationship** | `member` | userId + orgId + role | Re-add member → Same outcome | ✅ Hard delete OK |
| **Relationship** | `invitation` | email + role | Re-invite → Same outcome | ✅ Hard delete OK |
| **System** | `session` | Temporary tokens | User re-login → New session | ✅ Hard delete OK |

### **Decision Question**
**"If we delete this row, is unique user-created content lost forever that cannot be easily recreated with the same outcome?"**
- **Yes** → Soft delete with undo capability required
- **No** → Hard delete is appropriate and efficient

This implementation provides a comprehensive foundation for soft delete patterns with undo functionality, creating a user-friendly data management experience while maintaining data integrity, security, and correct architectural decisions between content and relationship data.