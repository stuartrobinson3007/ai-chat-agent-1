/**
 * Type-safe property access helpers
 * 
 * Replaces unsafe dynamic property access patterns
 * with runtime-validated type-safe alternatives.
 */

/**
 * Type-safe nested property access
 * Replaces: (obj as Record<string, unknown>)[k]
 */
export function safeNestedAccess(obj: unknown, path: string[]): unknown {
  let current: unknown = obj
  
  for (const key of path) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  
  return current
}

/**
 * Type-safe property access with known object type
 * Replaces: fallbackContent[key as keyof typeof fallbackContent]
 */
export function safePropertyAccess<T extends Record<string, unknown>>(
  obj: T,
  key: string
): T[keyof T] | undefined {
  return key in obj ? obj[key as keyof T] : undefined
}

/**
 * Type-safe enum key access
 * Replaces: BILLING_PLANS[plan as keyof typeof BILLING_PLANS]
 */
export function safeEnumAccess<T extends Record<string, unknown>>(
  enumObj: T,
  key: unknown
): T[keyof T] | undefined {
  if (typeof key === 'string' && key in enumObj) {
    return enumObj[key as keyof T]
  }
  return undefined
}

/**
 * Type-safe string template replacement
 * Replaces: (text as string).replace(...)
 */
export function safeStringReplace(
  text: unknown,
  pattern: string | RegExp,
  replacement: string
): string {
  if (typeof text === 'string') {
    return text.replace(pattern, replacement)
  }
  return String(text)
}

/**
 * Type-safe table filter value access
 * Replaces: column?.getFilterValue() as string[] | string | undefined
 */
export function getTableFilterValue(filterValue: unknown): string[] | string | undefined {
  if (filterValue === undefined || filterValue === null) {
    return undefined
  }
  
  if (typeof filterValue === 'string') {
    return filterValue
  }
  
  if (Array.isArray(filterValue) && filterValue.every(item => typeof item === 'string')) {
    return filterValue as string[]
  }
  
  return undefined
}