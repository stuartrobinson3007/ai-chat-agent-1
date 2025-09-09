# Soft Delete Pattern Compliance Audit Routine

This document provides a systematic quality assurance routine for AI agents to validate soft delete implementation patterns, undo functionality compliance, and data recovery capabilities in the TanStack SaaS starter template.

## 🎯 **Purpose**

This routine ensures that all delete operations on user-generated content follow soft delete best practices, implement proper undo functionality, maintain data recoverability, and prevent accidental hard delete usage that could cause permanent loss of irreplaceable user-created content.

## 🎯 **Soft Delete Decision Framework**

### **When to Use Soft Delete:**
**Use soft delete when deleting the row means losing irreplaceable user-created content**

✅ **Content Tables (Require Soft Delete):**
- `todos` - Contains title, description, due dates, priority (unique user content)
- `posts` - Contains article content, media, user writing
- `documents` - Contains file content, annotations, versions  
- `projects` - Contains project details, settings, custom configurations
- `messages` - Contains user communications, conversation history
- `comments` - Contains user-written commentary and discussions

❌ **Relationship/System Tables (Hard Delete Appropriate):**
- `member` - Just a relationship (userId + organizationId + role) - user still exists, just re-add with same outcome
- `invitation` - Temporary metadata (email + role) - just send another invite with same effect
- `session` - Temporary auth tokens - user can log in again
- `account` - OAuth provider links - can re-authenticate  
- `verification` - Temporary codes - can generate new ones
- `organization` - Complex business entity, deletion is intentional business decision

### **The Core Principle**
**Ask: "If we delete this row, is unique user-created content lost forever that cannot be easily recreated with the same outcome?"**
- **Yes** → Use soft delete with undo capability
- **No** → Hard delete is appropriate (relationship/metadata can be recreated)

## 📋 **Pre-Audit Checklist**

Before beginning the audit, ensure:
- [ ] Soft delete documentation (`17-soft-delete-undo-patterns.md`) is current
- [ ] Understanding of content vs relationship table distinction
- [ ] Access to all database operations and client components with delete functionality

## 🔍 **Phase 1: Hard Delete Anti-Pattern Detection**

### **1.1 Find Dangerous Hard Delete Operations**

Run these commands to discover hard delete usage:

```bash
# Find all hard delete operations on user-content tables (not relationship tables)
rg "db\.delete\((todos|projects|posts|comments|messages|documents)" --type ts src/

# Should return ZERO results - user content should use soft delete
# NOTE: member/invitation hard deletes are APPROPRIATE (relationship tables)

# Find hard delete in bulk operations
rg "bulkDelete.*db\.delete|massDelete.*db\.delete" --type ts src/

# Should review each for appropriateness - most should use soft delete

# Find DELETE SQL statements in migrations
rg "DELETE FROM.*user_data|DELETE FROM.*todos|DELETE FROM.*members" --type sql

# Should be rare - most deletes should be soft delete pattern
```

### **1.2 Find Tables Missing Soft Delete Support**

#### **❌ CRITICAL: Find user-content tables without deletedAt field**
```bash
# Check user-content tables for deletedAt field (excludes relationship tables)
rg "export const (todos|projects|posts|comments|messages|documents).*=.*pgTable" -A 20 --type ts src/database/schema.ts | rg -v "deletedAt.*timestamp"

# User content tables should include deletedAt field

# Find content tables missing soft delete support by looking for user-created content indicators
rg "title.*text.*notNull|content.*text|description.*text" -B 10 -A 5 --type ts src/database/schema.ts | rg "export const.*=.*pgTable" -A 15 | rg -v "deletedAt.*timestamp"

# Tables containing user-generated content fields should support soft delete
```

#### **✅ Required Soft Delete Schema Pattern:**
```typescript
// REQUIRED: User data table with soft delete support
export const userDataTable = pgTable('user_data', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  
  // Business fields...
  title: text('title').notNull(),
  
  // REQUIRED: Organization scoping
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  
  // REQUIRED: User relationships
  createdBy: text('created_by')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
    
  // REQUIRED: Soft delete support
  deletedAt: timestamp('deleted_at'), // NULL = active, timestamp = deleted
  
  // REQUIRED: Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

## 🚫 **Phase 2: Query Filtering Compliance Audit**

### **2.1 Find Queries Missing Soft Delete Filtering**

#### **❌ CRITICAL: Find unfiltered queries that include deleted records**
```bash
# Find SELECT queries on user-content tables without deletedAt filtering
rg "db\.select.*from\((todos|projects|posts|comments|messages|documents)" -A 10 --type ts src/ | rg -v "isNull.*deletedAt|deletedAt.*IS.*NULL"

# All user-content table queries must filter deleted records
# NOTE: member/invitation queries don't need deletedAt filtering (relationship tables)

# Find JOIN queries missing soft delete filtering
rg "\.leftJoin\(|\.innerJoin\(" -A 10 --type ts src/ | rg "(todos|projects|posts|comments|messages|documents)" | rg -v "isNull.*deletedAt"

# JOINs with user-content tables must filter deleted records

# Find count operations without soft delete filtering
rg "count\(.*\.(id|title)" -B 5 -A 5 --type ts src/ | rg "(todos|projects|posts|comments|messages|documents)" -B 3 -A 3 | rg -v "isNull.*deletedAt"

# Count operations on user-content tables must exclude soft-deleted records
```

#### **✅ Required Query Filtering Patterns:**
```typescript
// REQUIRED: All queries must filter out soft-deleted records
import { eq, and, isNull, desc } from 'drizzle-orm'

// GET operations
const activeTodos = await db
  .select()
  .from(todos)
  .where(and(
    eq(todos.organizationId, orgId),
    isNull(todos.deletedAt) // CRITICAL: Filter deleted records
  ))
  .orderBy(desc(todos.createdAt))

// JOIN operations  
const todosWithUsers = await db
  .select()
  .from(todos)
  .leftJoin(user, eq(todos.createdBy, user.id))
  .where(and(
    eq(todos.organizationId, orgId),
    isNull(todos.deletedAt) // CRITICAL: Filter in JOINs
  ))

// COUNT operations
const activeCount = await db
  .select({ count: count(todos.id) })
  .from(todos)
  .where(and(
    eq(todos.organizationId, orgId),
    isNull(todos.deletedAt) // CRITICAL: Count only active records
  ))
```

### **2.2 Find Incorrect Import Statements**

#### **❌ CRITICAL: Find missing Drizzle operators for soft delete**
```bash
# Find files using soft delete tables without proper imports
rg "isNull\(|isNotNull\(" --type ts src/ -l | xargs -I {} rg -H "import.*from.*drizzle-orm" {} | rg -v "isNull|isNotNull"

# Files using soft delete queries must import isNull/isNotNull

# Find files missing required operators
rg "(deletedAt|soft.*delete)" --type ts src/ -l | xargs -I {} rg -H "import.*from.*drizzle-orm" {} | rg -v "isNull.*isNotNull|isNotNull.*isNull"

# Should import both isNull and isNotNull for complete soft delete support
```

## 🔄 **Phase 3: Undo Functionality Compliance Audit**

### **3.1 Find Delete Operations Missing Undo Capability**

#### **❌ CRITICAL: Find delete operations without undo functionality**
```bash
# Find delete server functions without undo counterparts
rg "export const delete.*=.*createServerFn" --type ts src/ -l | xargs -I {} bash -c 'file={}; name=$(rg "export const (delete\w+)" -o -r "\$1" "$file"); undo="undo${name#delete}"; rg -q "export const $undo" "$file" || echo "Missing undo for $name in $file"'

# Each delete operation should have corresponding undo function

# Find success toasts for delete operations without undo actions
rg "showSuccess.*deleted|toast\.success.*deleted" --type ts src/ -B 5 -A 5 | rg -v "action.*undo|action.*restore"

# Delete success messages should include undo actions
```

#### **✅ Required Undo Function Pattern:**
```typescript
// REQUIRED: Undo function for every delete operation
export const undoDeleteTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    
    // Use 'create' permission for restore operations
    await checkPermission('todos', ['create'], orgId)

    // Verify record is soft-deleted and owned by organization
    const deletedTodo = await db
      .select()
      .from(todos)
      .where(and(
        eq(todos.id, data.id),
        eq(todos.organizationId, orgId),
        isNotNull(todos.deletedAt) // Only restore deleted records
      ))
      .limit(1)

    if (!deletedTodo[0]) {
      throw AppError.notFound('Deleted Todo')
    }

    // Restore by clearing deletedAt
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
```

### **3.2 Find Toast Notifications Missing Undo Actions**

#### **❌ CRITICAL: Find success toasts without undo capability**
```bash
# Find delete success notifications without undo actions
rg "showSuccess.*delete.*successful|toast\.success.*deleted" -B 10 -A 5 --type ts src/ | rg -v "action.*undo|undoDelete"

# Delete success toasts should include undo actions

# Find enhanced showSuccess usage validation
rg "showSuccess\(" --type ts src/ -B 5 -A 5 | rg "delete" -B 3 -A 3 | rg -v "action.*\{.*label.*onClick"

# Delete operations should use enhanced showSuccess with action parameter
```

#### **✅ Required Toast Pattern:**
```typescript
// REQUIRED: Success toast with undo action for delete operations
showSuccess(t('messages.deleted'), {
  action: {
    label: t('actions.undo'),
    onClick: async () => {
      try {
        await undoDeleteTodo({ data: { id } })
        refetch()
        showSuccess(t('messages.restored'))
      } catch (error) {
        showError(error)
      }
    }
  }
})
```

## 🏗️ **Phase 4: Performance Pattern Audit**

### **4.1 Find Missing Indexes for Soft Delete Queries**

#### **❌ CRITICAL: Find performance issues with soft delete filtering**
```bash
# Check for missing indexes on deletedAt columns
rg "deletedAt.*timestamp" --type ts src/database/schema.ts -l | xargs -I {} bash -c 'table=$(basename {} .ts); rg -q "idx.*${table}.*deletedAt|idx.*${table}.*active" docs/03-database-schema-patterns.md || echo "Missing deletedAt index for $table"'

# Tables with deletedAt should have performance indexes

# Find queries that might benefit from partial indexes  
rg "where.*and.*eq.*organizationId.*isNull.*deletedAt" --type ts src/ -B 2 -A 2

# These patterns should have corresponding WHERE deleted_at IS NULL indexes
```

#### **✅ Required Index Patterns:**
```sql
-- REQUIRED: Performance indexes for soft delete queries
-- Partial index for active records (most common query)
CREATE INDEX CONCURRENTLY idx_todos_active_org 
ON todos (organization_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Index for deleted records (admin/cleanup queries)
CREATE INDEX CONCURRENTLY idx_todos_deleted_org 
ON todos (organization_id, deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Unique constraints considering soft delete
CREATE UNIQUE INDEX CONCURRENTLY idx_todos_unique_title_active
ON todos (organization_id, title)
WHERE deleted_at IS NULL;
```

### **4.2 Find Inefficient Bulk Operations**

#### **❌ Find bulk operations not optimized for soft delete**
```bash
# Find bulk delete operations using loops instead of batch updates
rg "for.*delete|forEach.*delete" --type ts src/ -B 5 -A 10 | rg "db\.update|db\.delete"

# Should use single batch operations instead of loops

# Find bulk operations missing organization validation
rg "bulkDelete|massDelete|batchDelete" --type ts src/ -A 15 | rg -v "eq.*organizationId"

# Bulk operations must validate organization ownership
```

## 📱 **Phase 5: Client-Side Integration Audit**

### **5.1 Find Missing Client-Side Undo Integration**

#### **❌ CRITICAL: Find delete buttons without undo integration**
```bash
# Find delete buttons/handlers without undo functionality
rg "onClick.*delete|handleDelete|onDelete" --type tsx src/ -B 5 -A 10 | rg -v "undo|restore|showSuccess.*action"

# Delete handlers should integrate with undo functionality

# Find mutation hooks without undo support
rg "useMutation.*delete|useDelete" --type ts src/ -A 15 | rg -v "onSuccess.*showSuccess.*action"

# Delete mutations should show success toasts with undo actions
```

#### **✅ Required Client Integration:**
```typescript
// REQUIRED: Delete handler with undo integration
const handleDelete = React.useCallback(async (id: string) => {
  try {
    await deleteTodo({ data: { id } })
    
    // CRITICAL: Must show undo action in success toast
    showSuccess(t('messages.deleted'), {
      action: {
        label: t('actions.undo'),
        onClick: async () => {
          try {
            await undoDeleteTodo({ data: { id } })
            refetch()
            showSuccess(t('messages.restored'))
          } catch (error) {
            showError(error)
          }
        }
      }
    })
    
    refetch()
  } catch (error) {
    showError(error)
  }
}, [showSuccess, showError, t, refetch])
```

### **5.2 Find Translation Gaps for Undo Functionality**

#### **❌ CRITICAL: Find missing translations for undo operations**
```bash
# Check for undo action translations
rg "actions\.undo|messages\.restored|messages\.deleted" --type json src/i18n/locales/

# Should exist in all supported language files

# Find undo-related translation keys without implementations
rg "undo|restore|deleted" --type json src/i18n/locales/ | grep -v "actions\.undo\|messages\.restored\|messages\.deleted"

# May indicate missing translations or inconsistent key usage
```

## 🔒 **Phase 6: Security Pattern Audit**

### **6.1 Find Insecure Undo Operations**

#### **❌ CRITICAL: Find undo operations without proper security**
```bash
# Find undo operations without organization scoping
rg "undoDelete|restore.*Todo|undelete" --type ts src/ -A 15 | rg -v "eq.*organizationId"

# Undo operations must scope by organization

# Find undo operations without permission checks
rg "undoDelete|restore.*function" --type ts src/ -A 15 | rg -v "checkPermission"

# Undo operations must check create permissions

# Find undo operations without state validation
rg "undoDelete|restore" --type ts src/ -A 10 | rg -v "isNotNull.*deletedAt|deletedAt.*NOT.*NULL"

# Undo should only work on soft-deleted records
```

#### **✅ Required Undo Security Pattern:**
```typescript
// REQUIRED: Secure undo implementation
export const undoDeleteTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    
    // REQUIRED: Check create permissions (restoring data)
    await checkPermission('todos', ['create'], orgId)

    // REQUIRED: Verify record is soft-deleted and organization-owned
    const deletedTodo = await db
      .select()
      .from(todos)
      .where(and(
        eq(todos.id, data.id),
        eq(todos.organizationId, orgId), // CRITICAL: Organization scoping
        isNotNull(todos.deletedAt) // CRITICAL: Only restore deleted records
      ))
      .limit(1)

    if (!deletedTodo[0]) {
      throw AppError.notFound('Deleted Todo')
    }

    // Restore implementation...
  })
```

## ⏰ **Phase 7: Time-Limited Undo Audit**

### **7.1 Find Undo Operations Without Time Limits**

#### **❌ Find unlimited undo operations (potential security/storage risk)**
```bash
# Find undo operations without time limit checks
rg "undoDelete|restore" --type ts src/ -A 15 | rg -v "hours.*since|days.*ago|time.*limit|expired"

# Undo operations should have reasonable time limits

# Find permanent delete/cleanup operations
rg "permanentDelete|cleanup.*deleted|purge.*old" --type ts src/

# Should have scheduled cleanup for old soft-deleted records
```

#### **✅ Required Time Limit Pattern:**
```typescript
// REQUIRED: Time-limited undo operations
export const undoDeleteTodo = createServerFn({ method: 'POST' })
  .handler(async ({ data, context }) => {
    const deletedTodo = await findSoftDeletedRecord(data.id, orgId)
    
    // REQUIRED: Check time limit (e.g., 24 hours)
    const deletedAt = new Date(deletedTodo.deletedAt!)
    const now = new Date()
    const hoursSinceDeleted = (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceDeleted > 24) {
      throw new AppError(
        'BIZ_UNDO_EXPIRED',
        400,
        { hoursSinceDeleted: Math.round(hoursSinceDeleted) },
        'Undo is only available for 24 hours after deletion'
      )
    }

    // Restore implementation...
  })
```

## 🧪 **Phase 8: Testing Pattern Compliance**

### **8.1 Find Missing Soft Delete Tests**

#### **❌ Find untested soft delete functionality**
```bash
# Find delete operations without corresponding tests
rg "export const delete.*=.*createServerFn" --type ts src/ -l | xargs -I {} bash -c 'file={}; name=$(basename "$file" .server.ts); test_file="src/**/*test*/**/$name*.test.ts"; find . -name "*$name*test*" -o -name "*test*$name*" | grep -q . || echo "Missing tests for $file"'

# Each delete function should have comprehensive tests

# Find soft delete behavior tests
rg "describe.*soft.*delete|it.*should.*soft.*delete|expect.*deletedAt" --type ts src/

# Should have tests verifying soft delete behavior vs hard delete

# Find undo functionality tests  
rg "describe.*undo|it.*should.*undo|it.*should.*restore" --type ts src/

# Should test undo functionality, time limits, and error cases
```

#### **✅ Required Test Patterns:**
```typescript
// REQUIRED: Comprehensive soft delete testing
describe('Soft Delete Implementation', () => {
  it('should soft delete without removing from database', async () => {
    const todo = await createTestTodo()
    
    await deleteTodo.handler({ data: { id: todo.id }, context: mockContext })
    
    // Verify record still exists with deletedAt timestamp
    const directQuery = await db.select().from(todos).where(eq(todos.id, todo.id))
    expect(directQuery[0].deletedAt).not.toBeNull()
    
    // Verify record doesn't appear in normal queries
    await expect(
      getTodoById.handler({ data: { id: todo.id }, context: mockContext })
    ).rejects.toThrow('Todo not found')
  })

  it('should restore soft deleted records via undo', async () => {
    const todo = await createTestTodo()
    await deleteTodo.handler({ data: { id: todo.id }, context: mockContext })
    
    const restored = await undoDeleteTodo.handler({ 
      data: { id: todo.id }, 
      context: mockContext 
    })
    
    expect(restored.deletedAt).toBeNull()
    
    // Verify appears in normal queries again
    const activeTodo = await getTodoById.handler({ 
      data: { id: todo.id }, 
      context: mockContext 
    })
    expect(activeTodo.id).toBe(todo.id)
  })

  it('should prevent undo after time limit', async () => {
    // Test time limit enforcement
  })
})
```

## 🎨 **Phase 9: UI/UX Pattern Compliance**

### **9.1 Find Delete UI Components Missing Undo Integration**

#### **❌ Find delete buttons without undo UX**
```bash
# Find delete buttons without undo-aware success messaging
rg "Trash|Delete|Remove" --type tsx src/components/ -B 5 -A 10 | rg "onClick" -A 5 | rg -v "showSuccess.*action"

# Delete UI should integrate with undo-capable success toasts

# Find confirm dialogs for delete operations
rg "confirm.*delete|useConfirm" --type tsx src/ -A 10 | rg -v "description.*undo.*available"

# Delete confirmations should mention undo availability
```

#### **✅ Required UI Integration:**
```typescript
// REQUIRED: Delete UI with undo awareness
const handleDelete = async (id: string) => {
  const confirmed = await confirm({
    title: t('confirm.title'),
    description: t('messages.deleteConfirm'), // Should mention undo availability
    confirmText: t('actions.delete'),
    variant: 'destructive'
  })
  
  if (!confirmed) return

  try {
    await deleteTodo({ data: { id } })
    
    // CRITICAL: Must show undo action
    showSuccess(t('messages.deleted'), {
      action: {
        label: t('actions.undo'),
        onClick: async () => {
          // Undo implementation
        }
      }
    })
  } catch (error) {
    showError(error)
  }
}
```

## 📋 **Soft Delete Pattern Audit Report Template**

### **Soft Delete Pattern Compliance Report**

**Date**: [Audit Date]
**Auditor**: [AI Agent ID]  
**Scope**: [Tables and Operations Audited]

#### **Schema Compliance**
- **User Data Tables with Soft Delete**: X/X properly implemented
- **Missing deletedAt Fields**: X tables need soft delete support
- **Schema Pattern Compliance**: ✅/❌ Following established patterns
- **Index Performance**: ✅/❌ Proper indexes for deletedAt filtering

#### **Query Pattern Compliance**  
- **Filtered Queries**: X/X properly exclude soft-deleted records
- **Missing isNull(deletedAt) Filters**: X queries need filtering
- **JOIN Query Compliance**: X/X joins properly filter deleted records
- **Bulk Operation Security**: X/X operations properly scoped

#### **Undo Functionality Compliance**
- **Delete Operations with Undo**: X/X have undo counterparts
- **Success Toast Integration**: X/X show undo actions
- **Time-Limited Undo**: X/X implement time constraints
- **Permission Validation**: X/X undo operations check permissions

#### **Security Compliance**
- **Organization Scoping**: X/X undo operations properly scoped
- **State Validation**: X/X verify record is soft-deleted before restore
- **Hard Delete Prevention**: ✅/❌ No inappropriate hard deletes found
- **Cross-Tenant Protection**: ✅/❌ Undo operations secure

#### **Translation Compliance**
- **Undo Action Labels**: X/X languages support undo actions
- **Success/Error Messages**: X/X languages have restore messages
- **Confirmation Messages**: X/X properly translated

#### **Critical Soft Delete Issues**
| File | Line | Issue | Risk Level | Impact |
|------|------|-------|-----------|--------|
| ... | ... | Hard delete on user data | Critical | Data loss |
| ... | ... | Missing deletedAt filter | High | Shows deleted records |
| ... | ... | No undo functionality | Medium | Poor UX |

#### **Soft Delete Recommendations**
1. [Immediate Hard Delete Fixes]
2. [Query Filtering Implementations]
3. [Undo Functionality Additions]  
4. [Performance Index Optimizations]
5. [Security Pattern Enhancements]

---

## 🚀 **Usage Instructions for AI Agents**

1. **Run this audit** after implementing any delete functionality
2. **Prioritize hard delete fixes** - critical for data protection
3. **Verify all query filtering** - prevents data leakage
4. **Implement undo functionality** - improves user experience
5. **Test soft delete behavior** - ensure proper implementation
6. **Validate performance** - check indexes and query efficiency

This routine ensures **user-friendly data management** while maintaining security and performance standards for soft delete implementations.