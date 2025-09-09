# Architecture & Tech Stack Implementation Guide

This document provides comprehensive guidance for AI agents on understanding and implementing the complete technology stack and architectural patterns used in this TanStack SaaS starter template.

## 🚨 Critical Rules

- **ALWAYS use TanStack Start patterns** over generic React patterns
- **NEVER use client-side routing libraries** like React Router - use TanStack Router exclusively  
- **MUST use the established build system** with Vite + TanStack Start plugin
- **ALWAYS follow the established import alias patterns** (@/ and @/ui)

## ❌ Common AI Agent Mistakes

### Framework Violations
```typescript
// ❌ NEVER use generic React patterns
import { BrowserRouter } from 'react-router-dom'  // Wrong framework
useEffect(() => { fetch('/api/todos') }, [])      // Use server functions instead

// ❌ NEVER use generic state management
const [data, setData] = useState()
useEffect(() => { /* fetch logic */ }, [])        // Use TanStack Query instead
```

### Build System Violations
```typescript
// ❌ NEVER bypass the established build configuration
import { defineConfig } from 'vite'
export default defineConfig({
  plugins: [react()]  // Wrong - missing TanStack Start plugin
})
```

### Import Path Chaos
```typescript
// ❌ NEVER use inconsistent import paths
import Button from '../../../components/taali-ui/ui/button'  // Wrong
import { db } from '../../lib/db'                           // Wrong

// ✅ ALWAYS use established aliases
import { Button } from '@/ui/button'
import { db } from '@/lib/db/db'
```

## ✅ Established Patterns

### Complete Tech Stack Configuration

#### 1. **TanStack Start - Full-Stack Framework**
```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  plugins: [
    viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart({ customViteReactPlugin: true }),
    viteReact(),
  ],
  resolve: {
    alias: {
      '@/ui': resolve(__dirname, './src/components/taali-ui/ui'),
      '@': resolve(__dirname, './src')
    }
  },
  define: { global: 'globalThis' },
  optimizeDeps: { exclude: ['@tanstack/router-core'] },
  ssr: { noExternal: ['@tanstack/router-core'] },
})
```

#### 2. **TanStack Router - Type-Safe Routing**
```typescript
// src/router.tsx
import { createRouter as createTanstackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export const createRouter = () => {
  return createTanstackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  })
}

// Register for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
```

#### 3. **TypeScript Configuration**
```json
// tsconfig.json
{
  "include": ["**/*.ts", "**/*.tsx"],
  "compilerOptions": {
    "target": "ES2022",
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/ui/*": ["./src/components/taali-ui/ui/*"]
    }
  }
}
```

#### 4. **Package.json Scripts Configuration**
```json
{
  "scripts": {
    "dev": "vite dev --port 2847",
    "build": "vite build",
    "start": "node .output/server/index.mjs",
    "test": "vitest run",
    "lint": "eslint src/ --ext .ts,.tsx",
    "lint:fix": "eslint src/ --ext .ts,.tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "seed:todos": "tsx scripts/seed-todos.ts",
    "i18n:extract": "i18next-parser",
    "email:dev": "email dev --dir src/emails"
  }
}
```

## 🔧 Step-by-Step Implementation

### 1. Project Initialization
```bash
# Install dependencies
pnpm install

# Set up development environment
cp .env.example .env.local
# Configure environment variables:
# - DATABASE_URL
# - BETTER_AUTH_SECRET  
# - STRIPE_SECRET_KEY
# - GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET
```

### 2. Build System Setup
```typescript
// File: vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

const config = defineConfig({
  plugins: [
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart({
      customViteReactPlugin: true,
    }),
    viteReact(),
  ],
  resolve: {
    alias: {
      '@/ui': resolve(__dirname, './src/components/taali-ui/ui'),
      '@': resolve(__dirname, './src')
    }
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    exclude: ['@tanstack/router-core']
  },
  ssr: {
    noExternal: ['@tanstack/router-core'],
  },
})

export default config
```

### 3. Router Configuration
```typescript
// File: src/router.tsx
import { createRouter as createTanstackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export const createRouter = () => {
  return createTanstackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
```

## 🎯 Integration Requirements

### With Database Layer
```typescript
// Always use Drizzle ORM with PostgreSQL
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/database/schema'

const client = postgres(process.env.DATABASE_URL!)
export const db = drizzle(client, { schema })
```

### With Authentication System
```typescript
// Always integrate with Better Auth
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  // ... configuration
})
```

### With UI Components
```typescript
// Always use Taali UI components with proper imports
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Input } from '@/ui/input'

// For application-specific components
import { PageHeader } from '@/components/page-header'
import { ErrorBoundary } from '@/components/error-boundary'
import { ErrorState } from '@/components/error-state'
```

### With Error Handling Layer
```typescript
// Use standardized error handling hooks and components
import { useErrorHandler } from '@/lib/errors/hooks'
import { useResourceQuery } from '@/lib/hooks/use-resource-query'
import { useSupportingQuery } from '@/lib/hooks/use-supporting-query'
import { ErrorState } from '@/components/error-state'
import { parseError } from '@/lib/errors/client-handler'

// Table queries (lists/collections)
const { data, isError, error, refetch } = useTableQuery({
  queryKey: ['items'],
  queryFn: getItems,
})

if (isError && error) {
  return <ErrorState error={parseError(error)} onRetry={refetch} />
}

// Critical single resources
const { data, isError, error } = useResourceQuery({
  queryKey: ['item', id],
  queryFn: () => getItem(id),
  redirectOnError: '/' // Optional redirect on error
})

// Supporting/secondary data with graceful degradation
const { data: stats, showError } = useSupportingQuery({
  queryKey: ['stats'],
  queryFn: getStats,
})

{showError ? (
  <ErrorState variant="inline" error={parseError({ message: 'Stats unavailable' })} />
) : (
  <StatsDisplay stats={stats} />
)}
```

## 🧪 Testing Requirements

### Unit Testing Setup
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts']
  }
})
```

### Test Example Structure
```typescript
// src/test/example.test.ts
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('Component Tests', () => {
  it('should render with TanStack patterns', () => {
    // Test implementation
  })
})
```

## 📋 Implementation Checklist

Before considering the architecture complete, verify:

- [ ] **TanStack Start**: Plugin configured in vite.config.ts
- [ ] **TanStack Router**: Router created with proper type registration
- [ ] **TypeScript**: Strict configuration with path aliases
- [ ] **Build System**: All plugins loaded in correct order
- [ ] **Import Aliases**: @/ and @/ui aliases working
- [ ] **Environment**: Required environment variables configured
- [ ] **Database**: Drizzle ORM connected to PostgreSQL
- [ ] **Authentication**: Better Auth integrated with Drizzle adapter
- [ ] **UI System**: Tailwind CSS v4 + Radix UI + Taali UI
- [ ] **Error Handling**: Standardized patterns with proper hooks and components
- [ ] **Testing**: Vitest configured with proper setup

## 🚀 Framework-Specific Patterns

### TanStack Start Server Functions
```typescript
// Always use createServerFn for server-side logic
import { createServerFn } from '@tanstack/react-start'

export const serverAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(schema.parse)
  .handler(async ({ data, context }) => {
    // Server-side implementation
  })
```

### TanStack Query Integration
```typescript
// Always integrate Query with Router
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/todos/$id')({
  component: TodoPage,
  loader: ({ params }) => getTodoById({ data: { id: params.id } }),
})

function TodoPage() {
  const { id } = Route.useParams()
  const todoQuery = useQuery({
    queryKey: ['todos', id],
    queryFn: () => getTodoById({ data: { id } }),
  })
  // Component implementation
}
```

## 🎯 Performance Optimization

### Bundle Optimization
```typescript
// Proper code splitting with TanStack Router
export const Route = createFileRoute('/admin')({
  component: lazy(() => import('./admin-page')),
})
```

### Build Optimization
```typescript
// vite.config.ts optimizations
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['node:stream', 'stream'],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          tanstack: ['@tanstack/react-router', '@tanstack/react-query'],
        }
      }
    }
  }
})
```

This architecture provides a solid, type-safe foundation for building scalable SaaS applications with modern best practices and optimal performance characteristics.