# Validation Architecture Implementation Guide

This document provides comprehensive guidance for implementing a centralized validation system with registry patterns, feature-specific schemas, server-side database constraint validation, and consistent validation messaging.

## 🚨 Critical Rules

- **ALWAYS use validation registry** - Never duplicate validation rules across components
- **MUST separate client/server validation** - Client for UX, server for security
- **NEVER skip database constraint validation** - Server-side uniqueness and constraint checks required
- **ALWAYS use consistent validation messages** - Follow established message patterns and i18n keys
- **MUST handle async validation race conditions** - Use proper abort signals and cleanup

## ❌ Common AI Agent Mistakes

### Validation Rule Duplication
```typescript
// ❌ NEVER duplicate validation rules across files
// In component A:
const schemaA = z.object({
  title: z.string().min(1).max(200),
})

// In component B:
const schemaB = z.object({
  title: z.string().min(1).max(200), // Duplicated rule!
})

// ✅ ALWAYS use validation registry
import { validationRules } from '@/lib/validation/validation-registry'

const schemaA = z.object({
  title: validationRules.todo.title,
})

const schemaB = z.object({
  title: validationRules.todo.title, // Consistent rule!
})
```

### Client-Only Validation Vulnerability
```typescript
// ❌ NEVER rely only on client-side validation
export const createTodo = createServerFn({ method: 'POST' })
  .handler(async ({ data }) => {
    // No server-side validation - security vulnerability!
    await db.insert(todos).values(data)
  })

// ✅ ALWAYS validate on server
export const createTodo = createServerFn({ method: 'POST' })
  .validator(createTodoSchema.parse)
  .handler(async ({ data, context }) => {
    // Server-side validation enforced
    await db.insert(todos).values({ ...data, organizationId: context.organizationId })
  })
```

### Database Constraint Bypass
```typescript
// ❌ NEVER skip uniqueness validation
const validateSlug = (slug: string) => {
  // Only client-side format validation
  return /^[a-z0-9-]+$/.test(slug)
}

// ✅ ALWAYS include database constraint validation
const validateSlug = useAsyncFieldValidator(
  async (slug: string, signal?: AbortSignal) => {
    const result = await checkSlugAvailability({ slug }, { signal })
    return result.available || 'Slug is already taken'
  }
)
```

### Validation Message Inconsistency
```typescript
// ❌ NEVER hardcode validation messages
z.string().min(1, 'Title is required')           // Hardcoded
z.string().max(200, 'Title is too long')         // Not translatable

// ✅ ALWAYS use validation message utilities
import { validationMessages as vm } from '@/lib/validation/validation-messages'

z.string().min(1, vm.todo.title.required)
z.string().max(200, vm.todo.title.max(200))
```

## ✅ Established Patterns

### 1. **Validation Registry**
```typescript
// File: src/lib/validation/validation-registry.ts
import { z } from 'zod'

import { validationMessages as vm } from './validation-messages'

// Central registry for all validation rules
export const validationRules = {
  organization: {
    name: z.string()
      .min(2, vm.organization.name.min(2))
      .max(100, vm.organization.name.max(100)),
    slug: z.string()
      .min(3, vm.organization.slug.min(3))
      .max(50, vm.organization.slug.max(50))
      .regex(/^[a-z0-9-]+$/, vm.organization.slug.pattern)
  },
  user: {
    email: z.string().email(vm.user.email.invalid),
    firstName: z.string()
      .min(1, vm.user.firstName.required)
      .max(50, vm.user.firstName.max),
    lastName: z.string()
      .min(1, vm.user.lastName.required)
      .max(50, vm.user.lastName.max),
    password: z.string()
      .min(8, vm.user.password.min(8))
      .regex(/[A-Z]/, vm.user.password.uppercase)
      .regex(/[a-z]/, vm.user.password.lowercase)
      .regex(/[0-9]/, vm.user.password.number)
  },
  todo: {
    title: z.string()
      .min(1, vm.todo.title.required)
      .max(200, vm.todo.title.max(200)),
    description: z.string()
      .max(5000, vm.todo.description.max(5000))
      .optional(),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    dueDate: z.string().datetime().optional()
  }
}

// Client-side validation function
export function validateFieldClient(
  entity: string,
  field: string,
  value: unknown
): { valid: boolean; error?: string } {
  try {
    const entityRules = validationRules[entity as keyof typeof validationRules]
    if (entityRules) {
      const schema = (entityRules as Record<string, z.ZodSchema>)[field]
      if (schema) {
        schema.parse(value)
      }
    }
    
    return { valid: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        valid: false, 
        error: error.issues[0]?.message || vm.common.validationFailed 
      }
    }
    return { valid: false, error: vm.common.validationFailed }
  }
}
```

### 2. **Validation Messages**
```typescript
// File: src/lib/validation/validation-messages.ts
export const validationMessages = {
  organization: {
    name: {
      min: (min: number) => `Organization name must be at least ${min} characters`,
      max: (max: number) => `Organization name must be less than ${max} characters`,
      required: 'Organization name is required'
    },
    slug: {
      min: (min: number) => `Slug must be at least ${min} characters`,
      max: (max: number) => `Slug must be less than ${max} characters`,
      pattern: 'Slug can only contain lowercase letters, numbers, and hyphens',
      required: 'Slug is required',
      taken: 'This slug is already taken',
      validationFailed: 'Unable to validate slug availability'
    }
  },
  user: {
    email: {
      invalid: 'Invalid email address',
      taken: 'This email is already registered'
    },
    firstName: {
      required: 'First name is required',
      max: 'First name is too long'
    },
    lastName: {
      required: 'Last name is required',
      max: 'Last name is too long'
    },
    password: {
      min: (min: number) => `Password must be at least ${min} characters`,
      uppercase: 'Password must contain at least one uppercase letter',
      lowercase: 'Password must contain at least one lowercase letter',
      number: 'Password must contain at least one number'
    }
  },
  todo: {
    title: {
      required: 'Title is required',
      max: (max: number) => `Title must be less than ${max} characters`
    },
    description: {
      max: (max: number) => `Description must be less than ${max} characters`
    }
  },
  common: {
    validationFailed: 'Validation failed',
    required: 'This field is required',
    invalid: 'Invalid value'
  }
}

// Helper to get validation message with consistent structure
export function getValidationMessage(
  category: keyof typeof validationMessages,
  field: string,
  type: string,
  params?: Record<string, unknown>
): string {
  const categoryMessages = validationMessages[category] as Record<string, Record<string, string | ((arg: unknown) => string)>>
  const fieldMessages = categoryMessages?.[field]
  const message = fieldMessages?.[type]
  
  if (typeof message === 'function' && params) {
    return message(params)
  }
  
  if (typeof message === 'string') {
    return message
  }
  
  return validationMessages.common.validationFailed
}
```

### 3. **Feature-Specific Schemas**
```typescript
// File: src/lib/validation/todo.schema.ts
import { z } from 'zod'

import { validationRules } from './validation-registry'

// Todo form schema using registry rules
export const todoFormSchema = z.object({
  title: validationRules.todo.title,
  description: validationRules.todo.description,
  status: validationRules.todo.status,
  priority: validationRules.todo.priority,
  dueDate: validationRules.todo.dueDate
})

export type TodoFormData = z.infer<typeof todoFormSchema>

// Create todo schema
export const createTodoSchema = todoFormSchema

export type CreateTodoData = z.infer<typeof createTodoSchema>

// Update todo schema (partial updates allowed)
export const updateTodoSchema = todoFormSchema.partial().extend({
  id: z.string().uuid()
})

export type UpdateTodoData = z.infer<typeof updateTodoSchema>
```

### 4. **Server-Side Database Constraint Validation**
```typescript
// File: src/lib/validation/validation.server.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { and, eq, not } from 'drizzle-orm'

import { validationRules } from './validation-registry'
import { validationMessages as vm } from './validation-messages'
import { db } from '@/lib/db/db'
import { organization, user } from '@/database/schema'

type FieldValue = string | number | boolean | Date | null | undefined

// Server-side database constraint validator
async function validateDatabaseConstraints(
  entity: 'organization' | 'user' | 'todo',
  field: string,
  value: FieldValue,
  context?: { excludeId?: string; organizationId?: string }
): Promise<true | string> {
  switch (entity) {
    case 'organization':
      if (field === 'slug' && typeof value === 'string') {
        const existing = await db.select()
          .from(organization)
          .where(and(
            eq(organization.slug, value),
            context?.excludeId ? not(eq(organization.id, context.excludeId)) : undefined
          ))
          .limit(1)
        
        if (existing.length > 0) {
          return vm.organization.slug.taken
        }
      }
      break
      
    case 'user':
      if (field === 'email' && typeof value === 'string') {
        const existing = await db.select()
          .from(user)
          .where(and(
            eq(user.email, value),
            context?.excludeId ? not(eq(user.id, context.excludeId)) : undefined
          ))
          .limit(1)
        
        if (existing.length > 0) {
          return vm.user.email.taken
        }
      }
      break
  }
  
  return true
}

// Server function for field validation
export const validateField = createServerFn({ method: 'POST' })
  .validator((data: unknown) => z.object({
    entity: z.string(),
    field: z.string(),
    value: z.unknown(),
    options: z.object({
      skipDatabase: z.boolean().optional(),
      context: z.object({
        excludeId: z.string().optional(),
        organizationId: z.string().optional()
      }).optional()
    }).optional()
  }).parse(data))
  .handler(async ({ data }) => {
    const { entity, field, value, options } = data
    
    try {
      // 1. Zod validation first
      const entityRules = validationRules[entity as keyof typeof validationRules]
      if (entityRules) {
        const schema = (entityRules as Record<string, z.ZodSchema>)[field]
        if (schema) {
          schema.parse(value)
        }
      }
      
      // 2. Database validation (if needed)
      if (!options?.skipDatabase) {
        const dbResult = await validateDatabaseConstraints(
          entity as 'organization' | 'user' | 'todo',
          field,
          value,
          options?.context
        )
        
        if (dbResult !== true) {
          return { valid: false, error: dbResult }
        }
      }
      
      return { valid: true }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { 
          valid: false, 
          error: error.issues[0]?.message || vm.common.validationFailed 
        }
      }
      return { valid: false, error: vm.common.validationFailed }
    }
  })

// Specialized validation functions
export const checkSlugAvailability = createServerFn({ method: 'POST' })
  .validator((data: unknown) => z.object({
    slug: z.string(),
    organizationId: z.string().optional()
  }).parse(data))
  .handler(async ({ data }) => {
    const validation = await validateDatabaseConstraints(
      'organization',
      'slug',
      data.slug,
      { excludeId: data.organizationId }
    )
    
    return { available: validation === true }
  })

export const checkEmailAvailability = createServerFn({ method: 'POST' })
  .validator((data: unknown) => z.object({
    email: z.string().email(),
    userId: z.string().optional()
  }).parse(data))
  .handler(async ({ data }) => {
    const validation = await validateDatabaseConstraints(
      'user',
      'email', 
      data.email,
      { excludeId: data.userId }
    )
    
    return { available: validation === true }
  })
```

### 5. **Organization Schema**
```typescript
// File: src/lib/validation/organization.schema.ts
import { z } from 'zod'

import { validationRules } from './validation-registry'

// Organization form schema using registry rules
export const organizationFormSchema = z.object({
  name: validationRules.organization.name,
  slug: validationRules.organization.slug
})

export type OrganizationFormData = z.infer<typeof organizationFormSchema>

// Schema for updating organization (includes ID)
export const updateOrganizationSchema = organizationFormSchema.extend({
  organizationId: z.string().uuid()
})

export type UpdateOrganizationData = z.infer<typeof updateOrganizationSchema>

// Schema for creating organization
export const createOrganizationSchema = organizationFormSchema

export type CreateOrganizationData = z.infer<typeof createOrganizationSchema>
```

### 6. **User Schema**
```typescript
// File: src/lib/validation/user.schema.ts
import { z } from 'zod'

import { validationRules } from './validation-registry'

// User registration schema
export const userRegistrationSchema = z.object({
  email: validationRules.user.email,
  firstName: validationRules.user.firstName,
  lastName: validationRules.user.lastName,
  password: validationRules.user.password,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

export type UserRegistrationData = z.infer<typeof userRegistrationSchema>

// User profile update schema (no password)
export const userProfileSchema = z.object({
  firstName: validationRules.user.firstName,
  lastName: validationRules.user.lastName,
  email: validationRules.user.email,
}).extend({
  userId: z.string().uuid()
})

export type UserProfileData = z.infer<typeof userProfileSchema>
```

## 🔧 Step-by-Step Implementation

### 1. **Adding New Validation Rules**
```typescript
// Step 1: Add to validation registry
// File: src/lib/validation/validation-registry.ts
export const validationRules = {
  // ... existing rules
  newEntity: {
    newField: z.string()
      .min(5, vm.newEntity.newField.min(5))
      .max(100, vm.newEntity.newField.max(100))
  }
}

// Step 2: Add validation messages
// File: src/lib/validation/validation-messages.ts
export const validationMessages = {
  // ... existing messages
  newEntity: {
    newField: {
      min: (min: number) => `Field must be at least ${min} characters`,
      max: (max: number) => `Field must be less than ${max} characters`,
      required: 'Field is required'
    }
  }
}

// Step 3: Create feature schema
// File: src/lib/validation/new-entity.schema.ts
import { z } from 'zod'
import { validationRules } from './validation-registry'

export const newEntitySchema = z.object({
  newField: validationRules.newEntity.newField,
})

export type NewEntityData = z.infer<typeof newEntitySchema>
```

### 2. **Form with Full Validation**
```typescript
// Complete form implementation with all validation types
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { FormErrorBoundary, Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/form'
import { useFormMutation } from '@/lib/hooks/use-form-mutation'
import { useAsyncFieldValidator } from '@/lib/hooks/use-async-field-validator'
import { organizationFormSchema } from '@/lib/validation/organization.schema'
import { checkSlugAvailability } from '@/lib/validation/validation.server'

function OrganizationForm() {
  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: '',
      slug: '',
    },
  })

  // Async slug validation
  const validateSlug = useAsyncFieldValidator(
    async (slug: string, signal?: AbortSignal) => {
      if (!slug || slug.length < 3) return true
      
      const result = await checkSlugAvailability({ slug }, { signal })
      return result.available || 'Slug is already taken'
    }
  )

  // Form submission with mutation
  const mutation = useFormMutation({
    mutationFn: createOrganization,
    setError: form.setError,
    onSuccess: (data) => {
      toast.success('Organization created successfully')
      navigate({ to: `/organizations/${data.id}` })
    },
  })

  const onSubmit = async (data: OrganizationFormData) => {
    await mutation.mutateAsync(data)
  }

  return (
    <FormErrorBoundary>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Organization Name</FormLabel>
                <FormControl>
                  <Input placeholder="My Organization" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="my-organization" 
                    {...field}
                    onBlur={async () => {
                      // Async validation on blur
                      const result = await validateSlug(field.value)
                      if (result !== true) {
                        form.setError('slug', {
                          type: 'async',
                          message: result,
                        })
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormActions
            isSubmitting={mutation.isPending}
            isDirty={form.formState.isDirty}
            submitLabel="Create Organization"
          />
        </form>
      </Form>
    </FormErrorBoundary>
  )
}
```

## 🎯 Integration Requirements

### With Server Functions
```typescript
// Server functions must use validation schemas
import { createTodoSchema } from '@/lib/validation/todo.schema'

export const createTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator(createTodoSchema.parse)
  .handler(async ({ data, context }) => {
    // Data is now fully validated
    await db.insert(todos).values({
      ...data,
      organizationId: context.organizationId,
      createdBy: context.user.id,
    })
  })
```

### With i18n System
```typescript
// Validation messages should match translation keys
// File: src/i18n/locales/en/validation.json
{
  "organization": {
    "name": {
      "min": "Organization name must be at least {{min}} characters",
      "max": "Organization name must be less than {{max}} characters",
      "required": "Organization name is required"
    },
    "slug": {
      "pattern": "Slug can only contain lowercase letters, numbers, and hyphens",
      "taken": "This slug is already taken"
    }
  }
}
```

### With Error Handling
```typescript
// Validation errors integrate with error system
import { ValidationError } from '@/lib/utils/errors'

// In server function validators
try {
  return schema.parse(data)
} catch (error) {
  if (error instanceof z.ZodError) {
    const fields: Record<string, string[]> = {}
    error.issues.forEach((err) => {
      const path = err.path.join('.')
      if (!fields[path]) fields[path] = []
      fields[path].push(err.message)
    })
    
    throw new ValidationError(fields, 'Validation failed')
  }
  throw error
}
```

## 🧪 Testing Requirements

### Validation Rule Testing
```typescript
// Test validation registry rules
import { validationRules } from '@/lib/validation/validation-registry'

describe('Validation Rules', () => {
  describe('organization.name', () => {
    it('should accept valid names', () => {
      expect(() => validationRules.organization.name.parse('Valid Name')).not.toThrow()
    })

    it('should reject names that are too short', () => {
      expect(() => validationRules.organization.name.parse('A')).toThrow('at least 2 characters')
    })

    it('should reject names that are too long', () => {
      const longName = 'a'.repeat(101)
      expect(() => validationRules.organization.name.parse(longName)).toThrow('less than 100 characters')
    })
  })
})
```

### Server Validation Testing
```typescript
// Test server-side validation
describe('validateField', () => {
  it('should validate slug availability', async () => {
    // Mock existing organization with slug
    vi.mocked(db.select).mockResolvedValue([{ id: 'org1', slug: 'taken-slug' }])

    const result = await validateField.handler({
      data: {
        entity: 'organization',
        field: 'slug',
        value: 'taken-slug',
      }
    })

    expect(result.valid).toBe(false)
    expect(result.error).toBe('This slug is already taken')
  })

  it('should allow available slugs', async () => {
    vi.mocked(db.select).mockResolvedValue([])

    const result = await validateField.handler({
      data: {
        entity: 'organization',
        field: 'slug',
        value: 'available-slug',
      }
    })

    expect(result.valid).toBe(true)
  })
})
```

## 📋 Implementation Checklist

Before considering validation architecture complete, verify:

- [ ] **Validation Registry**: Central rules defined for all entities
- [ ] **Validation Messages**: Consistent message patterns with i18n support
- [ ] **Feature Schemas**: Entity-specific schemas using registry rules
- [ ] **Server Validation**: Database constraint validation implemented
- [ ] **Async Validation**: Race condition handling for async validators
- [ ] **Client/Server Separation**: Appropriate validation on each side
- [ ] **Error Integration**: Validation errors integrate with error system
- [ ] **Type Safety**: Full TypeScript support throughout validation system
- [ ] **Performance**: Debounced async validation for better UX
- [ ] **Testing**: Comprehensive test coverage for validation rules

## 🚀 Advanced Patterns

### Cross-Field Validation
```typescript
// Complex validation with cross-field dependencies
export const advancedFormSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  priority: z.enum(['low', 'medium', 'high']),
  estimatedHours: z.number().min(0),
}).refine((data) => {
  const start = new Date(data.startDate)
  const end = new Date(data.endDate)
  return end > start
}, {
  message: "End date must be after start date",
  path: ["endDate"],
}).refine((data) => {
  // High priority tasks must have realistic time estimates
  if (data.priority === 'high' && data.estimatedHours > 40) {
    return false
  }
  return true
}, {
  message: "High priority tasks should have realistic time estimates (≤40 hours)",
  path: ["estimatedHours"],
})
```

### Conditional Validation
```typescript
// Validation that depends on other fields
export const conditionalSchema = z.object({
  type: z.enum(['basic', 'advanced']),
  basicConfig: z.string().optional(),
  advancedConfig: z.object({
    setting1: z.string(),
    setting2: z.number(),
  }).optional(),
}).refine((data) => {
  if (data.type === 'basic') {
    return !!data.basicConfig
  }
  if (data.type === 'advanced') {
    return !!data.advancedConfig
  }
  return true
}, {
  message: "Configuration is required for the selected type",
  path: ["basicConfig"], // Will be overridden based on type
})
```

This validation architecture provides a robust, centralized system for handling all validation concerns with proper separation between client UX and server security validation.