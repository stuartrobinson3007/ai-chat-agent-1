import { useEffect, useRef } from 'react'
import { UseFormReset, FieldValues } from 'react-hook-form'

interface FormWithReset<T extends FieldValues> {
  reset: UseFormReset<T>
}

/**
 * Hook to sync form data with async-loaded data
 * 
 * Features:
 * - Automatically resets form when data changes
 * - Prevents unnecessary resets with deep comparison
 * - Handles null/undefined data gracefully
 * 
 * @param form - React Hook Form instance with reset method
 * @param data - The data to sync with (can be null/undefined while loading)
 * @param dependencies - Additional dependencies to trigger sync
 */
export function useFormSync<T extends FieldValues>(
  form: FormWithReset<T>,
  data: T | null | undefined,
  dependencies: React.DependencyList = []
) {
  const previousDataRef = useRef<T | null | undefined>(undefined)
  
  useEffect(() => {
    // Skip if data hasn't changed
    if (data === previousDataRef.current) {
      return
    }
    
    // Skip if data is null/undefined (still loading)
    if (!data) {
      return
    }
    
    // Deep comparison to avoid unnecessary resets
    const dataChanged = JSON.stringify(data) !== JSON.stringify(previousDataRef.current)
    
    if (dataChanged) {
      form.reset(data)
      previousDataRef.current = data
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dependencies are passed as spread parameter
  }, [data, form, ...dependencies])
}

/**
 * Hook to sync form data with async-loaded data and track sync status
 * 
 * @param form - React Hook Form instance
 * @param data - The data to sync with
 * @param dependencies - Additional dependencies
 * @returns Object with sync status
 */
export function useFormSyncWithStatus<T extends FieldValues>(
  form: FormWithReset<T>,
  data: T | null | undefined,
  dependencies: React.DependencyList = []
) {
  const isSyncedRef = useRef<boolean>(false)
  const previousDataRef = useRef<T | null | undefined>(undefined)
  
  useEffect(() => {
    if (!data) {
      isSyncedRef.current = false
      return
    }
    
    const dataChanged = JSON.stringify(data) !== JSON.stringify(previousDataRef.current)
    
    if (dataChanged) {
      form.reset(data)
      previousDataRef.current = data
      isSyncedRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dependencies are passed as spread parameter
  }, [data, form, ...dependencies])
  
  return {
    isSynced: isSyncedRef.current,
    isLoading: !data,
    data
  }
}