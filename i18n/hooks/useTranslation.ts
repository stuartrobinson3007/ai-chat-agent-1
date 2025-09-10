import { useTranslation as useI18nTranslation } from 'react-i18next'

import type { Namespace } from '../constants'

export function useTranslation(ns?: Namespace | Namespace[]) {
  const { t, i18n, ready } = useI18nTranslation(ns)

  return {
    t: t as (key: string, options?: Record<string, unknown>) => string,
    i18n,
    language: i18n.language,
    changeLanguage: i18n.changeLanguage,
    ready,
    isLoading: !ready,
  }
}
