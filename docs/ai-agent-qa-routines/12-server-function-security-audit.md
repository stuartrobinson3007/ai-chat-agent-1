# Server Function Security Audit Routine

This document provides a systematic quality assurance routine for AI agents to validate server function security, API endpoint protection, and backend security patterns in the TanStack SaaS starter template.

## 🎯 **Purpose**

This routine ensures that all server functions written by AI agents follow security best practices, maintain proper authentication/authorization, implement correct validation patterns, and prevent common API security vulnerabilities.

## 📋 **Pre-Audit Checklist**

Before beginning the audit, ensure:
- [ ] Server function documentation (`06-server-functions-api-patterns.md`) is current
- [ ] Understanding of TanStack Start server function architecture
- [ ] Access to all server-side code and API routes

## 🔍 **Phase 1: Server Function Discovery**

### **1.1 Find All Server Functions**

Run these commands to discover all server-side code:

```bash
# Find all server functions
rg "createServerFn" --type ts -l

# Find all API routes
find src/routes/api/ -name "*.ts" -type f

# Find all middleware files
rg "createMiddleware" --type ts -l

# Find all .server.ts files
find src/ -name "*.server.ts" -type f
```

### **1.2 Categorize by Security Impact**

Create file lists by security criticality:
- **Critical Security**: User data operations, authentication, billing
- **High Risk**: Admin operations, file uploads, external API calls
- **Medium Risk**: Read operations, validation, utility functions
- **Low Risk**: Health checks, static data, public endpoints

## 🛡️ **Phase 2: Authentication Security Audit**

### **2.1 Authentication Bypass Detection**

#### **❌ CRITICAL: Find server functions without authentication**
```bash
# Find createServerFn without authentication middleware
rg "createServerFn.*\{.*method.*\}" -A 10 --type ts src/ | rg -v "middleware.*auth"

# Should return ZERO results for operations handling user data

# Find API routes without session validation
rg "createServerFileRoute" -A 15 --type ts src/routes/api/ | rg -v "getSession|auth\.api"

# API routes handling user data should validate sessions
```

#### **❌ CRITICAL: Find missing method specifications**
```bash
# Find server functions without HTTP method
rg "createServerFn\(\)" --type ts src/

# Should return ZERO results - all functions must specify method

rg "createServerFn\(\s*\{[^}]*\}\)" --type ts src/ | rg -v "method.*:"

# Should return ZERO results - method is required
```

### **2.2 Middleware Chain Security**

#### **❌ CRITICAL: Find wrong middleware order**
```bash
# Find middleware chains with wrong order
rg "middleware.*\[.*organizationMiddleware.*,.*authMiddleware" --type ts src/

# Should return ZERO results - auth must come before organization

# Find protected operations missing organization middleware
rg "createServerFn.*method.*POST" -A 10 --type ts src/ | rg "db\.insert.*todos|db\.update.*todos|db\.delete.*todos" -B 5 | rg -v "organizationMiddleware"

# User data operations must include organization middleware
```

#### **✅ Required Middleware Patterns:**
```typescript
// REQUIRED: Proper middleware chain for user data
export const userDataAction = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware]) // Includes authMiddleware internally
  .validator(schema.parse)
  .handler(async ({ context }) => {
    // context.user - authenticated user
    // context.organizationId - validated organization access
  })

// REQUIRED: Admin operations
export const adminAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (context.user.role !== 'superadmin') {
      throw AppError.forbidden('Admin access required')
    }
  })
```

## 🔐 **Phase 3: Input Validation Security**

### **3.1 Validation Coverage Verification**

#### **❌ CRITICAL: Find server functions without validation**
```bash
# Find POST/PUT operations without validation
rg "createServerFn.*method.*(POST|PUT)" -A 5 --type ts src/ | rg -v "validator.*parse|validator.*schema"

# Should return ZERO results - all input operations must validate

# Find direct data insertion without validation  
rg "db\.insert.*\.values.*data\)|db\.update.*\.set.*data\)" --type ts src/ -B 10 | rg -v "validator.*parse"

# Should return ZERO results - raw data insertion is dangerous
```

#### **✅ Required Validation Patterns:**
```typescript
// REQUIRED: Zod validation for all inputs
const actionSchema = z.object({
  field1: z.string().min(1),
  field2: z.string().optional(),
})

export const secureAction = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    try {
      return actionSchema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Convert to ValidationError with proper field mapping
        const fields: Record<string, string[]> = {}
        error.issues.forEach((err: z.ZodIssue) => {
          const path = err.path.join('.')
          if (!fields[path]) fields[path] = []
          fields[path].push(err.code === 'too_small' ? 'VAL_REQUIRED_FIELD' : 'VAL_INVALID_FORMAT')
        })
        throw new ValidationError(fields, errorTranslations.server.validationFailed)
      }
      throw error
    }
  })
  .handler(async ({ data }) => {
    // data is now validated and type-safe
  })
```

### **3.2 Data Sanitization Verification**

#### **❌ CRITICAL: Find unsanitized data operations**
```bash
# Find direct string insertion without sanitization
rg "title.*data\.title|name.*data\.name|description.*data\.description" --type ts src/ -B 5 | rg -v "\.trim\(\)|sanitize|validate"

# String inputs should be trimmed and validated

# Find potential XSS vulnerabilities
rg "innerHTML.*=|dangerouslySetInnerHTML" --type tsx src/

# Should return ZERO results - no unsafe HTML insertion
```

## 🔒 **Phase 4: Authorization Security Audit**

### **4.1 Permission Check Coverage**

#### **❌ CRITICAL: Find operations without permission checks**
```bash
# Find protected operations missing checkPermission
rg "db\.insert|db\.update|db\.delete" --type ts src/ -B 10 -A 2 | rg -v "checkPermission.*resource.*action"

# All user data modifications should check permissions

# Find admin operations without admin verification  
rg "user.*role.*superadmin|admin.*operation|impersonat" --type ts src/ -B 5 | rg -v "role.*===.*superadmin"

# Admin operations should verify superadmin role
```

#### **✅ Required Permission Patterns:**
```typescript
// REQUIRED: Permission checks before operations
await checkPermission('todos', ['create'], organizationId)
await checkPermission('billing', ['manage'], organizationId)  
await checkPermission('member', ['delete'], organizationId)

// REQUIRED: Admin operation verification
if (context.user.role !== 'superadmin') {
  throw AppError.forbidden('Admin access required')
}
```

### **4.2 Organization Context Security**

#### **❌ CRITICAL: Find missing organization validation**
```bash
# Find operations using organizationId without validation
rg "organizationId.*context" -A 5 --type ts src/ | rg -v "if.*!.*organizationId|throw.*VAL_REQUIRED_FIELD"

# Should validate organizationId exists before using it

# Find potential organization bypass
rg "organizationId.*=.*req|organizationId.*=.*params" --type ts src/

# Should return ZERO results - organization context should come from middleware
```

## 📡 **Phase 5: API Route Security Audit**

### **5.1 API Endpoint Protection**

#### **❌ CRITICAL: Find unprotected API routes**
```bash
# Find API routes without authentication
rg "createServerFileRoute" -A 15 --type ts src/routes/api/ | rg -v "getSession|auth\.api"

# API routes handling user data should authenticate

# Find API routes with missing error handling
rg "POST.*async.*\{|GET.*async.*\{" -A 10 --type ts src/routes/api/ | rg -v "try.*catch|Response\.json.*error"

# API routes should have proper error handling
```

#### **✅ Required API Security Patterns:**
```typescript
// REQUIRED: Authentication in API routes
export const ServerRoute = createServerFileRoute('/api/resource').methods({
  POST: async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    try {
      const body = await request.json()
      const validatedData = schema.parse(body)
      // Process request
      return Response.json({ success: true, data: result })
    } catch (error) {
      return Response.json({
        error: error instanceof Error ? error.message : 'Internal server error',
      }, { status: 500 })
    }
  },
})
```

### **5.2 File Upload Security**

#### **❌ CRITICAL: Find file uploads without proper validation**
```bash
# Find file upload endpoints
rg "formData\.|File\(" --type ts src/routes/api/ -B 5 -A 10

# Should include: file type validation, size limits, content validation

# Find image processing without validation
rg "sharp\(|ImageProcessor" --type ts src/ -B 5 | rg -v "validateImage|allowedTypes"

# Image processing should validate file content
```

## 🧪 **Phase 6: Security Testing Verification**

### **6.1 Authentication Test Coverage**

Check that security scenarios are tested:

```bash
# Find authentication security tests
rg "describe.*auth.*security|it.*should.*require.*auth" --type ts src/

# Should cover: unauthorized access, token validation, session expiry

# Find permission test coverage
rg "describe.*permission|it.*should.*check.*permission|expect.*toThrow.*permission" --type ts src/

# Should cover: insufficient permissions, role changes, organization access
```

### **6.2 Input Validation Test Coverage**

```bash
# Find input validation tests
rg "describe.*validation|it.*should.*validate.*input|expect.*toThrow.*ValidationError" --type ts src/

# Should cover: malformed inputs, XSS attempts, SQL injection patterns
```

## 🔧 **Phase 7: Advanced Security Patterns**

### **7.1 Rate Limiting & DoS Protection**

#### **✅ Rate Limiting Implementation:**
```bash
# Check rate limiting implementation
rg "rateLimit|throttle|debounce" --type ts src/ -B 2 -A 2

# Should have rate limiting for sensitive operations
```

### **7.2 CSRF Protection**

#### **✅ CSRF Token Verification:**
```bash
# Check CSRF protection
rg "csrf|samesite|httpOnly" --type ts src/ -i

# Should have proper CSRF protection for state-changing operations
```

### **7.3 SQL Injection Prevention**

#### **❌ CRITICAL: Find raw SQL usage**
```bash
# Find potential SQL injection vulnerabilities
rg "db\.execute.*\$\{|sql.*\$\{|query.*\+.*data" --type ts src/

# Should return ZERO results - use parameterized queries only

# Find string interpolation in queries
rg "WHERE.*\$\{|SET.*\$\{|VALUES.*\$\{" --type ts src/

# Should return ZERO results - use Drizzle operators only
```

## 📋 **Server Function Security Report Template**

### **Server Function Security Audit Report**

**Date**: [Audit Date]
**Auditor**: [AI Agent ID]
**Scope**: [Functions Audited Count]

#### **Authentication Security**
- **Server Functions**: X/X properly authenticated
- **API Routes**: X/X with session validation
- **Middleware Chains**: X/X in correct order
- **Method Specifications**: X/X properly defined

#### **Authorization Security**
- **Permission Checks**: X/X operations protected
- **Organization Scoping**: X/X properly scoped
- **Admin Operations**: X/X properly verified
- **Role-Based Access**: ✅/❌ Correctly implemented

#### **Input Security**
- **Validation Coverage**: X/X inputs validated
- **Data Sanitization**: X/X properly sanitized
- **XSS Prevention**: ✅/❌ Implemented
- **SQL Injection Prevention**: ✅/❌ Secure

#### **API Endpoint Security**
- **Authentication**: X/X routes protected
- **Error Handling**: X/X routes secure
- **File Upload Security**: X/X uploads validated
- **Response Sanitization**: X/X responses clean

#### **Critical Vulnerabilities Found**
| File | Line | Vulnerability | Risk Level | Impact |
|------|------|--------------|-----------|--------|
| ... | ... | ... | ... | ... |

#### **Security Recommendations**
1. [Critical Security Fixes]
2. [Authentication Improvements]
3. [Authorization Enhancements]
4. [Input Validation Strengthening]

---

## 🚨 **Common Security Anti-Patterns to Detect**

### **Authentication Bypass**
```bash
# Find these dangerous patterns:
rg "// Skip auth|// TODO.*auth|// TEMP.*auth" --type ts src/
```

### **Permission Bypass**
```bash
# Find these dangerous patterns:
rg "// Skip permission|// TODO.*permission|// Admin.*only" --type ts src/
```

### **Data Exposure**
```bash
# Find these dangerous patterns:
rg "console\.log.*session|console\.log.*user|alert.*password" --type ts src/
```

### **Injection Vulnerabilities**
```bash
# Find these dangerous patterns:
rg "eval\(|Function\(|setTimeout.*data|setInterval.*data" --type ts src/
```

## 🚀 **Usage Instructions for AI Agents**

1. **Run this audit** after implementing any server-side functionality
2. **Follow phases sequentially** to ensure complete security coverage
3. **Fix critical vulnerabilities immediately** before deployment
4. **Validate all user data operations** use proper authentication and authorization
5. **Test security scenarios** to verify protection works correctly

## 🔄 **Phase 10: Undo Operations Security Audit**

### **10.1 Find Delete Operations Without Undo Support**

#### **❌ CRITICAL: Find delete operations missing undo functionality**
```bash
# Find delete server functions without corresponding undo functions
rg "export const delete.*=.*createServerFn" --type ts src/ -l | xargs -I {} bash -c 'file={}; name=$(rg "export const (delete\w+)" -o -r "\$1" "$file" 2>/dev/null | head -1); if [ ! -z "$name" ]; then undo="undo${name#delete}"; rg -q "export const $undo" "$file" || echo "Missing undo function for $name in $file"; fi'

# User data delete operations should have undo counterparts

# Find soft delete operations that return success without canUndo flag
rg "deletedAt.*new Date|set.*deletedAt" -A 10 --type ts src/ | rg "return.*success" | rg -v "canUndo.*true"

# Soft delete operations should indicate undo capability
```

#### **✅ Required Undo Function Pattern:**
```typescript
// REQUIRED: Every user data delete must have undo counterpart
export const deleteTodo = createServerFn({ method: 'POST' })
  .handler(async ({ data, context }) => {
    // Soft delete implementation
    await db.update(todos).set({ deletedAt: new Date() })
    
    return { 
      success: true, 
      canUndo: true, // CRITICAL: Indicate undo capability
      undoTimeLimit: 24 * 60 * 60 * 1000 
    }
  })

export const undoDeleteTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    
    // CRITICAL: Use create permission for restore operations
    await checkPermission('todos', ['create'], orgId)

    // CRITICAL: Verify record is soft-deleted and owned
    const deletedRecord = await db
      .select()
      .from(todos)
      .where(and(
        eq(todos.id, data.id),
        eq(todos.organizationId, orgId), // Security: Organization scoping
        isNotNull(todos.deletedAt) // Security: Only restore deleted records
      ))
      .limit(1)

    if (!deletedRecord[0]) {
      throw AppError.notFound('Deleted Todo')
    }

    // Restore by clearing deletedAt
    return await db
      .update(todos)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(todos.id, data.id), eq(todos.organizationId, orgId)))
      .returning()
  })
```

### **10.2 Undo Operation Security Validation**

#### **❌ CRITICAL: Find insecure undo operations**
```bash
# Find undo operations without organization scoping
rg "undoDelete|restore.*function" --type ts src/ -A 15 | rg -v "eq.*organizationId"

# Undo operations must scope by organization for security

# Find undo operations without proper state validation
rg "undoDelete|restore" --type ts src/ -A 10 | rg -v "isNotNull.*deletedAt|deletedAt.*NOT.*NULL"

# Undo should only work on actually deleted records

# Find undo operations with wrong permissions
rg "undoDelete|restore" --type ts src/ -A 15 | rg "checkPermission" | rg -v "create.*permission|restore.*permission"

# Undo operations should use 'create' permissions since restoring data

# Find undo operations without time limits
rg "undoDelete|restore" --type ts src/ -A 15 | rg -v "hours.*since|time.*limit|expired.*undo"

# Undo operations should have reasonable time constraints
```

#### **✅ Required Undo Security Patterns:**
```typescript
// REQUIRED: Secure undo operation implementation
export const undoDeleteTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    
    // CRITICAL: Check create permissions (we're restoring data)
    await checkPermission('todos', ['create'], orgId)

    // CRITICAL: Verify record state and ownership
    const deletedTodo = await db
      .select()
      .from(todos)
      .where(and(
        eq(todos.id, data.id),
        eq(todos.organizationId, orgId), // Security: Cross-tenant protection
        isNotNull(todos.deletedAt) // Security: Only restore deleted records
      ))
      .limit(1)

    if (!deletedTodo[0]) {
      throw AppError.notFound('Deleted Todo')
    }

    // CRITICAL: Implement time limits for undo operations
    const deletedAt = new Date(deletedTodo[0].deletedAt!)
    const hoursSinceDeleted = (Date.now() - deletedAt.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceDeleted > 24) {
      throw new AppError(
        'BIZ_UNDO_EXPIRED',
        400,
        { hoursSinceDeleted: Math.round(hoursSinceDeleted) },
        'Undo is only available for 24 hours after deletion'
      )
    }

    // Restore implementation with audit trail
    const restored = await db
      .update(todos)
      .set({ 
        deletedAt: null,
        updatedAt: new Date() // CRITICAL: Update timestamp for audit
      })
      .where(and(
        eq(todos.id, data.id),
        eq(todos.organizationId, orgId)
      ))
      .returning()

    return restored[0]
  })
```

### **10.3 Client-Side Undo Integration Security**

#### **❌ Find client undo implementations with security gaps**
```bash
# Find undo actions in toasts without proper error handling
rg "onClick.*undo|action.*undo" --type tsx src/ -A 10 | rg -v "try.*catch|showError"

# Undo actions should handle failures gracefully

# Find undo implementations without permission checks on client
rg "undo.*onClick|action.*undo" --type tsx src/ -B 5 | rg -v "canCreate|permission.*create"

# Client should check permissions before showing undo actions
```

#### **✅ Required Client Undo Security:**
```typescript
// REQUIRED: Secure client-side undo integration
const handleDelete = React.useCallback(async (id: string) => {
  try {
    await deleteTodo({ data: { id } })
    
    // CRITICAL: Only show undo if user has restore permissions
    const hasCreatePermission = canCreate()
    
    showSuccess(t('messages.deleted'), {
      action: hasCreatePermission ? {
        label: t('actions.undo'),
        onClick: async () => {
          try {
            await undoDeleteTodo({ data: { id } })
            refetch() // Refresh data
            showSuccess(t('messages.restored'))
          } catch (error) {
            // CRITICAL: Handle undo failures gracefully
            showError(error)
            // Refresh on error to ensure UI consistency
            refetch()
          }
        }
      } : undefined // Don't show action if no permission
    })
  } catch (error) {
    showError(error)
  }
}, [canCreate, showSuccess, showError, t, refetch])
```

## 📊 **Phase 11: Enhanced Success Toast Integration Audit**

### **11.1 Find Success Toast Usage Without Action Support**

#### **❌ Find showSuccess calls missing enhanced functionality**
```bash
# Find delete success calls using old showSuccess signature
rg "showSuccess.*delete|showSuccess.*removed" --type ts src/ -B 5 -A 5 | rg -v "action.*\{.*label.*onClick"

# Delete success messages should use enhanced showSuccess with actions

# Find showSuccess function definitions without action parameter support
rg "const showSuccess.*=.*useCallback|function showSuccess" --type ts src/ -A 10 | rg -v "options.*action"

# showSuccess should support action button parameter
```

#### **✅ Required Enhanced Toast Pattern:**
```typescript
// REQUIRED: Enhanced showSuccess with action button support
const showSuccess = useCallback(
  (message: string, options?: { action?: { label: string; onClick: () => void } }) => {
    const translatedMessage = message.includes('.') ? t(message) : message
    
    if (options?.action) {
      toast.success(translatedMessage, {
        action: {
          label: options.action.label,
          onClick: options.action.onClick,
        },
        duration: 10000, // Extended duration for actions
      })
    } else {
      toast.success(translatedMessage)
    }
  },
  [t]
)
```

### **11.2 Translation Coverage for Undo Operations**

#### **❌ Find missing undo translations**
```bash
# Check undo translations exist in all language files
for lang in en es; do
  file="src/i18n/locales/$lang/common.json"
  if [ -f "$file" ]; then
    rg -q '"undo".*:' "$file" || echo "Missing undo translation in $file"
    rg -q '"restored".*:' "$file" || echo "Missing restored translation in $file"  
    rg -q '"deleted".*:' "$file" || echo "Missing deleted translation in $file"
  fi
done

# Should have undo, restored, and deleted translations in all languages
```

## 📋 **Server Function Security Report Template (Updated)**

### **Server Function Security Audit Report**

**Date**: [Audit Date]
**Auditor**: [AI Agent ID]
**Scope**: [Functions Audited Count]

#### **Authentication Security**
- **Server Functions**: X/X properly authenticated
- **API Routes**: X/X with session validation
- **Middleware Chains**: X/X in correct order
- **Method Specifications**: X/X properly defined

#### **Authorization Security**
- **Permission Checks**: X/X operations protected
- **Organization Scoping**: X/X properly scoped
- **Admin Operations**: X/X properly verified
- **Role-Based Access**: ✅/❌ Correctly implemented

#### **Input Security**
- **Validation Coverage**: X/X inputs validated
- **Data Sanitization**: X/X properly sanitized
- **XSS Prevention**: ✅/❌ Implemented
- **SQL Injection Prevention**: ✅/❌ Secure

#### **API Endpoint Security**
- **Authentication**: X/X routes protected
- **Error Handling**: X/X routes secure
- **File Upload Security**: X/X uploads validated
- **Response Sanitization**: X/X responses clean

#### **Soft Delete & Undo Security**
- **Delete Operations**: X/X use soft delete appropriately
- **Undo Functionality**: X/X delete operations have undo support
- **Undo Security**: X/X undo operations properly secured
- **Time Limit Enforcement**: X/X undo operations time-constrained
- **Client Integration**: X/X UI properly integrates undo functionality

#### **Toast Integration Security**
- **Action Button Security**: X/X undo actions properly secured
- **Permission-Aware UI**: X/X actions respect user permissions
- **Error Handling**: X/X undo failures handled gracefully
- **Translation Coverage**: X/X undo messages properly translated

#### **Critical Vulnerabilities Found**
| File | Line | Vulnerability | Risk Level | Impact |
|------|------|--------------|-----------|--------|
| ... | ... | Hard delete on user data | Critical | Permanent data loss |
| ... | ... | Insecure undo operation | High | Cross-tenant access |
| ... | ... | Missing undo functionality | Medium | Poor user experience |

#### **Security Recommendations**
1. [Critical Security Fixes]
2. [Authentication Improvements]
3. [Authorization Enhancements]
4. [Input Validation Strengthening]
5. [Soft Delete Pattern Implementations]
6. [Undo Functionality Security Improvements]

This routine ensures **enterprise-grade API security** with comprehensive soft delete and undo pattern compliance, preventing common backend vulnerabilities, data loss scenarios, and poor user experience patterns that could compromise user data or system integrity.