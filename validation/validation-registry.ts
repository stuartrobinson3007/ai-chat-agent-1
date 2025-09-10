import { z } from 'zod'

// Type for field values that can be validated
type FieldValue = string | number | boolean | Date | null | undefined

// Generic validation patterns that can be reused across projects
export const commonValidationPatterns = {
  // Common field patterns
  email: () => z.string().email('Invalid email address'),
  
  // String patterns
  requiredString: (message = 'This field is required') => 
    z.string().min(1, message),
  
  minMaxString: (min: number, max: number, minMessage?: string, maxMessage?: string) =>
    z.string()
      .min(min, minMessage || `Must be at least ${min} characters`)
      .max(max, maxMessage || `Must be less than ${max} characters`),

  // URL/slug patterns  
  slug: (message = 'Invalid slug format') =>
    z.string().regex(/^[a-z0-9-]+$/, message),

  // Password patterns
  strongPassword: (options?: {
    minLength?: number
    requireUppercase?: boolean
    requireLowercase?: boolean
    requireNumber?: boolean
    requireSymbol?: boolean
    messages?: {
      minLength?: string
      uppercase?: string
      lowercase?: string
      number?: string
      symbol?: string
    }
  }) => {
    const {
      minLength = 8,
      requireUppercase = true,
      requireLowercase = true,
      requireNumber = true,
      requireSymbol = false,
      messages = {}
    } = options || {}

    let schema = z.string().min(minLength, messages.minLength || `Password must be at least ${minLength} characters`)

    if (requireUppercase) {
      schema = schema.regex(/[A-Z]/, messages.uppercase || 'Password must contain at least one uppercase letter')
    }
    if (requireLowercase) {
      schema = schema.regex(/[a-z]/, messages.lowercase || 'Password must contain at least one lowercase letter')
    }
    if (requireNumber) {
      schema = schema.regex(/[0-9]/, messages.number || 'Password must contain at least one number')
    }
    if (requireSymbol) {
      schema = schema.regex(/[!@#$%^&*(),.?":{}|<>]/, messages.symbol || 'Password must contain at least one symbol')
    }

    return schema
  },

  // Number patterns
  positiveNumber: (message = 'Must be a positive number') =>
    z.number().positive(message),

  // Date patterns
  futureDate: (message = 'Date must be in the future') =>
    z.string().datetime().refine((date) => new Date(date) > new Date(), message),
    
  pastDate: (message = 'Date must be in the past') =>
    z.string().datetime().refine((date) => new Date(date) < new Date(), message),
}

// Generic validation function that accepts custom validation rules
export function validateFieldClient<T extends Record<string, Record<string, z.ZodSchema>>>(
  validationRules: T,
  entity: string,
  field: string,
  value: FieldValue,
  fallbackMessage = 'Validation failed'
): { valid: boolean; error?: string } {
  try {
    const entityRules = validationRules[entity as keyof T]
    if (entityRules && typeof entityRules === 'object') {
      const schema = entityRules[field]
      if (schema) {
        schema.parse(value)
      }
    }
    
    return { valid: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        valid: false, 
        error: error.issues[0]?.message || fallbackMessage 
      }
    }
    return { valid: false, error: fallbackMessage }
  }
}