/**
 * Validation message utilities for form schemas
 * 
 * Since Zod schemas are defined at module level (before components mount),
 * we can't use useTranslation directly in schema definitions. Instead, we'll
 * provide these hardcoded messages that match our translation keys for consistency.
 * 
 * These messages should match the keys in validation.json
 */

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
    },
    currentPassword: {
      required: 'Current password is required'
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
    invalid: 'Invalid value',
    passwordMatch: "Passwords don't match"
  }
}

/**
 * Helper to get validation message with consistent structure
 */
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