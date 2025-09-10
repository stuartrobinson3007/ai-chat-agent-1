import { isAppError } from '@/taali/utils/errors'
import type { ErrorAction } from '@/taali/utils/errors'

export interface ParsedError {
  code: string
  message: string
  statusCode: number
  context?: unknown
  actions?: ErrorAction[]
}

// Parse any error into a consistent format
export function parseError(error: unknown): ParsedError {
  // Handle AppError instances
  if (isAppError(error)) {
    return {
      code: error.code,
      message: error.fallbackMessage || error.message,
      statusCode: error.statusCode,
      context: error.context,
      actions: error.actions,
    }
  }

  // Handle API responses
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const e = error as { code: string; message: string; statusCode?: number; context?: unknown; actions?: ErrorAction[] }
    return {
      code: e.code,
      message: e.message || e.code,
      statusCode: e.statusCode || 500,
      context: e.context,
      actions: e.actions,
    }
  }

  // Handle standard errors
  if (error instanceof Error) {
    return {
      code: 'SYS_SERVER_ERROR',
      message: error.message,
      statusCode: 500,
    }
  }

  // Unknown errors
  return {
    code: 'SYS_SERVER_ERROR',
    message: 'An unexpected error occurred',
    statusCode: 500,
  }
}

// Handle error actions (retry, login, upgrade, etc.)
export function handleErrorAction(action: ErrorAction) {
  switch (action.action) {
    case 'retry':
      window.location.reload()
      break
    case 'login':
      window.location.href = '/auth/signin'
      break
    case 'upgrade':
      window.location.href = '/billing'
      break
    case 'support':
      window.location.href = '/support'
      break
    case 'goBack':
      window.history.back()
      break
  }
}
