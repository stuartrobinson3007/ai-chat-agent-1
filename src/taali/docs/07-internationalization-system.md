# Internationalization (i18n) System Implementation Guide

This document provides comprehensive guidance for implementing and extending the internationalization system using i18next with automated string extraction, namespace organization, and client/server translation patterns.

## 🚨 Critical Rules

- **ALWAYS use namespaced translations** - Never use generic translation keys
- **MUST use established namespace pattern** - namespace:key.subkey format
- **NEVER hardcode user-facing strings** - All text must be translatable
- **ALWAYS include fallback translations** - Provide fallbacks for server-side usage
- **MUST use automated extraction** - Use i18next-parser for string discovery

## ❌ Common AI Agent Mistakes

### Hardcoded String Violations
```typescript
// ❌ NEVER hardcode user-facing text
<Button>Create Todo</Button>                    // Wrong
throw new Error('Todo not found')               // Wrong
const message = 'Welcome to the application'   // Wrong

// ✅ ALWAYS use translations
<Button>{t('todos:actions.create')}</Button>
throw AppError.notFound(t('errors:todoNotFound', 'Todo'))
const message = t('auth:welcome')
```

### Translation Key Pattern Violations
```typescript
// ❌ NEVER use inconsistent key patterns
t('CreateTodo')                    // Wrong - not namespaced
t('create_todo_button')            // Wrong - not following camelCase
t('buttons.create.todo.action')    // Wrong - too nested

// ✅ ALWAYS use established namespace patterns
t('todos:actions.create')          // Correct
t('common:buttons.save')           // Correct
t('errors:validation.required')    // Correct
```

### Server-Side Translation Violations
```typescript
// ❌ NEVER use client hooks in server functions
import { useTranslation } from '@/i18n/hooks/useTranslation'

export const serverAction = createServerFn({ method: 'POST' })
  .handler(async () => {
    const { t } = useTranslation() // Wrong - client hook in server context
    throw new Error(t('errors:failed'))
  })

// ✅ ALWAYS import translations directly in server functions
import errorTranslations from '@/i18n/locales/en/errors.json'

export const serverAction = createServerFn({ method: 'POST' })
  .handler(async () => {
    throw new AppError('ERROR_CODE', 500, undefined, errorTranslations.server.failed)
  })
```

## ✅ Established Patterns

### 1. **i18n Configuration**
```typescript
// File: src/i18n/config.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import { DEFAULT_LANGUAGE, NAMESPACES } from './constants'

// Import all translation files
import enCommon from './locales/en/common.json'
import enAuth from './locales/en/auth.json'
import enTodos from './locales/en/todos.json'
import enTeam from './locales/en/team.json'
import enBilling from './locales/en/billing.json'
import enAdmin from './locales/en/admin.json'
import enErrors from './locales/en/errors.json'
import enValidation from './locales/en/validation.json'
import enNotifications from './locales/en/notifications.json'
import enProfile from './locales/en/profile.json'
import enSettings from './locales/en/settings.json'
import enInvitations from './locales/en/invitations.json'
import enEmail from './locales/en/email.json'

// Import Spanish translations
import esCommon from './locales/es/common.json'
import esAuth from './locales/es/auth.json'
import esTodos from './locales/es/todos.json'
import esTeam from './locales/es/team.json'
import esBilling from './locales/es/billing.json'
import esAdmin from './locales/es/admin.json'
import esErrors from './locales/es/errors.json'
import esValidation from './locales/es/validation.json'
import esNotifications from './locales/es/notifications.json'
import esProfile from './locales/es/profile.json'
import esSettings from './locales/es/settings.json'
import esInvitations from './locales/es/invitations.json'
import esEmail from './locales/es/email.json'

export const defaultNS = 'common'

export const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    todos: enTodos,
    team: enTeam,
    billing: enBilling,
    admin: enAdmin,
    errors: enErrors,
    validation: enValidation,
    notifications: enNotifications,
    profile: enProfile,
    settings: enSettings,
    invitations: enInvitations,
    email: enEmail,
  },
  es: {
    common: esCommon,
    auth: esAuth,
    todos: esTodos,
    team: esTeam,
    billing: esBilling,
    admin: esAdmin,
    errors: esErrors,
    validation: esValidation,
    notifications: esNotifications,
    profile: esProfile,
    settings: esSettings,
    invitations: esInvitations,
    email: esEmail,
  },
} as const

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: DEFAULT_LANGUAGE,
    debug: import.meta.env.DEV,
    ns: NAMESPACES,
    defaultNS,
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    react: {
      useSuspense: false, // Important for SSR
    },
    resources,
  })

export default i18n
```

### 2. **Translation Hook**
```typescript
// File: src/i18n/hooks/useTranslation.ts
import { useTranslation as useI18nTranslation } from 'react-i18next'

import type { Namespace } from '../constants'

export function useTranslation(ns?: Namespace | Namespace[]) {
  const { t, i18n, ready } = useI18nTranslation(ns)

  return {
    t,
    i18n,
    language: i18n.language,
    changeLanguage: i18n.changeLanguage,
    ready,
    isLoading: !ready,
  }
}
```

### 3. **Translation Constants**
```typescript
// File: src/i18n/constants.ts
export const DEFAULT_LANGUAGE = 'en' as const

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
] as const

export const NAMESPACES = [
  'common',
  'auth',
  'todos',
  'team',
  'billing',
  'admin',
  'errors',
  'validation',
  'notifications',
  'profile',
  'settings',
  'invitations',
  'email',
] as const

export type Namespace = (typeof NAMESPACES)[number]
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code']
```

### 4. **Automated String Extraction Configuration**
```javascript
// File: i18next-parser.config.js
export default {
  // Target locales
  locales: ['en', 'es'],
  
  // Output format matching our structure
  output: 'src/i18n/locales/$LOCALE/$NAMESPACE.json',
  
  // Input files to scan
  input: 'src/**/*.{ts,tsx}',
  
  // Lexer configuration for TypeScript/React
  lexers: {
    ts: ['JavascriptLexer'],
    tsx: ['JsxLexer'],
    default: ['JavascriptLexer']
  },
  
  // Namespace and key separators
  namespaceSeparator: ':',
  keySeparator: '.',
  
  // Translation function names to detect
  functions: ['t', 'useTranslation'],
  
  // Default namespace
  defaultNamespace: 'common',
  
  // React component support  
  componentFunctions: ['Trans'],
  
  // Sort keys alphabetically
  sort: true,
  
  // Verbose output
  verbose: true,
  
  // Custom functions to detect
  javascriptLexer: {
    functions: ['t', 'useTranslation']
  },
  
  jsxLexer: {
    functions: ['t'],
    attr: 'i18nKey',
    componentFunctions: ['Trans']
  }
}
```

### 5. **Client-Side Usage Patterns**
```typescript
// Component usage with multiple namespaces
import { useTranslation } from '@/i18n/hooks/useTranslation'

function TodoComponent() {
  const { t } = useTranslation(['todos', 'common'])
  
  return (
    <div>
      <h1>{t('todos:page.title')}</h1>
      <Button>{t('common:actions.save')}</Button>
      <p>{t('todos:description.empty')}</p>
    </div>
  )
}

// Language switcher component
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { SUPPORTED_LANGUAGES } from '@/i18n/constants'

function LanguageSwitcher() {
  const { language, changeLanguage } = useTranslation()

  return (
    <Select value={language} onValueChange={changeLanguage}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

### 6. **Server-Side Translation Patterns**
```typescript
// Server function with translations
import errorTranslations from '@/i18n/locales/en/errors.json'
import { ValidationError, AppError } from '@/lib/utils/errors'

export const serverAction = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    try {
      return schema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fields: Record<string, string[]> = {}
        error.errors.forEach((err: any) => {
          const path = err.path.join('.')
          if (!fields[path]) fields[path] = []

          // Use translation keys for validation errors
          if (err.code === 'too_small' && err.minimum === 1) {
            fields[path].push('VAL_REQUIRED_FIELD')
          } else {
            fields[path].push('VAL_INVALID_FORMAT')
          }
        })
        throw new ValidationError(fields, errorTranslations.server.validationFailed)
      }
      throw error
    }
  })
  .handler(async ({ data, context }) => {
    // Use translation keys in error messages
    if (!data.title) {
      throw new AppError(
        'VAL_REQUIRED_FIELD', 
        400, 
        { field: 'title' },
        errorTranslations.fields.title // Fallback message
      )
    }
  })
```

## 🔧 Step-by-Step Implementation

### 1. Adding New Translation Namespaces
```bash
# 1. Create new namespace files
mkdir -p src/i18n/locales/en
mkdir -p src/i18n/locales/es

# 2. Create namespace JSON files
touch src/i18n/locales/en/newfeature.json
touch src/i18n/locales/es/newfeature.json
```

```json
// File: src/i18n/locales/en/newfeature.json
{
  "page": {
    "title": "New Feature",
    "description": "Manage your new feature"
  },
  "actions": {
    "create": "Create Item",
    "edit": "Edit Item",
    "delete": "Delete Item"
  },
  "validation": {
    "nameRequired": "Name is required",
    "nameInvalid": "Name must be at least 3 characters"
  }
}
```

```typescript
// 3. Update constants
// File: src/i18n/constants.ts
export const NAMESPACES = [
  'common',
  'auth',
  'todos',
  'newfeature', // Add new namespace
  // ... other namespaces
] as const
```

```typescript
// 4. Update config imports
// File: src/i18n/config.ts
import enNewfeature from './locales/en/newfeature.json'
import esNewfeature from './locales/es/newfeature.json'

export const resources = {
  en: {
    // ... existing
    newfeature: enNewfeature,
  },
  es: {
    // ... existing
    newfeature: esNewfeature,
  },
} as const
```

### 2. Automated String Extraction Workflow
```bash
# Extract translatable strings
npm run i18n:extract

# Watch for changes during development
npm run i18n:extract:watch

# Validate translations
npm run i18n:validate

# Check for missing translations
npm run i18n:audit

# Check for missing with strict mode
npm run i18n:missing
```

### 3. Translation Usage in Components
```typescript
// Feature component with proper translation usage
import { useTranslation } from '@/i18n/hooks/useTranslation'

function NewFeaturePage() {
  const { t } = useTranslation('newfeature')
  const { t: tCommon } = useTranslation('common')

  return (
    <div>
      <h1>{t('page.title')}</h1>
      <p>{t('page.description')}</p>
      <Button>{tCommon('actions.save')}</Button>
    </div>
  )
}

// Form validation with translated errors
function NewFeatureForm() {
  const { t } = useTranslation(['newfeature', 'validation'])
  
  const schema = z.object({
    name: z.string()
      .min(3, t('validation:nameInvalid'))
      .refine((val) => val.length > 0, {
        message: t('validation:nameRequired'),
      }),
  })

  // Form implementation with validated schema
}
```

## 🧪 Testing Requirements

### Translation Testing
```typescript
// Testing translations in components
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n/config'

const renderWithI18n = (component: React.ReactElement) => {
  return render(
    <I18nextProvider i18n={i18n}>
      {component}
    </I18nextProvider>
  )
}

describe('TodoComponent', () => {
  it('should display translated text', () => {
    renderWithI18n(<TodoComponent />)
    expect(screen.getByText('Create Todo')).toBeInTheDocument()
  })

  it('should handle language changes', async () => {
    renderWithI18n(<TodoComponent />)
    
    await i18n.changeLanguage('es')
    expect(screen.getByText('Crear Tarea')).toBeInTheDocument()
  })
})
```

This internationalization system provides comprehensive multilingual support with automated workflow for maintaining translations across the entire application.