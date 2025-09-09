# Error Handling Consistency Audit Routine

This document provides a systematic quality assurance routine for AI agents to validate error handling consistency across backend and frontend implementations in the TanStack SaaS starter template.

## 🎯 **Purpose**

This routine ensures that all code written by AI agents follows the established error handling patterns, maintains consistency between backend and frontend, and adheres to the documented standards for error management, user feedback, and translation support.

## 📋 **Pre-Audit Checklist**

Before beginning the audit, ensure:
- [ ] All documentation files have been reviewed and understood
- [ ] Error handling documentation (`10-error-handling-workflow-file-management.md`, `16-enhanced-error-management.md`) is current
- [ ] Access to the entire codebase for comprehensive analysis

## 🔍 **Phase 1: Complete File Discovery**

### **1.1 Find All Error-Related Files**

Run these commands to discover all files with error handling:

```bash
# Find all files that throw errors
rg "throw " --type ts --type tsx -l

# Find all files with try/catch blocks  
rg "try\s*\{" --type ts --type tsx -l

# Find all files importing error classes
rg "import.*AppError|ValidationError|PermissionError" --type ts --type tsx -l

# Find all files using error codes
rg "ERROR_CODES\." --type ts --type tsx -l

# Find all files using error handler hooks
rg "useErrorHandler|showError|showSuccess" --type ts --type tsx -l

# Find all files with toast usage
rg "toast\." --type ts --type tsx -l

# Find all server functions
rg "createServerFn" --type ts -l

# Find all mutations
rg "useMutation" --type tsx -l
```

### **1.2 Categorize Discovered Files**

Create file lists by category:
- **Backend Files**: `.server.ts`, `/routes/api/`, middleware files
- **Frontend Files**: `.tsx` components, hooks, pages
- **Shared Files**: Utilities, validation, error classes

## 🖥️ **Phase 2: Backend Error Consistency Audit**

### **2.1 Server Functions Analysis**

For each server function file, verify:

#### **✅ Required Patterns:**
```bash
# Check all server functions use AppError (not generic Error)
rg "throw new Error" --type ts src/

# Should return ZERO results. If any found, they need to be converted to AppError
```

#### **✅ Validation Error Patterns:**
```typescript
// REQUIRED pattern in all server function validators:
.validator((data: unknown) => {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fields: Record<string, string[]> = {}
      error.issues.forEach((err: z.ZodIssue) => {
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
```

#### **✅ Permission Error Patterns:**
```bash
# Check all protected operations use checkPermission
rg "createServerFn.*method.*POST" -A 10 --type ts src/ | rg "checkPermission"

# Verify pattern: await checkPermission('resource', ['action'], organizationId)
```

#### **✅ Organization Scoping Errors:**
```bash
# Check organization context validation
rg "organizationId.*context" --type ts src/

# Should include error handling for missing organizationId
```

### **2.2 API Routes Analysis**

For each API route file, verify:

#### **✅ Authentication Error Handling:**
```typescript
// REQUIRED pattern:
const session = await auth.api.getSession({ headers: request.headers })
if (!session?.user) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}
```

#### **✅ Error Response Format:**
```typescript
// REQUIRED pattern for error responses:
return Response.json({
  error: error instanceof Error ? error.message : 'Internal server error',
}, { status: 500 })
```

### **2.3 Middleware Error Handling**

Check each middleware file:
- [ ] Proper error throwing with `AppError`
- [ ] Consistent error context passing
- [ ] No generic error handling

## 🎨 **Phase 3: Frontend Error Consistency Audit**

### **3.1 Component Error Handling**

For each component file, verify:

#### **✅ Form Error Boundaries:**
```bash
# Check all forms use FormErrorBoundary
rg "<form" --type tsx src/ -A 5 -B 5 | rg "FormErrorBoundary"

# Should wrap all form implementations
```

#### **✅ Error Handler Usage:**
```bash
# Check components use useErrorHandler hook
rg "useErrorHandler" --type tsx src/ -l
```

### **3.2 Mutation Error Patterns**

For each mutation implementation, verify:

#### **✅ Required Mutation Error Handling:**
```typescript
// REQUIRED pattern:
const mutation = useMutation({
  mutationFn: serverFunction,
  onSuccess: (data) => {
    showSuccess('Operation completed successfully')
  },
  onError: showError, // OR proper error handling
})
```

#### **✅ Form Mutation Integration:**
```bash
# Check useFormMutation usage
rg "useFormMutation" --type tsx src/

# Verify proper setError integration
```

### **3.3 Component Error Display**

Check error display patterns:

#### **✅ Toast vs Form Error Routing:**
```bash
# Check proper error categorization usage
rg "getErrorDisplayType" --type tsx src/

# Check conditional error display
rg "displayType.*===.*toast" --type tsx src/
```

## 🔄 **Phase 4: Cross-System Consistency**

### **4.1 Error Code Coverage Analysis**

#### **✅ Error Code Definition vs Usage:**
```bash
# List all defined error codes
rg "ERROR_CODES\s*=" -A 50 src/lib/errors/codes.ts

# Find all error code usage
rg "ERROR_CODES\.[A-Z_]+" --type ts --type tsx src/ -o | sort | uniq

# Compare lists to find unused codes
```

#### **✅ Translation Coverage:**
```bash
# Check all error codes have translations
rg '"[A-Z_]+"' src/i18n/locales/en/errors.json -o | sort | uniq

# Cross-reference with ERROR_CODES usage
```

### **4.2 Validation Error Consistency**

#### **✅ Server vs Client Validation:**
```bash
# Find all validation schemas
rg "z\.object\(" --type ts src/ -A 10

# Check corresponding client-side usage
rg "zodResolver|useForm.*resolver" --type tsx src/
```

### **4.3 Permission Error Patterns**

#### **✅ Consistent Permission Checking:**
```bash
# Check all checkPermission usage follows pattern
rg "checkPermission.*resource.*action.*organizationId" --type ts src/

# Verify PermissionError handling
rg "PermissionError" --type ts src/ -B 2 -A 2
```

## 🚨 **Phase 5: Anti-Pattern Detection**

### **5.1 Violation Search Patterns**

Run these searches to find violations:

```bash
# Generic error throwing (VIOLATION)
rg "throw new Error\(" --type ts --type tsx src/

# Missing error codes (VIOLATION)  
rg "new AppError\(['\"].*['\"]" --type ts src/

# Hardcoded error messages (VIOLATION)
rg "throw.*Error.*['\"].*['\"]" --type ts src/

# Missing validation (VIOLATION)
rg "createServerFn.*method.*POST" -A 10 --type ts src/ | rg -v "validator"

# Missing error boundaries (VIOLATION)
rg "<form" --type tsx src/ -A 5 -B 5 | rg -v "FormErrorBoundary"

# Direct toast usage without error handler (VIOLATION)
rg "toast\.(error|success)" --type tsx src/ | rg -v "useErrorHandler"

# Missing permission checks (VIOLATION)
rg "createServerFn.*method.*POST" -A 20 --type ts src/ | rg -v "checkPermission" | rg "organizationMiddleware"

# Useless try/catch blocks (VIOLATION)
rg "try.*\{.*\}.*catch.*\{.*throw" --type ts --type tsx src/
```

### **5.2 Pattern Compliance Verification**

For each discovered violation:
- [ ] Document the file and line number
- [ ] Identify the pattern violation
- [ ] Provide the correct implementation
- [ ] Verify fix aligns with documentation

## 📊 **Phase 6: Quality Verification**

### **6.1 End-to-End Error Flow Testing**

Verify complete error flows:

#### **✅ Server Error → Client Display:**
```typescript
// Server: throw AppError with code
// Client: parseError() → translateError() → showError() → toast display
```

#### **✅ Validation Error → Form Field:**
```typescript
// Server: ValidationError with field mapping
// Client: useFormField() → field-specific error display
```

#### **✅ Permission Error → Actionable Toast:**
```typescript
// Server: PermissionError → action suggestions
// Client: toast with upgrade/login buttons
```

### **6.2 Translation Completeness**

Verify all error scenarios have proper translations:
- [ ] All ERROR_CODES have entries in `errors.json`
- [ ] All action types have entries in `errors:actions.*`
- [ ] All validation keys have entries in `validation.json`
- [ ] Fallback messages exist for all error types

## 📋 **Audit Report Template**

### **Error Handling Consistency Audit Report**

**Date**: [Audit Date]
**Auditor**: [AI Agent ID]
**Scope**: [Files Audited Count]

#### **Summary**
- **Total Files Audited**: X
- **Violations Found**: X
- **Consistency Score**: X%
- **Critical Issues**: X
- **Minor Issues**: X

#### **Backend Analysis**
- **Server Functions**: X/X compliant
- **API Routes**: X/X compliant  
- **Middleware**: X/X compliant

#### **Frontend Analysis**
- **Components**: X/X compliant
- **Mutations**: X/X compliant
- **Forms**: X/X compliant

#### **Cross-System Analysis**
- **Error Code Coverage**: X%
- **Translation Coverage**: X%
- **Pattern Consistency**: X%

#### **Violations Found**
| File | Line | Violation Type | Severity | Fix Required |
|------|------|---------------|----------|--------------|
| ... | ... | ... | ... | ... |

#### **Recommendations**
1. [High Priority Fixes]
2. [Medium Priority Improvements]  
3. [Low Priority Enhancements]

---

## 🚀 **Usage Instructions for AI Agents**

1. **Run this audit** after implementing any error handling code
2. **Follow the phases sequentially** to ensure complete coverage
3. **Document all violations** using the report template
4. **Fix critical issues immediately** before proceeding
5. **Update documentation** if new patterns are established

This routine ensures **zero error handling inconsistencies** in the codebase and maintains the high quality standards established in the documentation.