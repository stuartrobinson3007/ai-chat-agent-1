import { format, formatDistance, formatRelative } from 'date-fns'
import { enUS, es } from 'date-fns/locale'

import type { Language } from '../constants'

const locales = {
  en: enUS,
  es: es,
} as const

export function getDateLocale(language: Language) {
  return locales[language] || enUS
}

export function formatDate(date: Date, formatStr: string, language: Language) {
  return format(date, formatStr, {
    locale: getDateLocale(language),
  })
}

export function formatRelativeTime(date: Date, baseDate: Date, language: Language) {
  return formatRelative(date, baseDate, {
    locale: getDateLocale(language),
  })
}

export function formatTimeDistance(date: Date, baseDate: Date, language: Language) {
  return formatDistance(date, baseDate, {
    locale: getDateLocale(language),
    addSuffix: true,
  })
}

export function formatNumber(
  value: number,
  language: Language,
  options?: Intl.NumberFormatOptions
) {
  return new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US', options).format(value)
}

export function formatCurrency(value: number, currency: string, language: Language) {
  return new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US', {
    style: 'currency',
    currency: currency,
  }).format(value)
}

export function formatPercent(value: number, language: Language) {
  return new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}
