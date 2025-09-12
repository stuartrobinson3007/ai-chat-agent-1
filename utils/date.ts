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

/**
 * Convert a date to a specific timezone
 * @param date - The date to convert (UTC or local)
 * @param timezone - Target timezone (e.g., 'America/New_York')
 */
export function toTimezone(
  date: Date | string | null | undefined, 
  timezone: string
): Date | null {
  if (!date) return null
  const utcDate = typeof date === 'string' ? parseISO(date) : date
  return toZonedTime(utcDate, timezone)
}

/**
 * Convert a date from a specific timezone to UTC
 * @param date - The date in the specified timezone
 * @param timezone - The timezone the date is currently in
 */
export function fromTimezone(
  date: Date | string | null | undefined,
  timezone: string
): Date | null {
  if (!date) return null
  const localDate = typeof date === 'string' ? parseISO(date) : date
  return fromZonedTime(localDate, timezone)
}

/**
 * Format a date in a specific timezone
 * @param date - The UTC date to format
 * @param timezone - The timezone to format in
 * @param formatString - Format string
 */
export function formatInTimezone(
  date: Date | string | null | undefined,
  timezone: string,
  formatString: string = 'MMM d, yyyy h:mm a'
): string {
  if (!date) return '-'
  const utcDate = typeof date === 'string' ? parseISO(date) : date
  return formatInTimeZone(utcDate, timezone, formatString)
}

/**
 * Parse a time string (12-hour) to 24-hour format
 * Handles formats: "9:30am", "9:30 am", "9:30AM", "09:30am"
 * @param time12h - Time in 12-hour format
 * @returns Time in 24-hour format (e.g., "09:30", "14:15")
 */
export function to24HourTime(time12h: string): string {
  // Handle various formats with optional space
  const match = time12h.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i)
  if (!match) throw new Error(`Invalid time format: ${time12h}`)
  
  let [_, hours, minutes, period] = match
  let hour = parseInt(hours)
  
  // Handle noon and midnight edge cases
  if (period.toLowerCase() === 'pm' && hour !== 12) {
    hour += 12
  } else if (period.toLowerCase() === 'am' && hour === 12) {
    hour = 0
  }
  
  return `${hour.toString().padStart(2, '0')}:${minutes}`
}

/**
 * Combine date and time strings into a Date object
 * @param dateStr - Date string (e.g., "2024-01-15" or ISO string)
 * @param timeStr - Time string (e.g., "9:30am")
 * @param timezone - Timezone to interpret the date/time in
 */
export function combineDateAndTime(
  dateStr: string,
  timeStr: string,
  timezone: string
): Date {
  // Extract just the date part if it's an ISO string
  const datePart = dateStr.split('T')[0]
  const time24 = to24HourTime(timeStr)
  const dateTimeStr = `${datePart}T${time24}:00`
  const localDate = parseISO(dateTimeStr)
  return fromZonedTime(localDate, timezone)
}
