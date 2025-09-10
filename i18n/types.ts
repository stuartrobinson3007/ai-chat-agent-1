// Generic i18n types that don't depend on specific configuration

export type TranslationFunction = (key: string, options?: Record<string, unknown>) => string

export interface I18nHookResult {
  t: TranslationFunction
  i18n: {
    language: string
    changeLanguage: (lng: string) => Promise<void>
    isInitialized: boolean
  }
  language: string
  changeLanguage: (lng: string) => Promise<void>
  ready: boolean
  isLoading: boolean
}
