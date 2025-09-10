import {
  SQL,
  and,
  or,
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  ilike,
  inArray,
  notInArray,
  isNull,
  isNotNull,
  between,
} from 'drizzle-orm'
import { PgColumn } from 'drizzle-orm/pg-core'

export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in'
  | 'notIn'
  | 'isNull'
  | 'isNotNull'

// Type guard for FilterOperator
function isFilterOperator(value: unknown): value is FilterOperator {
  return typeof value === 'string' && [
    'eq', 'ne', 'contains', 'startsWith', 'endsWith',
    'gt', 'gte', 'lt', 'lte', 'between', 'in', 'notIn',
    'isNull', 'isNotNull'
  ].includes(value)
}

export interface ColumnFilter {
  column: PgColumn
  operator?: FilterOperator
  value: unknown
}

export interface TableFilter {
  filters: ColumnFilter[]
  operator?: 'and' | 'or'
}

export function buildColumnFilter(filter: ColumnFilter): SQL | undefined {
  const { column, operator = 'eq', value } = filter

  // Handle null/undefined values
  if (value === null || value === undefined) {
    if (operator === 'isNull') return isNull(column)
    if (operator === 'isNotNull') return isNotNull(column)
    return undefined
  }

  switch (operator) {
    case 'eq':
      return eq(column, value)
    case 'ne':
      return ne(column, value)
    case 'contains':
      return ilike(column, `%${value}%`)
    case 'startsWith':
      return ilike(column, `${value}%`)
    case 'endsWith':
      return ilike(column, `%${value}`)
    case 'gt':
      return gt(column, value)
    case 'gte':
      return gte(column, value)
    case 'lt':
      return lt(column, value)
    case 'lte':
      return lte(column, value)
    case 'between':
      if (Array.isArray(value) && value.length === 2) {
        return between(column, value[0], value[1])
      }
      return undefined
    case 'in':
      if (Array.isArray(value)) {
        return inArray(column, value)
      }
      return undefined
    case 'notIn':
      if (Array.isArray(value)) {
        return notInArray(column, value)
      }
      return undefined
    case 'isNull':
      return isNull(column)
    case 'isNotNull':
      return isNotNull(column)
    default:
      return eq(column, value)
  }
}

export function buildTableFilters(tableFilter: TableFilter): SQL | undefined {
  const { filters, operator = 'and' } = tableFilter

  const conditions = filters.map(filter => buildColumnFilter(filter)).filter(Boolean) as SQL[]

  if (conditions.length === 0) return undefined
  if (conditions.length === 1) return conditions[0]

  return operator === 'and' ? and(...conditions) : or(...conditions)
}

export function parseFilterValue(value: unknown): { operator: FilterOperator; value: unknown } {
  // If value is an object with operator and value properties
  if (typeof value === 'object' && value !== null && 'operator' in value && 'value' in value) {
    const typed = value as { operator: unknown; value: unknown }
    // Ensure operator is a valid FilterOperator
    if (isFilterOperator(typed.operator)) {
      return { operator: typed.operator, value: typed.value }
    }
    // Default to 'eq' if operator is invalid
    return { operator: 'eq', value: typed.value }
  }

  // If value is an array, assume it's for "in" or "between" operator
  if (Array.isArray(value)) {
    // Check if it's a date range (2 elements that can be parsed as dates)
    if (
      value.length === 2 &&
      (value[0] instanceof Date ||
        (typeof value[0] === 'string' && !isNaN(Date.parse(value[0])))) &&
      (value[1] instanceof Date || (typeof value[1] === 'string' && !isNaN(Date.parse(value[1]))))
    ) {
      // Convert string dates to Date objects
      const startDate = value[0] instanceof Date ? value[0] : new Date(value[0])
      const endDate = value[1] instanceof Date ? value[1] : new Date(value[1])

      // For date ranges, use the start of first day and end of last day
      const rangeStart = new Date(startDate)
      rangeStart.setHours(0, 0, 0, 0)

      const rangeEnd = new Date(endDate)
      rangeEnd.setHours(23, 59, 59, 999)

      return { operator: 'between', value: [rangeStart, rangeEnd] }
    }
    // Check if it's a number range
    else if (value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
      return { operator: 'between', value }
    }
    // Otherwise it's for "in" operator
    return { operator: 'in', value }
  }

  // Special handling for Date values (both Date objects and ISO strings)
  if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
    const date = value instanceof Date ? value : new Date(value)

    // Convert single date to start/end of day range
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    return { operator: 'between', value: [startOfDay, endOfDay] }
  }

  // Default to "eq" operator for simple values
  return { operator: 'eq', value }
}

export function buildSearchFilter(searchColumns: PgColumn[], searchValue: string): SQL | undefined {
  if (!searchValue || searchColumns.length === 0) return undefined

  const searchConditions = searchColumns.map(column => ilike(column, `%${searchValue}%`))

  return searchConditions.length === 1 ? searchConditions[0] : or(...searchConditions)
}

export function preprocessFilterValue(columnId: string, value: unknown): unknown {
  // Handle boolean columns
  if (['completed', 'banned', 'status', 'emailVerified'].includes(columnId)) {
    return value === 'true' || value === true
  }

  // Handle date columns
  if (['createdAt', 'updatedAt', 'dueDate', 'joinedAt'].includes(columnId)) {
    return parseFilterValue(value)
  }

  return value
}
