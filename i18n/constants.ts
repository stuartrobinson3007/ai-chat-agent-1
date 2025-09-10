export const LANGUAGES = {
  en: { code: 'en', name: 'English', flag: '🇺🇸' },
  es: { code: 'es', name: 'Español', flag: '🇪🇸' },
} as const

export const DEFAULT_LANGUAGE = 'en'

// Core namespaces that every app should have
export const CORE_NAMESPACES = [
  'common',
  'errors',
  'validation',
] as const

// Common optional namespaces many apps will have
export const COMMON_NAMESPACES = [
  'auth',
  'notifications',
  'profile',
  'settings',
  'email',
] as const

// All standard namespaces (can be extended per app)
export const NAMESPACES = [
  ...CORE_NAMESPACES,
  ...COMMON_NAMESPACES,
] as const

export type Language = keyof typeof LANGUAGES
export type Namespace = (typeof NAMESPACES)[number]
