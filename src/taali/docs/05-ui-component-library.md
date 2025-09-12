# UI Component Library (Taali UI) Implementation Guide

This document provides comprehensive guidance for implementing and extending the Taali UI component library, built on Radix UI primitives with Tailwind CSS v4, class-variance-authority, and advanced data table functionality.

## 🚨 Critical Rules

- **ALWAYS use Taali UI components** - Never create custom UI components without following established patterns
- **MUST use @/ui alias** - Import all UI components using the established alias pattern
- **NEVER mix styling approaches** - Use only Tailwind CSS with CVA variants
- **ALWAYS use cn() utility** - For className merging and conditional styling
- **MUST follow accessibility patterns** - All components built on Radix UI for accessibility

## ❌ Common AI Agent Mistakes

### Component Import Violations
```typescript
// ❌ NEVER use incorrect import paths
import { Button } from '../../../components/taali-ui/ui/button' // Wrong path
import { Button } from 'src/components/taali-ui/ui/button'       // Wrong path

// ✅ ALWAYS use established alias
import { Button } from '@/ui/button'
import { Card, CardHeader, CardContent } from '@/ui/card'
```

### Styling Pattern Violations
```typescript
// ❌ NEVER use inline styles or CSS modules
<Button style={{ backgroundColor: 'red' }}>Click me</Button>       // Wrong
<Button className="bg-red-500 text-white">Click me</Button>        // Wrong

// ❌ NEVER bypass CVA variants
<Button className="bg-destructive text-white">Delete</Button>       // Wrong

// ✅ ALWAYS use established variants
<Button variant="destructive">Delete</Button>
<Button variant="outline" size="lg">Large Button</Button>
```

### Class Merging Violations
```typescript
// ❌ NEVER concatenate classNames manually
const className = "bg-primary " + isActive ? "opacity-100" : "opacity-50" // Wrong

// ✅ ALWAYS use cn() utility
import { cn } from '@/ui/lib/utils'
const className = cn("bg-primary", isActive && "opacity-100", !isActive && "opacity-50")
```

### Data Table Misuse
```typescript
// ❌ NEVER create custom data tables
<table>
  <tr><th>Name</th></tr>
  {data.map(item => <tr><td>{item.name}</td></tr>)}
</table>

// ✅ ALWAYS use DataTable component
import { DataTable } from '@/ui/data-table'
<DataTable columns={columns} data={data} config={config} />
```

## ✅ Established Patterns

### 1. **Core Component Architecture**
```typescript
// File: src/components/taali-ui/ui/button.tsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'

import { cn } from '../lib/utils'

const buttonVariants = cva(
  // Base styles
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive: 'bg-destructive text-white shadow-xs hover:bg-destructive/90',
        outline: 'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

interface ButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" />}
        {children}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

### 2. **Utility Functions**
```typescript
// File: src/components/taali-ui/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### 3. **Advanced Data Table System**
```typescript
// File: src/components/taali-ui/data-table/data-table.tsx
import { ColumnDef, useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table'
import { DataTableConfig, ServerQueryParams } from './types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { DataTableToolbar } from './data-table-toolbar'
import { DataTablePagination } from './data-table-pagination'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  config?: DataTableConfig<TData>
  totalCount?: number
  isLoading?: boolean
  isFetching?: boolean
  onStateChange?: (state: any) => void
  onSelectionChange?: (selection: SelectionState, clearSelection: () => void) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  config = {},
  totalCount,
  isLoading,
  isFetching,
  onStateChange,
  onSelectionChange,
}: DataTableProps<TData, TValue>) {
  const {
    manualFiltering = false,
    manualPagination = false,
    manualSorting = false,
    enableColumnFilters = true,
    enableRowSelection = false,
  } = config

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualFiltering,
    manualPagination,
    manualSorting,
    // ... additional table configuration
  })

  return (
    <div className="space-y-4">
      {/* Toolbar with search and filters */}
      {enableColumnFilters && (
        <DataTableToolbar
          table={table}
          config={config}
          isLoading={isLoading}
          isFetching={isFetching}
        />
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeleton rows
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  {columns.map((_, colIndex) => (
                    <TableCell key={colIndex}>
                      <Skeleton className="h-4 w-[100px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {manualPagination && (
        <DataTablePagination
          table={table}
          totalCount={totalCount}
          config={config.paginationConfig}
        />
      )}
    </div>
  )
}
```

### 4. **Data Table Hook Integration**
```typescript
// File: src/components/taali-ui/hooks/use-table-query.ts
import { useQuery } from '@tanstack/react-query'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { DataTableState, ServerQueryParams, ServerQueryResponse } from '../data-table/types'

interface UseTableQueryOptions<TData> {
  queryKey: string[]
  queryFn: (params: ServerQueryParams) => Promise<ServerQueryResponse<TData>>
  defaultPageSize?: number
  debounceMs?: number
  enabled?: boolean
  staleTime?: number
}

export function useTableQuery<TData>({
  queryKey,
  queryFn,
  defaultPageSize = 10,
  debounceMs = 300,
  enabled = true,
  staleTime = 1000 * 60,
}: UseTableQueryOptions<TData>) {
  const [tableState, setTableState] = useState<DataTableState>({
    search: '',
    columnFilters: [],
    sorting: [],
    pagination: {
      pageIndex: 0,
      pageSize: defaultPageSize,
    },
  })

  const [debouncedState, setDebouncedState] = useState(tableState)

  // Debounce state changes for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedState(tableState)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [tableState, debounceMs])

  // Convert table state to server query params
  const serverParams = useMemo<ServerQueryParams>(() => {
    const filters: Record<string, any> = {}
    
    debouncedState.columnFilters.forEach(filter => {
      if (filter.value !== undefined && filter.value !== '') {
        filters[filter.id] = filter.value
      }
    })

    return {
      search: debouncedState.search || '',
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sorting: debouncedState.sorting.length > 0 ? debouncedState.sorting : undefined,
      pagination: debouncedState.pagination,
    }
  }, [debouncedState])

  // Create query with server params
  const fullQueryKey = useMemo(() => [...queryKey, serverParams], [queryKey, serverParams])

  const query = useQuery({
    queryKey: fullQueryKey,
    queryFn: () => queryFn(serverParams),
    enabled,
    staleTime,
    placeholderData: previousData => previousData, // Keep previous data while loading
  })

  const handleStateChange = useCallback((newState: Partial<DataTableState>) => {
    setTableState(prev => ({ ...prev, ...newState }))
  }, [])

  return {
    data: query.data?.data || [],
    totalCount: query.data?.totalCount || 0,
    pageCount: query.data?.pageCount || 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    tableState,
    onStateChange: handleStateChange,
  }
}
```

### 5. **Form System with React Hook Form**
```typescript
// File: src/components/taali-ui/ui/form.tsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form'

import { cn } from '../lib/utils'
import { Label } from './label'

const Form = FormProvider

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext.name })
  const fieldState = getFieldState(fieldContext.name, formState)

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

// Form components following established patterns
const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const id = React.useId()

    return (
      <FormItemContext.Provider value={{ id }}>
        <div ref={ref} className={cn('space-y-2', className)} {...props} />
      </FormItemContext.Provider>
    )
  }
)

const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField()

  return (
    <Label
      ref={ref}
      className={cn(error && 'text-destructive', className)}
      htmlFor={formItemId}
      {...props}
    />
  )
})

const FormControl = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={!error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`}
      aria-invalid={!!error}
      {...props}
    />
  )
})

export { Form, FormItem, FormLabel, FormControl, FormField, useFormField }
```

### 6. **Autosave Form Hook**
```typescript
// File: src/lib/hooks/use-form-autosave.tsx
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { debounce } from 'lodash'

interface UseFormAutosaveOptions<T> {
  initialData: T
  onSave: (data: T) => Promise<void | T>
  debounceMs?: number
  enabled?: boolean
  validate?: (data: T) => { isValid: boolean; errors: string[] }
  compareFunction?: (a: T, b: T) => boolean
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

export function useFormAutosave<T extends Record<string, any>>({
  initialData,
  onSave,
  debounceMs = 3000,
  enabled = true,
  validate,
  compareFunction,
}: UseFormAutosaveOptions<T>): UseFormAutosaveResult<T> {
  const [data, setData] = useState<T>(initialData)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const lastSavedDataRef = useRef<T>(initialData)
  const savePromiseRef = useRef<Promise<void> | null>(null)
  const mountedRef = useRef(true)

  // Check if data is different from last saved
  const isDirty = useCallback(() => {
    if (compareFunction) {
      return !compareFunction(data, lastSavedDataRef.current)
    }
    return JSON.stringify(data) !== JSON.stringify(lastSavedDataRef.current)
  }, [data, compareFunction])

  // Debounced save function
  const debouncedSave = useMemo(
    () => debounce(async () => {
      if (!enabled || !isDirty()) return

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

          const savedData = result || data
          lastSavedDataRef.current = savedData as T
          setData(savedData as T)
          setLastSaved(new Date())
          setErrors([])
        } catch (error) {
          if (!mountedRef.current) return
          const message = error instanceof Error ? error.message : 'Save failed'
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
    }, debounceMs),
    [data, enabled, isDirty, validate, onSave, debounceMs]
  )

  // Auto-save on data change
  useEffect(() => {
    if (enabled && isDirty()) {
      debouncedSave()
    }
  }, [data, enabled, isDirty, debouncedSave])

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      debouncedSave.cancel()
    }
  }, [debouncedSave])

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setData(prev => ({ ...prev, [field]: value }))
  }, [])

  const updateData = useCallback((updates: Partial<T>) => {
    setData(prev => ({ ...prev, ...updates }))
  }, [])

  const saveNow = useCallback(async () => {
    debouncedSave.cancel()
    await debouncedSave.flush() // Execute immediately
  }, [debouncedSave])

  const reset = useCallback((newData?: T) => {
    const dataToSet = newData || initialData
    setData(dataToSet)
    lastSavedDataRef.current = dataToSet
    setLastSaved(null)
    setErrors([])
    debouncedSave.cancel()
  }, [initialData, debouncedSave])

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
```

## 🔧 Step-by-Step Implementation

### 1. Theme Configuration
```css
/* File: src/styles.css */
@import 'tailwindcss';
@import 'tw-animate-css';

@custom-variant dark (&:is(.dark *));

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  
  /* Color system using OKLCH */
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-destructive: var(--destructive);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-info: var(--info);
}

:root {
  --radius: 0.625rem;
  --primary: oklch(0.21 0.006 285.885);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.967 0.001 286.375);
  --secondary-foreground: oklch(0.21 0.006 285.885);
  --destructive: oklch(0.577 0.245 27.325);
  --success: oklch(0.5 0.15 142);
  --warning: oklch(0.65 0.17 70);
  --info: oklch(0.55 0.15 230);
}

.dark {
  --primary: oklch(0.6 0.02 280);
  --primary-foreground: oklch(0.1 0.01 280);
  /* Dark mode color overrides */
}
```

### 2. Creating New Components
```typescript
// Template for new UI components
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

const componentVariants = cva(
  // Base styles
  "base-classes-here",
  {
    variants: {
      variant: {
        default: "default-styles",
        secondary: "secondary-styles",
      },
      size: {
        default: "default-size",
        sm: "small-size",
        lg: "large-size",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface ComponentProps
  extends React.ComponentProps<'div'>, // or appropriate HTML element
    VariantProps<typeof componentVariants> {
  // Additional props
}

const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <div
        className={cn(componentVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Component.displayName = 'Component'

export { Component, componentVariants }
```

### 3. Data Table Implementation
```typescript
// Example usage of DataTable with server-side features
import { DataTable } from '@/ui/data-table'
import { useTableQuery } from '@/ui/hooks/use-table-query'
import { ColumnDef } from '@tanstack/react-table'

interface TodoData {
  id: string
  title: string
  completed: boolean
  createdAt: string
}

const columns: ColumnDef<TodoData>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
      />
    ),
  },
  {
    accessorKey: 'title',
    header: ({ column }) => (
      <DataTableHeader column={column} sortable>
        Title
      </DataTableHeader>
    ),
    enableSorting: true,
    meta: {
      filterConfig: {
        type: 'text',
        placeholder: 'Search titles...',
      },
    },
  },
  {
    accessorKey: 'completed',
    header: ({ column }) => (
      <DataTableHeader column={column} sortable>
        Status
      </DataTableHeader>
    ),
    enableSorting: true,
    meta: {
      filterConfig: {
        type: 'select',
        options: [
          { label: 'All', value: '' },
          { label: 'Completed', value: 'true' },
          { label: 'Pending', value: 'false' },
        ],
      },
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => editTodo(row.original.id)}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => deleteTodo(row.original.id)}
            className="text-destructive"
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

function TodosTable() {
  const {
    data,
    totalCount,
    isLoading,
    isFetching,
    tableState,
    onStateChange,
  } = useTableQuery<TodoData>({
    queryKey: ['todos'],
    queryFn: getTodosWithFilters, // Server function
    defaultPageSize: 20,
  })

  const config = {
    enableColumnFilters: true,
    enableRowSelection: true,
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    searchConfig: {
      placeholder: 'Search todos...',
    },
    paginationConfig: {
      pageSizeOptions: [10, 20, 50, 100],
    },
    selectionConfig: {
      enableBulkActions: true,
      bulkActions: [
        {
          id: 'delete',
          label: 'Delete selected',
          icon: Trash2,
          variant: 'destructive',
          onClick: handleBulkDelete,
        },
        {
          id: 'complete',
          label: 'Mark completed',
          icon: CheckCircle,
          onClick: handleBulkComplete,
        },
      ],
    },
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      config={config}
      totalCount={totalCount}
      isLoading={isLoading}
      isFetching={isFetching}
      onStateChange={onStateChange}
    />
  )
}
```

## 🎯 Integration Requirements

### With TanStack Query
```typescript
// Data table hooks integrate seamlessly with TanStack Query
const queryResult = useTableQuery({
  queryKey: ['todos', organizationId],
  queryFn: (params: ServerQueryParams) => getTodosServer(params),
  enabled: !!organizationId,
})

// Mutations for table actions
const deleteMutation = useMutation({
  mutationFn: deleteTodoServer,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] })
  },
})
```

### With Error Handling Components

The Taali UI library includes comprehensive error handling components that integrate with the application's error management system:

#### ErrorState Component Variants
```typescript
import { ErrorState } from '@/components/error-state'
import { parseError } from '@/lib/errors/client-handler'

// Full-page error (default variant)
<ErrorState 
  error={parseError(error)} 
  onRetry={refetch}
/>

// Inline error for supporting data
<ErrorState 
  error={parseError(error)}
  variant="inline"
  onRetry={refetch}
/>

// Card error for contained sections  
<ErrorState
  error={parseError(error)}
  variant="card"
  onRetry={refetch}
/>
```

#### Error Integration with Data Tables
```typescript
import { DataTable, useTableQuery } from '@/components/taali-ui/data-table'
import { ErrorState } from '@/components/error-state'

function TodosTable() {
  const { data, isError, error, isLoading, refetch } = useTableQuery({
    queryKey: ['todos'],
    queryFn: getTodosTable,
  })

  // Built-in error handling pattern
  if (isError && error && !isLoading) {
    return <ErrorState error={parseError(error)} onRetry={refetch} />
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      config={config}
    />
  )
}
```

#### Error States for Supporting Data
```typescript
import { useSupportingQuery } from '@/lib/hooks/use-supporting-query'

function StatsSection() {
  const { data: stats, showError } = useSupportingQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  })

  return (
    <div className="grid grid-cols-3 gap-4">
      {showError ? (
        <div className="col-span-full">
          <ErrorState 
            variant="inline"
            error={parseError({ message: 'Unable to load statistics' })}
          />
        </div>
      ) : (
        stats && <StatsCards stats={stats} />
      )}
    </div>
  )
}
```

### With Form Systems
```typescript
// Combining form components with validation
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/ui/form'

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
})

function TodoForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Enter todo title..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter description..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" loading={isSubmitting}>
          Create Todo
        </Button>
      </form>
    </Form>
  )
}
```

### With Theme System
```typescript
// Theme provider integration
import { ThemeProvider } from 'next-themes'

function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <YourApp />
    </ThemeProvider>
  )
}

// Theme toggle component
import { useTheme } from 'next-themes'
import { Button } from '@/ui/button'
import { Moon, Sun } from 'lucide-react'

function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
```

## 🧪 Testing Requirements

### Component Testing
```typescript
// Component testing with proper imports
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/ui/button'

describe('Button', () => {
  it('should render with correct variant classes', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-destructive')
  })

  it('should show loading state', () => {
    render(<Button loading>Save</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('disabled')
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })
})
```

### Data Table Testing
```typescript
// Data table testing patterns
import { DataTable } from '@/ui/data-table'

describe('DataTable', () => {
  const mockData = [
    { id: '1', title: 'Test Todo', completed: false },
  ]

  const mockColumns = [
    { accessorKey: 'title', header: 'Title' },
    { accessorKey: 'completed', header: 'Status' },
  ]

  it('should render table with data', () => {
    render(<DataTable columns={mockColumns} data={mockData} />)
    expect(screen.getByText('Test Todo')).toBeInTheDocument()
  })

  it('should handle loading state', () => {
    render(
      <DataTable 
        columns={mockColumns} 
        data={[]} 
        isLoading={true}
        config={{ loadingConfig: { skeletonRowCount: 3 } }}
      />
    )
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(3)
  })
})
```

## 📋 Implementation Checklist

Before considering UI component implementation complete, verify:

- [ ] **Import Aliases**: All components use @/ui imports
- [ ] **CVA Variants**: All components use class-variance-authority
- [ ] **Accessibility**: All components built on Radix UI primitives
- [ ] **TypeScript**: Full type safety with proper interfaces
- [ ] **Theme Support**: Components support light/dark themes
- [ ] **Responsive Design**: Components work across all screen sizes
- [ ] **Loading States**: Components handle loading and error states
- [ ] **Focus Management**: Proper keyboard navigation
- [ ] **ARIA Labels**: Screen reader accessibility
- [ ] **Animation**: Smooth transitions using Tailwind

## 🚀 Advanced Patterns

### Complex Data Table Features
```typescript
// Advanced filtering with dynamic options
const advancedColumns: ColumnDef<TodoData>[] = [
  {
    accessorKey: 'assignedTo',
    header: ({ column }) => (
      <DataTableHeader column={column} sortable>
        Assigned To
      </DataTableHeader>
    ),
    enableSorting: true,
    meta: {
      filterConfig: {
        type: 'dynamicSelect',
        loadOptions: async () => {
          const users = await getOrganizationMembers()
          return {
            options: users.map(user => ({
              label: user.name,
              value: user.id,
            }))
          }
        },
      },
    },
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => (
      <DataTableHeader column={column} sortable>
        Priority
      </DataTableHeader>
    ),
    enableSorting: true,
    meta: {
      filterConfig: {
        type: 'select',
        options: [
          { label: 'High', value: 'high', icon: ArrowUp },
          { label: 'Medium', value: 'medium', icon: Minus },
          { label: 'Low', value: 'low', icon: ArrowDown },
        ],
      },
    },
  },
]
```

### Custom Hook Composition
```typescript
// Combining multiple hooks for complex forms
export function useEditTodoForm(todoId: string) {
  const { data: todo } = useQuery({
    queryKey: ['todos', todoId],
    queryFn: () => getTodoById(todoId),
  })

  const updateMutation = useMutation({
    mutationFn: updateTodo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })

  const autosave = useFormAutosave({
    initialData: todo || {},
    onSave: updateMutation.mutateAsync,
    debounceMs: 2000,
    enabled: !!todo,
  })

  return {
    ...autosave,
    isLoading: !todo,
    isSaving: autosave.isSaving || updateMutation.isPending,
  }
}
```

## 📊 Column Header Patterns

### Regular Data Columns

**IMPORTANT**: ALL regular data columns MUST use the `DataTableHeader` component for consistency, regardless of whether they are sortable or not.

#### Sortable Column Pattern
```typescript
{
  accessorKey: 'customerName',
  header: ({ column }) => (
    <DataTableHeader column={column} sortable>
      Customer Name
    </DataTableHeader>
  ),
  enableSorting: true,
  cell: ({ row }) => row.original.customerName,
}
```

#### Non-Sortable Column Pattern
```typescript
{
  accessorKey: 'phone',
  header: ({ column }) => (
    <DataTableHeader column={column}>
      Phone
    </DataTableHeader>
  ),
  enableSorting: false,
  cell: ({ row }) => row.original.phone || 'N/A',
}
```

### Special Columns (Exceptions)

These column types should NOT use DataTableHeader:

#### Selection/Checkbox Columns
```typescript
{
  id: 'select',
  header: ({ table }) => (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(value) => row.toggleSelected(!!value)}
    />
  ),
}
```

#### Action Columns
```typescript
{
  id: 'actions',
  header: () => null,  // No header for action columns
  cell: ({ row }) => (
    <DropdownMenu>
      {/* Action menu items */}
    </DropdownMenu>
  ),
}
```

### Why Use DataTableHeader for All Regular Columns?

1. **Consistent Styling**: All column headers get the same `font-medium` styling
2. **Future-Proof**: Easy to toggle sorting on/off by adding/removing the `sortable` prop
3. **Single Pattern**: Developers only need to remember one pattern for data columns
4. **Accessibility**: Built-in keyboard navigation and ARIA attributes

### Common Mistakes to Avoid

```typescript
// ❌ WRONG - Plain string header for data column
{
  accessorKey: 'description',
  header: 'Description',  // Missing DataTableHeader
  cell: ({ row }) => row.original.description,
}

// ❌ WRONG - Missing enableSorting property
{
  accessorKey: 'name',
  header: ({ column }) => (
    <DataTableHeader column={column} sortable>
      Name
    </DataTableHeader>
  ),
  // Missing: enableSorting: true
}

// ✅ CORRECT - Proper implementation
{
  accessorKey: 'description',
  header: ({ column }) => (
    <DataTableHeader column={column}>
      Description
    </DataTableHeader>
  ),
  enableSorting: false,
  cell: ({ row }) => row.original.description,
}
```

This UI component system provides a comprehensive foundation for building consistent, accessible, and performant user interfaces with advanced features like real-time data tables, form autosave, and theme management.