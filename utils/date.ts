import { format, formatDistance, formatRelative, parseISO, type Locale } from 'date-fns'
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import { enUS, es } from 'date-fns/locale'

const locales = {
  en: enUS,
  es: es,
} as const

export function getDateLocale(language: string) {
  return locales[language as keyof typeof locales] || enUS
}

/**
 * Get the user's timezone from the browser
 * Falls back to UTC if not available
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

/**
 * Convert a UTC date to the user's local timezone
 */
export function toUserTimezone(date: Date | string | null | undefined): Date | null {
  if (!date) return null

  const utcDate = typeof date === 'string' ? parseISO(date) : date
  const userTimezone = getUserTimezone()
  return toZonedTime(utcDate, userTimezone)
}

/**
 * Convert a local date to UTC for storage
 */
export function toUTC(date: Date | string | null | undefined): Date | null {
  if (!date) return null

  const localDate = typeof date === 'string' ? parseISO(date) : date
  const userTimezone = getUserTimezone()
  return fromZonedTime(localDate, userTimezone)
}

/**
 * Format a date in the user's timezone
 * @param date - The date to format (assumed to be in UTC)
 * @param formatString - Optional format string (defaults to 'MMM d, yyyy')
 * @param language - Optional language for localization
 */
export function formatDate(
  date: Date | string | null | undefined,
  formatString: string = 'MMM d, yyyy',
  language?: string
): string {
  if (!date) return '-'

  const utcDate = typeof date === 'string' ? parseISO(date) : date
  const userTimezone = getUserTimezone()
  const userDate = toZonedTime(utcDate, userTimezone)

  if (language) {
    const locale = getDateLocale(language)
    return format(userDate, formatString, { locale })
  }

  return formatInTimeZone(utcDate, userTimezone, formatString)
}

/**
 * Format a date and time in the user's timezone
 * @param date - The date to format (assumed to be in UTC)
 * @param formatString - Optional format string (defaults to 'MMM d, yyyy h:mm a')
 */
export function formatDateTime(
  date: Date | string | null | undefined,
  formatString: string = 'MMM d, yyyy h:mm a'
): string {
  if (!date) return '-'

  const utcDate = typeof date === 'string' ? parseISO(date) : date
  const userTimezone = getUserTimezone()
  return formatInTimeZone(utcDate, userTimezone, formatString)
}

/**
 * Format a date as relative time (e.g., "2 hours ago")
 * @param date - The date to format (assumed to be in UTC)
 * @param language - Optional language for localization
 */
export function formatRelativeTime(
  date: Date | string | null | undefined,
  language?: string
): string {
  if (!date) return '-'

  const utcDate = typeof date === 'string' ? parseISO(date) : date
  const userDate = toUserTimezone(utcDate)
  if (!userDate) return '-'

  const options: { addSuffix?: boolean; locale?: Locale } = { addSuffix: true }
  if (language) {
    options.locale = getDateLocale(language)
  }

  return formatDistance(userDate, new Date(), options)
}

/**
 * Format a date relative to today (e.g., "yesterday", "last Monday")
 * @param date - The date to format (assumed to be in UTC)
 * @param language - Optional language for localization
 */
export function formatRelativeDate(
  date: Date | string | null | undefined,
  language?: string
): string {
  if (!date) return '-'

  const utcDate = typeof date === 'string' ? parseISO(date) : date
  const userDate = toUserTimezone(utcDate)
  if (!userDate) return '-'

  const options: { locale?: Locale } = {}
  if (language) {
    options.locale = getDateLocale(language)
  }

  return formatRelative(userDate, new Date(), options)
}

/**
 * Format a time only in the user's timezone
 * @param date - The date to format (assumed to be in UTC)
 * @param formatString - Optional format string (defaults to 'h:mm a')
 */
export function formatTime(
  date: Date | string | null | undefined,
  formatString: string = 'h:mm a'
): string {
  if (!date) return '-'

  const utcDate = typeof date === 'string' ? parseISO(date) : date
  const userTimezone = getUserTimezone()
  return formatInTimeZone(utcDate, userTimezone, formatString)
}

/**
 * Get a display string showing both local time and timezone
 * Useful for showing timezone context to users
 */
export function formatDateTimeWithTimezone(date: Date | string | null | undefined): string {
  if (!date) return '-'

  const utcDate = typeof date === 'string' ? parseISO(date) : date
  const userTimezone = getUserTimezone()
  const formatted = formatInTimeZone(utcDate, userTimezone, 'MMM d, yyyy h:mm a zzz')
  return formatted
}
