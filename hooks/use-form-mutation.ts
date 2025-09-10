import { useMutation } from '@tanstack/react-query'
import { UseFormSetError, FieldValues, Path } from 'react-hook-form'
import { toast } from 'sonner'

import { ValidationError, isAppError } from '../utils/errors'
import { parseError } from '../errors/client-handler'
import { getErrorDisplayType } from '../errors/error-categories'

import { useTranslation } from '@/i18n/hooks/useTranslation'

interface UseFormMutationOptions<TData = unknown, TVariables = unknown, TFieldValues extends FieldValues = FieldValues> {
  mutationFn: (variables: TVariables) => Promise<TData>
  setError: UseFormSetError<TFieldValues>
  onSuccess?: (data: TData) => void
  onError?: (error: unknown) => void
  showToast?: boolean
}

/**
 * Hook that bridges TanStack Query mutations with React Hook Form error handling
 * 
 * Features:
 * - Automatically maps backend validation errors to form fields
 * - Shows general errors in form or as toast based on error type
 * - Type-safe error setting
 * - Handles all error scenarios gracefully
 */
export function useFormMutation<TData = unknown, TVariables = unknown, TFieldValues extends FieldValues = FieldValues>({
  mutationFn,
  setError,
  onSuccess,
  onError,
  showToast = true
}: UseFormMutationOptions<TData, TVariables, TFieldValues>) {
  const { t } = useTranslation('errors')
  return useMutation({
    mutationFn,
    onSuccess,
    onError: (error) => {
      const parsed = parseError(error)

      // SCENARIO 1: Backend field-level validation errors
      if (error instanceof ValidationError && error.context?.fields) {
        // Map each field error to the correct form field
        Object.entries(error.context.fields).forEach(([field, message]) => {
          setError(field as Path<TFieldValues>, {
            type: 'server',
            message: Array.isArray(message) ? message[0] : message
          })
        })

        // If there are field errors, don't show additional notifications
        return onError?.(error)
      }

      // SCENARIO 2: General errors - route based on error type
      const displayType = getErrorDisplayType(parsed.code)

      switch (displayType) {
        case 'field':
          // This shouldn't happen without fields, but handle gracefully
          // Show as root error in the form
          setError('root', {
            type: 'server',
            message: parsed.message
          })
          break

        case 'form':
          // Show in form error area
          setError('root', {
            type: 'server',
            message: parsed.message
          })
          break

        case 'toast':
          // Show as toast notification
          if (showToast) {
            // Check if this is an app error with actions
            if (isAppError(error) && error.actions?.length) {
              const action = error.actions[0]
              toast.error(parsed.message, {
                description: t('general.tryAgainOrContact'),
                action: action.label ? {
                  label: action.label,
                  onClick: () => {
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
                    }
                  }
                } : undefined
              })
            } else {
              toast.error(parsed.message, {
                description: t('general.tryAgainOrContact')
              })
            }
          }
          break
      }

      // Always call custom error handler if provided
      onError?.(error)
    }
  })
}