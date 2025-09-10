# Form Security Audit Routine

This document provides a systematic quality assurance routine for AI agents to validate form security, input validation, XSS prevention, and form architecture patterns in the TanStack SaaS starter template.

## 🎯 **Purpose**

This routine ensures that all form implementations written by AI agents follow security best practices, prevent XSS attacks, implement proper validation, maintain error boundary protection, and use secure form submission patterns.

## 📋 **Pre-Audit Checklist**

Before beginning the audit, ensure:
- [ ] Form documentation (`11-advanced-form-system.md`) is current
- [ ] Understanding of FormErrorBoundary and form security patterns
- [ ] Access to all form implementations and validation logic

## 🔍 **Phase 1: Form Implementation Discovery**

### **1.1 Find All Form Components**

Run these commands to discover all form-related code:

```bash
# Find all form elements
rg "<form|useForm\(|FormField|FormControl" --type tsx -l

# Find all form error boundaries
rg "FormErrorBoundary" --type tsx -l

# Find all form mutations
rg "useFormMutation|useMutation.*form" --type tsx -l

# Find all form validation
rg "zodResolver|form\.formState|form\.setError" --type tsx -l

# Find all input components
rg "<input|<textarea|<select" --type tsx -l
```

### **1.2 Categorize by Security Risk**

Create form lists by security impact:
- **Critical Security**: Authentication forms, payment forms, admin forms
- **High Risk**: User data forms, file upload forms, settings forms
- **Medium Risk**: Search forms, filter forms, preference forms
- **Low Risk**: Static forms, display-only forms

## 🛡️ **Phase 2: Form Error Boundary Security**

### **2.1 Error Boundary Coverage Verification**

#### **❌ CRITICAL: Find forms without error boundaries**
```bash
# Find form elements without FormErrorBoundary wrapper
rg "<form" --type tsx src/ -B 10 -A 5 | rg -v "FormErrorBoundary"

# Should return ZERO critical forms - all forms need error boundary protection

# Find useForm without error boundary context
rg "useForm\(" --type tsx src/ -B 10 | rg -v "FormErrorBoundary|ErrorBoundary"

# Forms should be wrapped in error boundaries
```

#### **✅ Required Error Boundary Patterns:**
```typescript
// REQUIRED: Form error boundary wrapper
import { FormErrorBoundary } from '@/components/form'

function MyForm() {
  return (
    <FormErrorBoundary
      onError={(error) => logError(error)}
      showToast={true}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* Form fields */}
        </form>
      </Form>
    </FormErrorBoundary>
  )
}
```

### **2.2 Form Error Display Security**

#### **❌ CRITICAL: Find unsafe error display**
```bash
# Find error display that might expose sensitive information
rg "error\.message|error\.stack|console\.error.*error\)" --type tsx src/ -B 2 -A 2 | rg -v "process\.env\.NODE_ENV.*development"

# Error messages should not expose internal details in production

# Find form errors without proper sanitization
rg "dangerouslySetInnerHTML.*error|innerHTML.*error" --type tsx src/

# Should return ZERO - no unsafe HTML injection of errors
```

## 🔐 **Phase 3: Input Validation Security**

### **3.1 XSS Prevention Verification**

#### **❌ CRITICAL: Find potential XSS vulnerabilities**
```bash
# Find unsafe HTML rendering
rg "dangerouslySetInnerHTML|innerHTML.*=|outerHTML.*=" --type tsx src/

# Should return ZERO results - no unsafe HTML injection

# Find unescaped user input rendering
rg "\{user\.|data\.|input\." --type tsx src/ -B 2 -A 2 | rg -v "escape|sanitize|t\("

# User input should be sanitized or use translation system
```

#### **✅ Required XSS Prevention:**
```typescript
// REQUIRED: Safe user input rendering
{user.name} // ✅ React automatically escapes
{t('message', { userName: user.name })} // ✅ Translation system sanitizes

// DANGEROUS: Unsafe patterns (NEVER DO THIS)
// <div dangerouslySetInnerHTML={{ __html: userInput }} />
// element.innerHTML = userInput
```

### **3.2 Input Sanitization Patterns**

#### **❌ CRITICAL: Find unsanitized form inputs**
```bash
# Find form fields without proper validation
rg "<input.*value.*\{|<textarea.*value.*\{" --type tsx src/ -B 5 | rg -v "control.*field|\.\.\.field"

# Form inputs should use controlled React Hook Form patterns

# Find direct form submission without validation
rg "onSubmit.*=.*\{|handleSubmit.*\(" --type tsx src/ -A 5 | rg -v "form\.handleSubmit|zodResolver"

# Form submission should use React Hook Form with validation
```

#### **✅ Required Input Security:**
```typescript
// REQUIRED: Controlled form inputs with validation
<FormField
  control={form.control}
  name="title"
  render={({ field }) => (
    <FormItem>
      <FormControl>
        <Input {...field} /> {/* Controlled and validated */}
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>

// REQUIRED: Form submission with validation
const form = useForm<FormData>({
  resolver: zodResolver(formSchema), // Client-side validation
  mode: 'onChange'
})

const onSubmit = form.handleSubmit(async (data) => {
  // data is validated before reaching here
  await submitMutation.mutateAsync(data)
})
```

## 🚫 **Phase 4: CSRF Protection Audit**

### **4.1 CSRF Vulnerability Detection**

#### **❌ CRITICAL: Find state-changing operations without CSRF protection**
```bash
# Find POST operations that might be vulnerable to CSRF
rg "method.*POST|method.*PUT|method.*DELETE" --type ts src/ -B 5 -A 10 | rg -v "headers.*request\.headers|csrf|samesite"

# State-changing operations should have CSRF protection

# Find cookie settings without proper security
rg "cookie|session" --type ts src/ -B 2 -A 5 | rg -v "httpOnly|secure|sameSite"

# Cookies should have proper security attributes
```

#### **✅ Required CSRF Protection:**
```typescript
// REQUIRED: Better Auth provides CSRF protection
// Ensure all server functions use proper headers
export const secureAction = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    // Better Auth middleware validates CSRF tokens automatically
    // context.headers contains validated request headers
  })
```

### **4.2 Form Submission Security**

#### **❌ CRITICAL: Find insecure form submissions**
```bash
# Find forms submitting to external URLs
rg "action.*=.*http|action.*=.*\/\/|method.*post.*action" --type tsx src/

# Should return ZERO - forms should submit to internal server functions

# Find form data serialization issues
rg "JSON\.stringify.*form|form.*serialize" --type tsx src/ -B 2 -A 2

# Should use proper form data handling
```

## 📤 **Phase 5: File Upload Security**

### **5.1 File Upload Validation**

#### **❌ CRITICAL: Find file uploads without proper validation**
```bash
# Find file upload handling
rg "File\(|formData\.get.*file|input.*type.*file" --type ts --type tsx src/ -A 10

# Should include: type validation, size limits, content validation

# Find image uploads without content validation
rg "sharp\(|image.*process|avatar.*upload" --type ts src/ -A 10 | rg -v "validateImage|allowedTypes"

# Image uploads should validate file content beyond MIME type
```

#### **✅ Required File Upload Security:**
```typescript
// REQUIRED: Comprehensive file validation
const file = formData.get('file') as File

// 1. Type validation
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
if (!allowedTypes.includes(file.type)) {
  throw new AppError('VAL_INVALID_FILE_TYPE', 400, { allowedTypes })
}

// 2. Size validation  
const maxSize = 10 * 1024 * 1024 // 10MB
if (file.size > maxSize) {
  throw new AppError('VAL_FILE_TOO_LARGE', 400, { maxSize: maxSize / 1024 / 1024 })
}

// 3. Content validation
const buffer = Buffer.from(await file.arrayBuffer())
const isValid = await ImageProcessor.validateImage(buffer)
if (!isValid) {
  throw new AppError('VAL_INVALID_IMAGE', 400)
}
```

## 🔍 **Phase 6: Form State Security**

### **6.1 Sensitive Data Handling**

#### **❌ CRITICAL: Find sensitive data in form state**
```bash
# Find password/token handling in forms
rg "password.*useState|token.*useState|secret.*useState" --type tsx src/

# Should return ZERO - sensitive data should not be in React state

# Find sensitive data in form default values
rg "defaultValues.*password|defaultValues.*token" --type tsx src/

# Should not include sensitive data in defaults
```

#### **✅ Required Sensitive Data Patterns:**
```typescript
// REQUIRED: Secure password handling
const form = useForm<LoginData>({
  resolver: zodResolver(loginSchema),
  defaultValues: {
    email: '',
    password: '', // Empty default only
  }
})

// REQUIRED: Clear sensitive data after submission
const onSubmit = async (data: LoginData) => {
  try {
    await loginMutation.mutateAsync(data)
    form.reset() // Clear form including password
  } catch (error) {
    // Show error without exposing password
  }
}
```

### **6.2 Form Persistence Security**

#### **❌ CRITICAL: Find sensitive data in localStorage/sessionStorage**
```bash
# Find form data being stored insecurely
rg "localStorage.*form|sessionStorage.*form|localStorage.*password" --type tsx src/

# Should return ZERO - no sensitive data in browser storage

# Find autosave with sensitive fields
rg "useFormAutosave" --type tsx src/ -A 10 | rg "password|token|secret"

# Autosave should exclude sensitive fields
```

## 🧪 **Phase 7: Form Testing Security**

### **7.1 Security Test Coverage**

Check that form security is tested:

```bash
# Find form security tests
rg "describe.*form.*security|it.*should.*prevent.*xss|it.*should.*validate" --type ts src/

# Should cover: XSS prevention, input validation, CSRF protection

# Find input validation tests
rg "describe.*validation|it.*should.*reject.*invalid" --type ts src/

# Should cover: malicious inputs, edge cases, boundary conditions
```

## 📋 **Form Security Report Template**

### **Form Security Audit Report**

**Date**: [Audit Date]
**Auditor**: [AI Agent ID]
**Scope**: [Forms Audited Count]

#### **Error Boundary Protection**
- **Forms with Boundaries**: X/X forms protected
- **Error Display Security**: ✅/❌ Safe error rendering
- **Sensitive Data Exposure**: X violations found

#### **Input Validation Security**
- **XSS Prevention**: ✅/❌ No unsafe HTML injection
- **Input Sanitization**: X/X inputs properly validated
- **Client Validation**: X/X forms with zodResolver
- **Server Validation**: X/X endpoints validated

#### **File Upload Security**  
- **Type Validation**: X/X uploads validated
- **Size Limits**: X/X uploads limited
- **Content Validation**: X/X uploads content-checked
- **Processing Security**: ✅/❌ Safe image processing

#### **Form State Security**
- **Sensitive Data**: X violations found
- **Storage Security**: ✅/❌ No sensitive data persisted
- **State Cleanup**: X/X forms clear sensitive data
- **Autosave Security**: ✅/❌ Excludes sensitive fields

#### **Critical Security Issues**
| File | Line | Vulnerability | Risk Level | Impact |
|------|------|--------------|-----------|--------|
| ... | ... | ... | ... | ... |

#### **Form Security Recommendations**
1. [XSS Prevention Fixes]
2. [Input Validation Improvements]
3. [Error Boundary Coverage]
4. [Sensitive Data Protection]

---

## 🚀 **Usage Instructions for AI Agents**

1. **Run this audit** after implementing any form functionality
2. **Verify error boundary protection** for all user-facing forms
3. **Check input validation** on both client and server sides
4. **Test XSS prevention** with malicious input scenarios
5. **Validate file upload security** with comprehensive checks

This routine ensures **bulletproof form security** and prevents common web application vulnerabilities that could compromise user data or application integrity.