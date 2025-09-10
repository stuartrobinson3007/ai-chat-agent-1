# Multi-Tenancy Data Isolation Audit Routine

This document provides a systematic quality assurance routine for AI agents to validate multi-tenant data isolation, organization scoping, and secure data access patterns in the TanStack SaaS starter template.

## 🎯 **Purpose**

This routine ensures that all code written by AI agents properly implements organization-based data isolation, prevents cross-tenant data access, maintains proper organization context, and follows secure multi-tenancy patterns.

## 📋 **Pre-Audit Checklist**

Before beginning the audit, ensure:
- [ ] Multi-tenancy documentation (`04-multi-tenancy-implementation.md`) is current
- [ ] Understanding of organization-scoped data model
- [ ] Access to database schema and all data access patterns

## 🔍 **Phase 1: Data Model Discovery**

### **1.1 Find All User Data Tables**

Run these commands to discover all tables that should be organization-scoped:

```bash
# Find all database table definitions
rg "export const.*=.*pgTable" --type ts src/database/schema.ts -A 10

# Find all user-related data operations
rg "db\.insert|db\.update|db\.delete|db\.select" --type ts src/ -l

# Find all organizationId references
rg "organizationId" --type ts src/ -l

# Find potential unscoped user data
rg "createdBy.*user\.id|userId.*user\.id" --type ts src/ -B 3 -A 3
```

### **1.2 Identify Critical Data Access Points**

Categorize by data sensitivity:
- **User Content**: todos, projects, documents, messages
- **Team Data**: members, invitations, roles
- **Billing Data**: subscriptions, usage, payments  
- **Admin Data**: audit logs, system settings

## 🏢 **Phase 2: Organization Scoping Verification**

### **2.1 Database Schema Compliance**

#### **❌ CRITICAL: Find tables missing organizationId**
```bash
# Check all user data tables include organizationId
rg "export const.*=.*pgTable.*\(" -A 20 --type ts src/database/schema.ts | rg -v "organization.*=.*pgTable" | rg -v "user.*=.*pgTable" | rg -v "account.*=.*pgTable" | rg -v "session.*=.*pgTable" | rg -v "verification.*=.*pgTable" | rg -v "organizationId"

# Should return ZERO user data tables without organizationId
```

#### **❌ CRITICAL: Find missing foreign key constraints**
```bash
# Check organizationId fields have proper references
rg "organizationId.*text.*organization_id" -A 3 --type ts src/database/schema.ts | rg -v "references.*organization\.id"

# Should return ZERO - all organizationId fields must reference organization.id
```

### **2.2 Query Scoping Verification**

#### **❌ CRITICAL: Find unscoped database queries**
```bash
# Find queries that might bypass organization scoping
rg "db\.select\(\)\.from.*todos|db\.select\(\)\.from.*members|db\.select\(\)\.from.*invitations" --type ts src/ -B 2 -A 5 | rg -v "eq.*organizationId"

# Should return ZERO - all user data queries must include organization scoping
```

#### **❌ CRITICAL: Find unsafe update/delete operations**
```bash
# Find update/delete operations without organization scoping
rg "db\.update|db\.delete" --type ts src/ -A 5 -B 2 | rg -v "and.*eq.*organizationId|where.*eq.*organizationId"

# Review each result - user data updates must include organizationId in WHERE clause
```

### **2.3 Server Function Organization Context**

#### **❌ CRITICAL: Find missing organizationMiddleware**
```bash
# Find server functions that handle user data without organization middleware
rg "createServerFn.*method.*POST" -A 10 --type ts src/ | rg "insert.*todos|update.*todos|delete.*todos" -B 5 | rg -v "organizationMiddleware"

# Should return ZERO - all user data operations need organization context
```

#### **❌ CRITICAL: Find missing organization validation**
```bash
# Find handlers that don't validate organizationId exists
rg "handler.*async.*\{" -A 10 --type ts src/ | rg "organizationId.*context" -A 5 | rg -v "if.*!.*orgId|if.*!.*organizationId"

# User data handlers should validate organizationId exists
```

## 🔒 **Phase 3: Access Control Verification**

### **3.1 Membership Validation Patterns**

#### **✅ Required Organization Membership Validation:**
```typescript
// REQUIRED pattern in organizationMiddleware:
const membership = await db
  .select()
  .from(member)
  .where(and(
    eq(member.userId, context.user.id), 
    eq(member.organizationId, orgId)
  ))
  .limit(1)

if (membership.length === 0) {
  // User is not a member - access denied
}
```

#### **✅ Organization Context Validation:**
```bash
# Check organization context validation
rg "if.*!.*organizationId.*throw|!.*orgId.*throw" --type ts src/ -B 2 -A 2

# Should consistently validate organization context exists
```

### **3.2 Cross-Organization Access Prevention**

#### **❌ CRITICAL: Find potential cross-organization data access**
```bash
# Find operations that might access other organizations' data
rg "eq.*todos\.id.*data\.id" --type ts src/ -B 5 -A 5 | rg -v "and.*eq.*organizationId"

# Should return ZERO - all user data access must include organization scoping
```

#### **❌ CRITICAL: Find missing ownership validation**
```bash
# Find update/delete operations without ownership verification
rg "update.*todos|delete.*todos" --type ts src/ -B 10 -A 5 | rg -v "existing.*todo.*organizationId|verify.*organization"

# Updates/deletes should verify resource belongs to current organization
```

## 📱 **Phase 4: Client-Side Context Security**

### **4.1 Organization Context Management**

#### **❌ CRITICAL: Find localStorage usage for organization state**
```bash
# Find improper organization state storage
rg "localStorage.*organization|localStorage.*setItem.*org" --type tsx src/

# Should use sessionStorage for tab-specific organization context
```

#### **✅ Required Organization Context Patterns:**
```typescript
// REQUIRED: Tab-specific storage usage
sessionStorage.setItem('activeOrganizationId', organizationId)
localStorage.setItem('activeOrganizationId', organizationId) // Fallback only

// REQUIRED: Context validation
const { activeOrganization, activeOrganizationId } = useActiveOrganization()
if (!activeOrganizationId) {
  return <div>Please select an organization</div>
}
```

### **4.2 Organization Switching Security**

#### **❌ CRITICAL: Find organization switching without validation**
```bash
# Find organization switching without membership validation
rg "setActiveOrganization|setActiveOrganizationId" --type tsx src/ -B 5 -A 5 | rg -v "membership|organizations\.find"

# Should validate user belongs to organization before switching
```

## 🗃️ **Phase 5: Storage & Session Security**

### **5.1 Session Storage Patterns**

#### **✅ Required Storage Patterns:**
```bash
# Check proper storage usage
rg "sessionStorage.*activeOrganizationId" --type tsx src/

# Should be primary storage for organization context
```

#### **✅ Cross-Tab Synchronization:**
```bash
# Check cross-tab organization sync
rg "addEventListener.*storage|CustomEvent.*org-changed" --type tsx src/

# Should handle organization changes across tabs safely
```

### **5.2 Session Security Verification**

#### **❌ CRITICAL: Find session data exposure**
```bash
# Find potential session data leakage
rg "session\.|user\.email|user\.id" --type tsx src/ -B 2 -A 2 | rg "console\.log|alert\(|innerHTML"

# Should return ZERO - never log or expose session data in production
```

## 🧪 **Phase 6: Multi-Tenancy Testing Verification**

### **6.1 Data Isolation Test Coverage**

Check that critical scenarios are tested:

```bash
# Find multi-tenancy tests
rg "describe.*organization|describe.*isolation|it.*should.*only.*organization" --type ts src/

# Should cover: data isolation, cross-organization access prevention, membership validation
```

### **6.2 Organization Switching Tests**

```bash
# Find organization context tests
rg "describe.*context|it.*should.*switch.*organization" --type ts src/

# Should cover: context switching, membership validation, storage updates
```

## 📊 **Phase 7: Advanced Security Patterns**

### **7.1 Bulk Operation Security**

#### **❌ CRITICAL: Find bulk operations without organization validation**
```bash
# Find bulk operations that might process cross-organization data
rg "inArray.*ids|map.*async.*id" --type ts src/ -B 5 -A 10 | rg -v "organizationId.*eq"

# Bulk operations must verify all items belong to current organization
```

### **7.2 API Route Organization Security**

#### **❌ CRITICAL: Find API routes without organization validation**
```bash
# Check file-based API routes
rg "createServerFileRoute" --type ts src/routes/api/ -A 15 | rg -v "getSession|organizationId"

# API routes handling user data should validate organization context
```

## 📋 **Multi-Tenancy Audit Report Template**

### **Multi-Tenancy Data Isolation Audit Report**

**Date**: [Audit Date]
**Auditor**: [AI Agent ID]
**Scope**: [Files Audited Count]

#### **Data Isolation Analysis**
- **User Data Tables**: X/X properly scoped
- **Database Queries**: X/X organization-scoped
- **Server Functions**: X/X using organization middleware
- **API Routes**: X/X validating organization context

#### **Access Control Verification**
- **Membership Validation**: ✅/❌ Implemented
- **Cross-Organization Prevention**: ✅/❌ Secure
- **Permission Checks**: X/X operations protected
- **Role Hierarchy**: ✅/❌ Properly enforced

#### **Client-Side Security**
- **Storage Patterns**: ✅/❌ Tab-specific implementation
- **Context Validation**: ✅/❌ Proper organization checking
- **Session Management**: ✅/❌ Secure session handling
- **Organization Switching**: ✅/❌ Validated membership

#### **Critical Vulnerabilities Found**
| File | Line | Vulnerability | Risk Level | Impact |
|------|------|--------------|-----------|--------|
| ... | ... | ... | ... | ... |

#### **Security Recommendations**
1. [Critical Security Fixes]
2. [Access Control Improvements]
3. [Data Isolation Enhancements]

---

## 🚀 **Usage Instructions for AI Agents**

1. **Run this audit** after implementing any multi-tenant data operations
2. **Follow phases sequentially** to ensure complete security coverage
3. **Fix critical vulnerabilities immediately** before proceeding
4. **Validate organization scoping** in all user data operations
5. **Test data isolation** with multiple organizations

This routine ensures **zero data leakage** between organizations and maintains enterprise-grade multi-tenancy security standards.