import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { debounce } from 'lodash'

interface UseFormAutosaveOptions<T> {
  initialData: T
  onSave: (data: T) => Promise<void | T>
  debounceMs?: number
  enabled?: boolean
  validate?: (data: T) => { isValid: boolean; errors: string[] }
  compareFunction?: (a: T, b: T) => boolean
  errorMessages?: {
    saveFailed?: string
  }
}

interface UseFormAutosaveResult<T> {
  data: T
  updateField: <K extends keyof T>(field: K, value: T[K]) => void
  updateData: (data: Partial<T>) => void
  isSaving: boolean
  lastSaved: Date | null
  saveNow: () => Promise<void>
  isDirty: boolean
  errors: string[]
  reset: (newData?: T) => void
}

export function useFormAutosave<T extends Record<string, unknown>>({
  initialData,
  onSave,
  debounceMs = 3000,
  enabled = true,
  validate,
  compareFunction,
  errorMessages = {},
}: UseFormAutosaveOptions<T>): UseFormAutosaveResult<T> {
  const [data, setData] = useState<T>(initialData)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const lastSavedDataRef = useRef<T>(initialData)
  const savePromiseRef = useRef<Promise<void> | null>(null)
  const mountedRef = useRef(true)
  const isInitializedRef = useRef(false)

  // Check if data is different from last saved
  const isDirty = useCallback(() => {
    if (compareFunction) {
      return !compareFunction(data, lastSavedDataRef.current)
    }
    return JSON.stringify(data) !== JSON.stringify(lastSavedDataRef.current)
  }, [data, compareFunction])

  // Save function
  const performSave = useCallback(async () => {
    if (!enabled || !isDirty()) {
      return
    }

    // Validate if validator provided
    if (validate) {
      const validation = validate(data)
      if (!validation.isValid) {
        setErrors(validation.errors)
        return
      }
      setErrors([])
    }

    // Prevent concurrent saves
    if (savePromiseRef.current) {
      await savePromiseRef.current
    }

    setIsSaving(true)

    const savePromise = (async () => {
      try {
        const result = await onSave(data)

        if (!mountedRef.current) return

        // If onSave returns normalized data, use it
        const savedData = result || data
        lastSavedDataRef.current = savedData as T
        setData(savedData as T)
        setLastSaved(new Date())
        setErrors([])
      } catch (error) {
        if (!mountedRef.current) return

        const message = error instanceof Error ? error.message : (errorMessages.saveFailed || 'Save failed')
        setErrors([message])
      } finally {
        if (mountedRef.current) {
          setIsSaving(false)
          savePromiseRef.current = null
        }
      }
    })()

    savePromiseRef.current = savePromise
    await savePromise
  }, [data, enabled, isDirty, validate, onSave, errorMessages])

  // Debounced save - using useMemo to ensure stable reference
  const debouncedSave = useMemo(
    () =>
      debounce(() => {
        performSave()
      }, debounceMs),
    [performSave, debounceMs]
  )

  // Update single field
  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setData(prev => {
      const updated = { ...prev, [field]: value }
      return updated
    })
  }, [])

  // Update multiple fields
  const updateData = useCallback((updates: Partial<T>) => {
    setData(prev => ({ ...prev, ...updates }))
  }, [])

  // Save immediately (for blur events)
  const saveNow = useCallback(async () => {
    debouncedSave.cancel()
    await performSave()
  }, [debouncedSave, performSave])

  // Reset form to initial or new data
  const reset = useCallback(
    (newData?: T) => {
      const dataToSet = newData || initialData
      setData(dataToSet)
      lastSavedDataRef.current = dataToSet
      setLastSaved(null)
      setErrors([])
      debouncedSave.cancel()
      isInitializedRef.current = true
    },
    [initialData, debouncedSave]
  )

  // Auto-save on data change
  useEffect(() => {
    if (enabled && isDirty()) {
      debouncedSave()
    }
  }, [data, enabled, isDirty, debouncedSave])

  // Only set initial data on first mount or when explicitly needed
  useEffect(() => {
    if (!isInitializedRef.current) {
      setData(initialData)
      lastSavedDataRef.current = initialData
      isInitializedRef.current = true
    }
  }, [initialData])

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      isInitializedRef.current = false
      debouncedSave.cancel()
    }
  }, [debouncedSave])

  return {
    data,
    updateField,
    updateData,
    isSaving,
    lastSaved,
    saveNow,
    isDirty: isDirty(),
    errors,
    reset,
  }
}