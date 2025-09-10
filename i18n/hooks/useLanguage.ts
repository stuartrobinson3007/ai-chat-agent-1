import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { LANGUAGES, type Language } from '../constants'

interface UseLanguageOptions {
  // Optional user object with language preference
  user?: { language?: string } | null
  // Optional function to persist language changes to server
  onLanguageChange?: (language: Language) => Promise<void>
  // Whether to sync with localStorage
  syncWithStorage?: boolean
}

export function useLanguage(options?: UseLanguageOptions) {
  const { i18n } = useTranslation()
  const { 
    user, 
    onLanguageChange, 
    syncWithStorage = true 
  } = options || {}

  // Sync user's stored language with i18n and localStorage on session init
  useEffect(() => {
    if (user?.language && i18n.isInitialized) {
      const userLanguage = user.language as Language
      const currentLanguage = i18n.language as Language

      // If user's preferred language differs from current i18n language, sync it
      if (userLanguage !== currentLanguage) {
        i18n.changeLanguage(userLanguage)
        if (syncWithStorage) {
          localStorage.setItem('i18nextLng', userLanguage)
        }
      }
    }
  }, [user?.language, i18n, i18n.isInitialized, syncWithStorage])

  const changeLanguage = useCallback(
    async (language: Language) => {
      try {
        await i18n.changeLanguage(language)
        
        // Store preference in localStorage if enabled
        if (syncWithStorage) {
          localStorage.setItem('i18nextLng', language)
        }

        // Update user profile if callback provided
        if (onLanguageChange) {
          try {
            await onLanguageChange(language)
          } catch (_error) {
            // Continue even if server update fails - localStorage will work
          }
        }
      } catch (_error) {
        // Failed to change language - reverting to previous
      }
    },
    [i18n, onLanguageChange, syncWithStorage]
  )

  const getCurrentLanguage = useCallback((): Language => {
    return (i18n.language as Language) || 'en'
  }, [i18n.language])

  const getLanguageInfo = useCallback(
    (lang?: Language) => {
      const currentLang = lang || getCurrentLanguage()
      return LANGUAGES[currentLang]
    },
    [getCurrentLanguage]
  )

  return {
    language: getCurrentLanguage(),
    languages: LANGUAGES,
    changeLanguage,
    getLanguageInfo,
    isReady: i18n.isInitialized,
  }
}