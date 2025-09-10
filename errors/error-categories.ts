import { ERROR_CODES, type ErrorCode } from './codes'

// Define where each error type should be displayed
const ERROR_CATEGORIES = {
  field: new Set<ErrorCode>([
    ERROR_CODES.VAL_REQUIRED_FIELD,
    ERROR_CODES.VAL_INVALID_FORMAT,
    ERROR_CODES.VAL_INVALID_EMAIL,
    ERROR_CODES.VAL_PASSWORD_TOO_WEAK,
    ERROR_CODES.BIZ_DUPLICATE_ENTRY
  ]),
  form: new Set<ErrorCode>([
    ERROR_CODES.BIZ_LIMIT_EXCEEDED,
    ERROR_CODES.BIZ_INVALID_STATE,
    ERROR_CODES.BIZ_NOT_FOUND,
    ERROR_CODES.BIZ_PAYMENT_FAILED,
    ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
    ERROR_CODES.AUTH_ACCOUNT_LOCKED,
    ERROR_CODES.AUTH_INVALID_CREDENTIALS
  ]),
  toast: new Set<ErrorCode>([
    ERROR_CODES.SYS_SERVER_ERROR,
    ERROR_CODES.SYS_CONFIG_ERROR,
    ERROR_CODES.SYS_RATE_LIMIT,
    ERROR_CODES.NET_CONNECTION_ERROR,
    ERROR_CODES.NET_TIMEOUT,
    ERROR_CODES.AUTH_SESSION_EXPIRED,
    ERROR_CODES.AUTH_NOT_AUTHENTICATED
  ])
}

/**
 * Determine where an error should be displayed based on its code
 * @param code - The error code
 * @returns 'field' | 'form' | 'toast' - The display location
 */
export function getErrorDisplayType(code: string): 'field' | 'form' | 'toast' {
  // Check each category using type guard
  const errorCode = code as ErrorCode
  if (ERROR_CATEGORIES.field.has(errorCode)) return 'field'
  if (ERROR_CATEGORIES.form.has(errorCode)) return 'form'
  if (ERROR_CATEGORIES.toast.has(errorCode)) return 'toast'
  
  // Default to toast for unknown errors
  return 'toast'
}

/**
 * Check if an error should be retryable
 */
export function isRetryableError(code: string): boolean {
  const retryableCodes = new Set<ErrorCode>([
    ERROR_CODES.NET_CONNECTION_ERROR,
    ERROR_CODES.NET_TIMEOUT,
    ERROR_CODES.SYS_RATE_LIMIT
  ])
  
  return retryableCodes.has(code as ErrorCode)
}

/**
 * Get a user-friendly action for an error
 */
export function getErrorAction(code: string): { action: string; label: string } | null {
  switch (code) {
    case ERROR_CODES.AUTH_SESSION_EXPIRED:
    case ERROR_CODES.AUTH_NOT_AUTHENTICATED:
      return { action: 'login', label: 'Sign In' }
      
    case ERROR_CODES.BIZ_LIMIT_EXCEEDED:
    case ERROR_CODES.BIZ_PAYMENT_FAILED:
      return { action: 'upgrade', label: 'Upgrade Plan' }
      
    case ERROR_CODES.NET_CONNECTION_ERROR:
    case ERROR_CODES.NET_TIMEOUT:
      return { action: 'retry', label: 'Try Again' }
      
    default:
      return null
  }
}