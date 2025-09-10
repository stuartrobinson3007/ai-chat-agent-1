# Validation System Consistency Audit Routine

This document provides a systematic quality assurance routine for AI agents to validate input validation patterns, schema consistency, validation registry usage, and security compliance across the TanStack SaaS starter template.

## 🎯 **Purpose**

This routine ensures that all validation code written by AI agents follows centralized validation patterns, prevents validation rule duplication, implements proper client/server validation separation, and maintains consistent validation messaging.

## 📋 **Pre-Audit Checklist**

Before beginning the audit, ensure:
- [ ] Validation documentation (`12-validation-architecture.md`) is current
- [ ] Understanding of validation registry patterns
- [ ] Access to all validation schemas and validation usage

## 🔍 **Phase 1: Validation Pattern Discovery**

### **1.1 Find All Validation Usage**

Run these commands to discover all validation code:

```bash
# Find all Zod schema definitions
rg "z\.object\(|z\.string\(|z\.number\(|z\.boolean\(" --type ts -l

# Find all validation registry usage
rg "validationRules\.|validationMessages\." --type ts -l

# Find all server function validators
rg "\.validator\(" --type ts -l

# Find all form validation (zodResolver)
rg "zodResolver|useForm.*resolver" --type tsx -l

# Find all async validation
rg "useAsyncFieldValidator|async.*validation" --type ts --type tsx -l
```

### **1.2 Categorize Validation Types**

Create validation lists by category:
- **Schema Definitions**: Entity schemas (user, todo, organization)
- **Server Validators**: Server function input validation
- **Client Forms**: Frontend form validation with React Hook Form
- **Async Validation**: Real-time field validation (uniqueness, availability)
- **Database Constraints**: Server-side constraint checking

## 📐 **Phase 2: Validation Registry Compliance**

### **2.1 Validation Rule Duplication Detection**

#### **❌ CRITICAL: Find duplicate validation rules**
```bash
# Find potential validation rule duplication
rg "z\.string\(\)\.min\(1\)\.max\(|z\.string\(\)\.email\(\)" --type ts src/ -B 2 -A 2

# Look for identical validation patterns across multiple files

# Find hardcoded validation rules not using registry
rg "z\.string\(\)\.min.*max|z\.number\(\)\.min.*max" --type ts src/ -B 5 | rg -v "validationRules\."

# Should use validation registry for common patterns
```

#### **✅ Required Registry Usage Patterns:**
```typescript
// REQUIRED: Use validation registry for consistent rules
import { validationRules } from '@/lib/validation/validation-registry'

const todoSchema = z.object({
  title: validationRules.todo.title,        // Centralized rule
  description: validationRules.todo.description, // Consistent across app
})

// REQUIRED: Extend registry for new entities
export const validationRules = {
  todo: {
    title: z.string().min(1).max(500),
    description: z.string().optional(),
  },
  organization: {
    name: z.string().min(1).max(100),
    slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
  },
}
```

### **2.2 Validation Message Consistency**

#### **❌ CRITICAL: Find hardcoded validation messages**
```bash
# Find validation schemas with hardcoded messages
rg "z\.string\(\)\.min.*['\"].*['\"]|z\.email\(.*['\"].*['\"]" --type ts src/

# Should return ZERO - use validation message utilities

# Find inconsistent validation message patterns
rg "required|is required|field.*required" --type ts src/ | rg -v "validationMessages|t\("

# Should use consistent message patterns
```

#### **✅ Required Message Patterns:**
```typescript
// REQUIRED: Use validation message utilities
import { validationMessages as vm } from '@/lib/validation/validation-messages'

const schema = z.object({
  title: z.string().min(1, vm.todo.title.required),
  email: z.string().email(vm.common.email.invalid),
})

// REQUIRED: Translation key patterns
const validationMessages = {
  todo: {
    title: {
      required: 'VAL_REQUIRED_FIELD',
      max: (max: number) => `VAL_MAX_LENGTH_${max}`,
    },
  },
}
```

## 🔄 **Phase 3: Client/Server Validation Separation**

### **3.1 Server-Side Validation Security**

#### **❌ CRITICAL: Find server functions without validation**
```bash
# Find server functions accepting unvalidated input
rg "createServerFn.*method.*(POST|PUT)" -A 10 --type ts src/ | rg -v "validator.*parse"

# Should return ZERO - all input operations must validate

# Find server functions with client-only validation
rg "useTranslation.*server|useForm.*server\.ts" --type ts src/

# Should return ZERO - no client hooks in server functions
```

#### **✅ Required Server Validation:**
```typescript
// REQUIRED: Server-side validation with proper error handling
export const createTodo = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    try {
      return createTodoSchema.parse(data)
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
  .handler(async ({ data }) => {
    // data is validated and type-safe
  })
```

### **3.2 Client-Side Validation UX**

#### **❌ CRITICAL: Find forms without client validation**
```bash
# Find forms without zodResolver
rg "useForm\(" --type tsx src/ -A 5 | rg -v "resolver.*zodResolver"

# Forms should have client-side validation for UX

# Find form fields without proper error display
rg "FormField|FormControl" --type tsx src/ -A 5 -B 5 | rg -v "FormMessage|error"

# Form fields should display validation errors
```

## 🔒 **Phase 4: Async Validation Security**

### **4.1 Race Condition Prevention**

#### **❌ CRITICAL: Find async validation without cleanup**
```bash
# Find async validation without abort signal support
rg "async.*validate|validation.*async" --type ts --type tsx src/ -A 10 | rg -v "AbortSignal|signal\?"

# Async validation should support cancellation

# Find validation without race condition handling
rg "useAsyncFieldValidator|async.*validation" --type tsx src/ -A 10 | rg -v "cleanup|abort|cancel"

# Should handle component unmounting and rapid input changes
```

#### **✅ Required Async Validation:**
```typescript
// REQUIRED: Async validation with abort signal
const validateSlug = useAsyncFieldValidator(
  async (slug: string, signal?: AbortSignal) => {
    const result = await checkSlugAvailability({ slug }, { signal })
    return result.available || 'Slug is already taken'
  },
  [excludeId] // Dependencies for cleanup
)

// REQUIRED: Server-side async validation with signal support
export const checkSlugAvailability = createServerFn({ method: 'POST' })
  .validator(schema.parse)
  .handler(async ({ data, signal }) => {
    // Check abort signal during long operations
    if (signal?.aborted) {
      throw new Error('Request cancelled')
    }
    
    const existing = await db.select()
      .from(organization)
      .where(eq(organization.slug, data.slug))
      
    return { available: !existing[0] }
  })
```

### **4.2 Database Constraint Validation**

#### **❌ CRITICAL: Find missing constraint validation**
```bash
# Find uniqueness validation without database check
rg "unique|duplicate|exists" --type ts src/ -B 5 -A 5 | rg -v "db\.select.*where.*eq"

# Uniqueness checks should query database

# Find constraint validation without proper error handling
rg "constraint.*error|unique.*violation|duplicate.*key" --type ts src/ -B 5 | rg -v "BIZ_DUPLICATE_ENTRY"

# Database constraint errors should use proper error codes
```

## 📋 **Validation Audit Report Template**

### **Validation System Consistency Audit Report**

**Date**: [Audit Date]
**Auditor**: [AI Agent ID]
**Scope**: [Validation Patterns Audited]

#### **Registry Compliance**
- **Rule Duplication**: X violations found
- **Registry Usage**: X/X schemas using registry
- **Message Consistency**: X/X using validation messages
- **Translation Integration**: ✅/❌ Properly implemented

#### **Client/Server Separation**
- **Server Validation**: X/X server functions validated
- **Client Validation**: X/X forms with zodResolver
- **Validation Security**: ✅/❌ Server-side enforcement
- **UX Validation**: ✅/❌ Client-side feedback

#### **Async Validation Security**
- **Race Condition Handling**: X/X implementations secure
- **Abort Signal Support**: X/X async validators cancellable
- **Database Constraint Validation**: X/X constraints checked
- **Error Handling**: ✅/❌ Proper error propagation

#### **Validation Violations**
| File | Line | Violation | Severity | Impact |
|------|------|-----------|----------|--------|
| ... | ... | ... | ... | ... |

#### **Validation Improvements**
1. [Registry Consolidation Tasks]
2. [Client/Server Validation Fixes]
3. [Async Validation Security]
4. [Message Standardization]

---

## 🚀 **Usage Instructions for AI Agents**

1. **Run this audit** after implementing any validation logic
2. **Check registry compliance** to prevent rule duplication
3. **Verify client/server separation** for security and UX
4. **Test async validation** for race conditions and cleanup
5. **Validate error handling** provides proper user feedback

This routine ensures **robust input validation security** and maintains consistent validation patterns across the entire application.