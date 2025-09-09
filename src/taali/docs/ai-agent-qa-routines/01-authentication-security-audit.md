# Authentication & Security Audit Routine

This document provides a systematic quality assurance routine for AI agents to validate authentication and authorization security across the TanStack SaaS starter template.

## 🎯 **Purpose**

This routine ensures that all authentication and authorization code written by AI agents follows security best practices, maintains proper middleware chains, implements correct permission checks, and prevents common security vulnerabilities.

## 📋 **Pre-Audit Checklist**

Before beginning the audit, ensure:
- [ ] Authentication documentation (`02-authentication-authorization.md`, `13-super-admin-system.md`) is current
- [ ] Access to the entire codebase for security analysis
- [ ] Understanding of the role hierarchy: superadmin → owner → admin → member → viewer

## 🔍 **Phase 1: Authentication Pattern Discovery**

### **1.1 Find All Authentication-Related Files**

Run these commands to discover all files with authentication patterns:

```bash
# Find all server functions
rg "createServerFn" --type ts -l

# Find all middleware usage
rg "middleware.*authMiddleware|organizationMiddleware" --type ts -l

# Find all permission checks
rg "checkPermission" --type ts --type tsx -l

# Find all Better Auth usage
rg "auth\.api\." --type ts --type tsx -l

# Find all role-based checks
rg "role.*===|\.role\b" --type ts --type tsx -l

# Find all session usage
rg "useSession|getSession" --type ts --type tsx -l
```

### **1.2 Categorize by Security Risk Level**

Create file lists by security impact:
- **Critical Security**: Server functions, API routes, middleware
- **High Risk**: Authentication components, permission checks
- **Medium Risk**: Client-side auth hooks, session management
- **Low Risk**: UI components with auth state

## 🛡️ **Phase 2: Critical Security Violations**

### **2.1 Authentication Bypass Detection**

#### **❌ CRITICAL: Find server functions without authentication**
```bash
# Find server functions missing auth middleware
rg "createServerFn.*method.*POST" -A 5 --type ts src/ | rg -v "middleware.*authMiddleware|organizationMiddleware"

# Should return ZERO results for user data operations
```

#### **❌ CRITICAL: Find operations without permission checks**
```bash
# Find protected operations missing checkPermission
rg "createServerFn.*method.*POST" -A 15 --type ts src/ | rg "db\.insert|db\.update|db\.delete" -B 10 | rg -v "checkPermission"

# Should return ZERO results except for validation/utility functions
```

#### **❌ CRITICAL: Find wrong middleware order**
```bash
# Find middleware chains in wrong order
rg "middleware.*\[.*organizationMiddleware.*authMiddleware" --type ts src/

# Should return ZERO results - auth must come before organization
```

### **2.2 Data Isolation Violations**

#### **❌ CRITICAL: Find queries without organization scoping**
```bash
# Find database operations that might bypass organization scoping
rg "db\.select\(\)\.from|db\.insert.*\.values|db\.update.*\.set|db\.delete" --type ts src/ -A 3 -B 1 | rg -v "organizationId"

# Review each result - user data MUST be organization-scoped
```

#### **❌ CRITICAL: Find hardcoded organization access**
```bash
# Find potential organization bypass patterns
rg "context\.user\.id.*eq.*organizationId|eq.*user\.id.*organizationId" --type ts src/

# Should be extremely limited - most access should go through organizationMiddleware
```

### **2.3 Permission System Violations**

#### **❌ CRITICAL: Find direct role checks instead of permissions**
```bash
# Find direct role comparisons (should use permission system)
rg "user\.role.*===|role.*===.*admin|role.*===.*owner" --type ts --type tsx src/

# Should return very few results - use checkPermission() instead
```

#### **❌ CRITICAL: Find admin operations without admin checks**
```bash
# Find potential admin operations without proper checks
rg "delete.*user|update.*user.*role|impersonat|ban.*user" --type ts src/ -B 5 | rg -v "superadmin|admin"

# Should have proper admin role verification
```

## 🔐 **Phase 3: Authentication Flow Analysis**

### **3.1 Middleware Chain Verification**

For each server function, verify:

#### **✅ Required Middleware Patterns:**
```typescript
// REQUIRED for all user data operations:
export const protectedAction = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware]) // Includes authMiddleware internally
  .validator(schema.parse)
  .handler(async ({ context }) => {
    // context.user - authenticated user
    // context.organizationId - validated organization access
  })

// OR for admin operations:
export const adminAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (context.user.role !== 'superadmin') {
      throw AppError.forbidden('Admin access required')
    }
  })
```

#### **✅ Permission Check Patterns:**
```typescript
// REQUIRED before any protected operation:
await checkPermission('resource', ['action'], organizationId)

// Examples:
await checkPermission('todos', ['create'], organizationId)
await checkPermission('billing', ['manage'], organizationId)
await checkPermission('member', ['delete'], organizationId)
```

### **3.2 Session Management Security**

#### **✅ Session Validation Patterns:**
```bash
# Check session handling in API routes
rg "auth\.api\.getSession" --type ts src/routes/api/ -A 5

# Should always check for null session and return 401
```

#### **✅ Session Context Security:**
```bash
# Check session data usage
rg "session\.user|session\.session" --type ts --type tsx src/ -B 2 -A 2

# Should never expose sensitive session data
```

## 👤 **Phase 4: Better Auth Integration Audit**

### **4.1 Better Auth Configuration Compliance**

#### **✅ Plugin Configuration:**
```bash
# Check Better Auth plugin usage
rg "betterAuth.*plugins.*\[" -A 20 --type ts src/lib/auth/

# Should include: magicLink, emailOTP, admin, organization, stripe plugins
```

#### **✅ Access Control Setup:**
```bash
# Check access control configuration
rg "createAccessControl|ac\.newRole" --type ts src/lib/auth/ -A 10

# Should define proper role hierarchy with specific permissions
```

### **4.2 Client-Side Auth Security**

#### **✅ Auth Client Configuration:**
```bash
# Check auth client plugin matching
rg "createAuthClient.*plugins" -A 10 --type ts src/lib/auth/

# Should match server-side plugins exactly
```

#### **✅ Hook Usage Patterns:**
```bash
# Check proper auth hook usage
rg "useSession|useUpdateUser|useListOrganizations" --type tsx src/ -B 2 -A 2

# Should use hooks from auth-hooks, not direct client calls
```

## 🧪 **Phase 5: Security Testing Verification**

### **5.1 Authentication Test Coverage**

Check that security scenarios are tested:

```bash
# Find authentication tests
rg "describe.*auth|it.*auth.*should.*require" --type ts src/

# Should cover: unauthorized access, invalid tokens, expired sessions
```

### **5.2 Permission Test Coverage**

```bash
# Find permission tests  
rg "describe.*permission|it.*should.*check.*permission" --type ts src/

# Should cover: insufficient permissions, role changes, organization switching
```

## 📋 **Security Audit Report Template**

### **Authentication & Security Audit Report**

**Date**: [Audit Date]
**Auditor**: [AI Agent ID]
**Scope**: [Files Audited Count]

#### **Critical Security Analysis**
- **Authentication Bypass**: X violations
- **Permission Bypass**: X violations  
- **Data Isolation**: X violations
- **Middleware Chain**: X violations

#### **Better Auth Integration**
- **Plugin Configuration**: ✅/❌ Compliant
- **Role Hierarchy**: ✅/❌ Properly Defined
- **Access Control**: ✅/❌ Correctly Implemented
- **Client/Server Sync**: ✅/❌ Consistent

#### **Security Test Coverage**
- **Authentication Tests**: X% coverage
- **Permission Tests**: X% coverage
- **Data Isolation Tests**: X% coverage

#### **High Priority Security Fixes**
| File | Line | Vulnerability | Severity | Impact |
|------|------|--------------|----------|--------|
| ... | ... | ... | ... | ... |

#### **Recommendations**
1. [Critical Security Fixes]
2. [Permission System Improvements]
3. [Authentication Flow Enhancements]

---

## 🔐 **Additional QA Routines Needed:**

### **Multi-Tenancy Data Isolation Audit** (`multi-tenancy-isolation-audit.md`)
- Organization scoping verification
- Cross-tenant data access prevention
- Context switching security
- Storage isolation (sessionStorage vs localStorage)

### **Database Query Security Audit** (`database-security-audit.md`)  
- SQL injection prevention
- Organization scoping in all queries
- Foreign key constraint verification
- Proper transaction usage

### **UI Component Standards Audit** (`ui-component-standards-audit.md`)
- Import path consistency (@/ui alias usage)
- CVA pattern compliance
- Accessibility requirements
- Component architecture standards

### **Form Security Audit** (`form-security-audit.md`)
- Input validation coverage
- XSS prevention
- CSRF protection
- File upload security

### **API Security Audit** (`api-security-audit.md`)
- Input validation on all endpoints
- Rate limiting implementation
- Response sanitization
- Error information leakage

Each routine follows the systematic approach with discovery, pattern verification, anti-pattern detection, and comprehensive reporting.