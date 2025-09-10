# Database Security Audit Routine

This document provides a systematic quality assurance routine for AI agents to validate database security, query patterns, schema compliance, and data protection patterns in the TanStack SaaS starter template.

## 🎯 **Purpose**

This routine ensures that all database operations written by AI agents follow security best practices, maintain proper organization scoping, implement correct schema patterns, and prevent SQL injection and data leakage vulnerabilities.

## 📋 **Pre-Audit Checklist**

Before beginning the audit, ensure:
- [ ] Database documentation (`03-database-schema-patterns.md`) is current
- [ ] Understanding of Drizzle ORM patterns and multi-tenant schema
- [ ] Access to database schema and all query patterns

## 🔍 **Phase 1: Database Pattern Discovery**

### **1.1 Find All Database Operations**

Run these commands to discover all database code:

```bash
# Find all database queries
rg "db\.(select|insert|update|delete)" --type ts -l

# Find all schema imports
rg "import.*from.*@/database/schema" --type ts -l

# Find all table definitions
rg "export const.*=.*pgTable" --type ts src/database/schema.ts -l

# Find all Drizzle operators usage
rg "eq\(|and\(|or\(|desc\(|asc\(" --type ts -l
```

### **1.2 Categorize by Data Sensitivity**

Create operation lists by security impact:
- **Critical Data**: User content, financial data, personal information
- **High Risk**: Authentication data, organization data, member information  
- **Medium Risk**: System logs, configuration data, analytics
- **Low Risk**: Static reference data, public information

## 🗃️ **Phase 2: Schema Security Audit**

### **2.1 Table Structure Compliance**

#### **❌ CRITICAL: Find tables missing organizationId**
```bash
# Check all user data tables include organizationId
rg "export const.*=.*pgTable.*\(" -A 15 --type ts src/database/schema.ts | rg -E "(todos|projects|documents|messages|posts)" -B 2 -A 10 | rg -v "organizationId.*text"

# Should return ZERO user data tables without organizationId

# Check organizationId has proper constraints
rg "organizationId.*text" -A 3 --type ts src/database/schema.ts | rg -v "references.*organization\.id.*onDelete.*cascade"

# Should return ZERO - all organizationId fields must reference organization.id with cascade
```

#### **✅ Required Schema Patterns:**
```typescript
// REQUIRED: User data table structure
export const userDataTable = pgTable('user_data', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  
  // REQUIRED: Organization scoping
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  
  // REQUIRED: User relationships
  createdBy: text('created_by')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
    
  // REQUIRED: Consistent timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

### **2.2 Foreign Key Constraint Verification**

#### **❌ CRITICAL: Find missing foreign key constraints**
```bash
# Check all user references have proper constraints
rg "userId.*text|createdBy.*text|assignedTo.*text" -A 3 --type ts src/database/schema.ts | rg -v "references.*user\.id"

# Should return ZERO - all user references must have foreign keys

# Check inconsistent onDelete behaviors
rg "references.*onDelete.*set.*null" --type ts src/database/schema.ts -B 2 -A 2

# Review each - ensure onDelete behavior is intentional
```

## 🔐 **Phase 3: Query Security Audit**

### **3.1 Organization Scoping Verification**

#### **❌ CRITICAL: Find unscoped queries**
```bash
# Find SELECT queries without organization scoping
rg "db\.select\(\)\.from\((todos|members|invitations|userdata)" --type ts src/ -A 5 | rg -v "eq.*organizationId"

# Should return ZERO - all user data queries must include organization filter

# Find JOIN queries without proper scoping
rg "leftJoin\(|innerJoin\(|join\(" --type ts src/ -A 5 -B 5 | rg -v "eq.*organizationId"

# JOINs should maintain organization scoping across all tables
```

#### **✅ Required Query Scoping:**
```typescript
// REQUIRED: Organization scoping in all user data queries
const userTodos = await db
  .select()
  .from(todos)
  .where(eq(todos.organizationId, organizationId))

// REQUIRED: Organization scoping in JOINs
const todosWithAssignees = await db
  .select()
  .from(todos)
  .leftJoin(user, eq(todos.assignedTo, user.id))
  .where(eq(todos.organizationId, organizationId))

// REQUIRED: Organization scoping in updates/deletes
await db
  .update(todos)
  .set(data)
  .where(and(
    eq(todos.id, todoId),
    eq(todos.organizationId, organizationId) // CRITICAL for security
  ))
```

### **3.2 SQL Injection Prevention**

#### **❌ CRITICAL: Find raw SQL usage**
```bash
# Find potential SQL injection vulnerabilities
rg "db\.execute.*\$\{|sql.*\$\{|query.*\+.*data" --type ts src/

# Should return ZERO results - no string interpolation in SQL

# Find dynamic query building
rg "WHERE.*\$\{|SET.*\$\{|VALUES.*\$\{" --type ts src/

# Should return ZERO results - use Drizzle operators only
```

#### **✅ Required Query Safety:**
```typescript
// REQUIRED: Use Drizzle operators (safe from injection)
import { eq, and, or, like, ilike, desc } from 'drizzle-orm'

// SAFE: Parameterized queries
await db.select().from(todos).where(eq(todos.title, userInput))

// DANGEROUS: String interpolation (NEVER DO THIS)
// await db.execute(`SELECT * FROM todos WHERE title = '${userInput}'`)
```

### **3.3 Drizzle Query Operator Usage**

#### **❌ CRITICAL: Find incorrect use of && instead of and()**
```bash
# Find JavaScript && operator in where clauses (should use Drizzle's and())
rg "\.where\([^)]*&&[^)]*\)" --type ts src/

# Should return ZERO results - use and() for multiple conditions

# Find conditional logic building where clauses incorrectly
rg "conditions.*&&.*conditions|filter.*&&.*filter" --type ts src/ -B 2 -A 2

# Review each - ensure using and(...conditions) not JavaScript &&
```

#### **✅ Required Drizzle Operator Usage:**
```typescript
// CORRECT: Use Drizzle's and() function for multiple conditions
import { and, eq, isNull } from 'drizzle-orm'

const todos = await db
  .select()
  .from(todos)
  .where(and(
    eq(todos.organizationId, orgId),
    eq(todos.userId, userId),
    isNull(todos.deletedAt)
  ))

// INCORRECT: Using JavaScript && operator (will not work correctly)
// const todos = await db
//   .select()
//   .from(todos)
//   .where(
//     eq(todos.organizationId, orgId) && eq(todos.userId, userId) // WRONG!
//   )

// CORRECT: Building conditions array and using and()
const conditions = []
conditions.push(eq(todos.organizationId, orgId))
if (userId) conditions.push(eq(todos.userId, userId))
conditions.push(isNull(todos.deletedAt))

const results = await db
  .select()
  .from(todos)
  .where(and(...conditions)) // Correct usage with spread operator
```

## 🔒 **Phase 4: Data Access Pattern Security**

### **4.1 Ownership Validation**

#### **❌ CRITICAL: Find missing ownership verification**
```bash
# Find update operations without ownership verification
rg "db\.update|db\.delete" --type ts src/ -B 10 -A 5 | rg -v "existing.*where.*and.*eq.*organizationId"

# Updates/deletes should verify resource exists and belongs to organization

# Find bulk operations without proper validation
rg "inArray.*ids|bulkDelete|bulkUpdate" --type ts src/ -A 10 | rg -v "verify.*organization|validate.*ownership"

# Bulk operations must verify all items belong to current organization
```

#### **✅ Required Ownership Patterns:**
```typescript
// REQUIRED: Ownership verification before updates
const existingTodo = await db
  .select()
  .from(todos)
  .where(and(
    eq(todos.id, data.id),
    eq(todos.organizationId, organizationId) // Verify ownership
  ))
  .limit(1)

if (!existingTodo[0]) {
  throw AppError.notFound('Todo')
}

// REQUIRED: Ownership verification in bulk operations
const validTodos = await db
  .select({ id: todos.id })
  .from(todos)
  .where(and(
    eq(todos.organizationId, organizationId),
    inArray(todos.id, todoIds)
  ))

const validIds = validTodos.map(t => t.id)
// Only operate on validated IDs
```

### **4.2 Transaction Security**

#### **❌ CRITICAL: Find unsafe transaction patterns**
```bash
# Find transactions without proper error handling
rg "db\.transaction" --type ts src/ -A 15 | rg -v "try.*catch|throw.*error"

# Transactions should have proper error handling and rollback

# Find nested transactions (potential deadlocks)
rg "db\.transaction" --type ts src/ -A 20 | rg "db\.transaction"

# Should avoid nested transactions - use single transaction scope
```

## 📊 **Phase 5: Performance & Security Balance**

### **5.1 Efficient Security Patterns**

#### **✅ Optimized Security Queries:**
```bash
# Check for efficient organization scoping with indexes
rg "WHERE.*organizationId.*ORDER.*createdAt|WHERE.*organizationId.*LIMIT" --type sql migrations/

# Should have proper indexes for organization + timestamp queries
```

### **5.2 Connection Security**

#### **✅ Database Connection Security:**
```bash
# Check database connection configuration
rg "postgres\(.*connectionString" -A 5 --type ts src/lib/db/

# Should have proper connection limits and timeouts
```

## 🧪 **Phase 6: Database Testing Verification**

### **6.1 Security Test Coverage**

Check that database security is tested:

```bash
# Find database security tests
rg "describe.*database.*security|it.*should.*prevent.*access" --type ts src/

# Should cover: cross-organization access, SQL injection, data leakage

# Find transaction tests
rg "describe.*transaction|it.*should.*rollback" --type ts src/

# Should cover: transaction rollback, error handling, consistency
```

## 📋 **Database Security Report Template**

### **Database Security Audit Report**

**Date**: [Audit Date]
**Auditor**: [AI Agent ID]  
**Scope**: [Tables and Queries Audited]

#### **Schema Security**
- **User Data Tables**: X/X properly scoped with organizationId
- **Foreign Key Constraints**: X/X properly defined
- **Cascade Behaviors**: X/X intentionally configured
- **Index Strategy**: ✅/❌ Security-optimized

#### **Query Security**
- **Organization Scoping**: X/X queries properly scoped
- **Ownership Verification**: X/X updates/deletes verified
- **SQL Injection Prevention**: ✅/❌ Using safe operators
- **Transaction Safety**: X/X transactions properly handled

#### **Data Protection**
- **Cross-Tenant Prevention**: ✅/❌ Isolation maintained
- **Bulk Operation Security**: X/X bulk ops validated
- **Connection Security**: ✅/❌ Properly configured
- **Migration Security**: ✅/❌ Schema changes secure

#### **Critical Security Issues**
| File | Line | Issue | Risk Level | Impact |
|------|------|-------|-----------|--------|
| ... | ... | ... | ... | ... |

#### **Database Security Recommendations**
1. [Critical Query Security Fixes]
2. [Schema Security Improvements]  
3. [Transaction Pattern Enhancements]
4. [Index Optimization for Security]

---

## 🚀 **Usage Instructions for AI Agents**

1. **Run this audit** after implementing any database operations
2. **Verify organization scoping** in all user data queries
3. **Check foreign key constraints** for all relationships
4. **Validate transaction patterns** for atomic operations
5. **Test data isolation** between organizations

## 🗑️ **Phase 7: Soft Delete Security Audit**

### **7.1 Soft Delete Pattern Security**

#### **❌ CRITICAL: Find hard deletes on user data**
```bash
# Find dangerous hard delete operations on user-generated content (not relationship tables)
rg "db\.delete\((todos|projects|posts|comments|messages|documents)" --type ts src/

# Should return ZERO results - user content should use soft delete
# NOTE: member/invitation hard deletes are APPROPRIATE (just recreatable relationships)

# Find hard delete without proper justification
rg "db\.delete.*where.*eq.*organizationId" --type ts src/ -B 5 | rg -v "GDPR\|sensitive\|cleanup\|admin.*permanent"

# Hard deletes should be justified (GDPR, cleanup, etc.)
```

#### **❌ CRITICAL: Find soft delete queries without proper filtering**
```bash
# Find queries on user-content tables without deletedAt filtering  
rg "db\.select.*from\((todos|projects|posts|comments|messages|documents)" -A 10 --type ts src/ | rg -v "isNull.*deletedAt|deleted_at.*IS.*NULL"

# All user-content table queries must filter deleted records
# NOTE: member/invitation queries appropriately don't need deletedAt (relationship tables)

# Find missing imports for soft delete operators
rg "deletedAt|soft.*delete" --type ts src/ -l | xargs -I {} rg -H "import.*from.*drizzle-orm" {} | rg -v "isNull"

# Files using deletedAt must import isNull/isNotNull operators
```

#### **✅ Required Soft Delete Security:**
```typescript
// REQUIRED: Secure soft delete implementation
import { eq, and, isNull, isNotNull } from 'drizzle-orm'

// All queries on soft delete tables must filter deleted records
const activeTodos = await db
  .select()
  .from(todos) 
  .where(and(
    eq(todos.organizationId, orgId),
    isNull(todos.deletedAt) // CRITICAL: Security requirement
  ))

// Undo operations must validate state and ownership
const undoDelete = async (id: string, orgId: string) => {
  const deleted = await db
    .select()
    .from(todos)
    .where(and(
      eq(todos.id, id),
      eq(todos.organizationId, orgId), // CRITICAL: Organization scoping
      isNotNull(todos.deletedAt) // CRITICAL: Only restore deleted records
    ))
    .limit(1)
    
  if (!deleted[0]) {
    throw AppError.notFound('Deleted Todo')
  }
  
  // Restore by clearing deletedAt
  return await db
    .update(todos)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(and(eq(todos.id, id), eq(todos.organizationId, orgId)))
    .returning()
}
```

### **7.2 Soft Delete Index Security**

#### **✅ Performance Indexes for Security:**
```sql
-- REQUIRED: Indexes for soft delete security and performance
-- Active records index (most common security pattern)
CREATE INDEX CONCURRENTLY idx_todos_active_org_security
ON todos (organization_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Deleted records index (admin access, cleanup)  
CREATE INDEX CONCURRENTLY idx_todos_deleted_org_admin
ON todos (organization_id, deleted_at)
WHERE deleted_at IS NOT NULL;

-- Prevent duplicate active titles within organization
CREATE UNIQUE INDEX CONCURRENTLY idx_todos_unique_title_active_org
ON todos (organization_id, title)
WHERE deleted_at IS NULL;
```

#### **Database Security Report Template (Updated)**

**Date**: [Audit Date]
**Auditor**: [AI Agent ID]  
**Scope**: [Tables and Queries Audited]

#### **Schema Security**
- **User Data Tables**: X/X properly scoped with organizationId
- **Soft Delete Support**: X/X user tables have deletedAt fields  
- **Foreign Key Constraints**: X/X properly defined
- **Cascade Behaviors**: X/X intentionally configured
- **Index Strategy**: ✅/❌ Security and performance optimized

#### **Query Security**
- **Organization Scoping**: X/X queries properly scoped
- **Soft Delete Filtering**: X/X queries filter deleted records
- **Ownership Verification**: X/X updates/deletes verified
- **SQL Injection Prevention**: ✅/❌ Using safe operators
- **Transaction Safety**: X/X transactions properly handled

#### **Data Protection**
- **Cross-Tenant Prevention**: ✅/❌ Isolation maintained
- **Soft Delete Security**: X/X restore operations secure
- **Hard Delete Justification**: X/X hard deletes justified
- **Bulk Operation Security**: X/X bulk ops validated
- **Connection Security**: ✅/❌ Properly configured
- **Migration Security**: ✅/❌ Schema changes secure

#### **Soft Delete Compliance**
- **User Data Protection**: X/X tables use soft delete appropriately
- **Query Filtering**: X/X queries filter soft-deleted records
- **Undo Security**: X/X restore operations secure
- **Time Limit Enforcement**: X/X undo operations time-limited

#### **Critical Security Issues**
| File | Line | Issue | Risk Level | Impact |
|------|------|-------|-----------|--------|
| ... | ... | Hard delete on user data | Critical | Data loss |
| ... | ... | Missing deletedAt filter | High | Shows deleted data |
| ... | ... | Insecure undo operation | High | Cross-tenant access |

#### **Database Security Recommendations**
1. [Critical Query Security Fixes]
2. [Schema Security Improvements]  
3. [Transaction Pattern Enhancements]
4. [Index Optimization for Security]
5. [Soft Delete Pattern Implementations]

This routine ensures **bulletproof database security** with comprehensive soft delete pattern compliance, preventing data leakage, injection attacks, unauthorized access patterns, and accidental permanent data loss.