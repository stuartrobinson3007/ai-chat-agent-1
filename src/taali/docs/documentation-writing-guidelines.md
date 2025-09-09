# Documentation Writing Guidelines for AI Agents

This document defines the writing standards and patterns for creating documentation that AI agents can effectively use to maintain architectural consistency across projects.

## 🎯 Core Writing Principles

### 1. **AI-First Thinking**
- Write for AI agents who need explicit, unambiguous instructions
- Assume the AI agent has no context about decisions made in other files
- Every pattern must be completely self-contained with all necessary context

### 2. **Explicit > Implicit**
- Never assume AI agents will infer patterns or conventions
- State requirements explicitly: "MUST include", "ALWAYS use", "NEVER do"
- Provide exact file paths, import statements, and function signatures

### 3. **Copy-Paste Ready Examples**
- All code examples must work without modification when copied
- Include complete import statements, not just the relevant parts
- Show full function signatures with TypeScript types
- Include error handling in every example

## 📝 Required Documentation Structure

Every documentation file MUST follow this structure:

```markdown
# [Feature Name] Implementation Guide

## 🚨 Critical Rules
[Non-negotiable requirements that AI agents must follow]

## ❌ Common AI Agent Mistakes
[Specific antipatterns AI agents typically introduce]

## ✅ Established Patterns
[Exact patterns from this codebase with complete examples]

## 🔧 Step-by-Step Implementation
[Numbered steps with exact file paths and code changes]

## 🎯 Integration Requirements
[How this feature connects to other systems]

## 🧪 Testing Requirements  
[Required tests and validation steps]

## 📋 Implementation Checklist
[Final checklist before considering implementation complete]
```

## 🚨 Critical AI Agent Vulnerabilities

### 1. **Framework Pattern Violations**
**Problem**: AI agents default to generic React patterns instead of TanStack-specific approaches.

**Documentation Requirements**:
- Lead every section with TanStack-specific examples
- Include "Framework Violations to Avoid" sections
- Show migration examples from generic patterns to framework patterns

### 2. **Type Safety Erosion** 
**Problem**: AI agents use `any` types or skip proper TypeScript patterns.

**Documentation Requirements**:
- Every code example MUST include full TypeScript types
- Show Zod schema alongside TypeScript interfaces
- Include type import statements in every example
- Mark TypeScript violations as "NEVER DO"

### 3. **Import Path Inconsistency**
**Problem**: AI agents create chaotic import paths and ignore established aliases.

**Documentation Requirements**:
- Every code example MUST start with complete import statements
- Use established path aliases (@/, @/ui, etc.) consistently
- Show exact import paths for every utility and component
- Include barrel export guidance

### 4. **Security Context Loss**
**Problem**: AI agents forget authentication checks or implement them inconsistently.

**Documentation Requirements**:
- Every server function example MUST show middleware usage
- Include permission checking patterns in all protected operations
- Lead with security implementation, not as afterthought
- Show exact authentication context usage

### 5. **State Management Confusion**
**Problem**: AI agents mix client/server state or ignore established query patterns.

**Documentation Requirements**:
- Clearly separate TanStack Query examples from local state
- Show standardized query key patterns
- Include optimistic update implementations
- Demonstrate proper cache invalidation

### 6. **Hook Pattern Violations**
**Problem**: AI agents create custom hooks that violate React rules or duplicate existing functionality.

**Documentation Requirements**:
- Always show complete dependency arrays and explain reasoning
- Document when to use existing hooks vs creating new ones
- Show hook composition patterns (useFormAutosave + TanStack Query)
- Include cleanup patterns to prevent memory leaks

### 7. **Middleware Chain Breaks**
**Problem**: AI agents break middleware chains or create security holes by bypassing middleware.

**Documentation Requirements**:
- Explicitly document middleware ordering (auth → organization)
- Show context propagation through middleware chain
- Include error handling and bubbling patterns in middleware
- Distinguish client vs server middleware patterns

### 8. **Query Key Inconsistency**
**Problem**: AI agents create inconsistent query keys breaking cache invalidation.

**Documentation Requirements**:
- Document exact query key hierarchies (`['todos', orgId, filters]`)
- Show cache invalidation patterns for related queries
- Require use of established query key factories like `todoKeys`
- Explain query dependencies on organization context

### 9. **Route Definition Errors**
**Problem**: AI agents create routes that don't follow TanStack Router conventions.

**Documentation Requirements**:
- Exact naming conventions for route files
- When to include loaders, search params, and other route metadata
- How `_authenticated` layout system works
- Type-safe parameter handling patterns

### 10. **Form Handling Antipatterns**
**Problem**: AI agents create inconsistent form patterns or bypass validation.

**Documentation Requirements**:
- When to use `useFormAutosave` vs regular forms
- Zod schema + React Hook Form + server validation integration
- How form submission integrates with TanStack Query optimistic updates
- Form-level vs field-level error handling patterns

### 11. **Context Misuse**
**Problem**: AI agents create unnecessary contexts or misuse existing ones.

**Documentation Requirements**:
- How `useActiveOrganization` should be used consistently
- When to use context vs props/query params
- How contexts integrate with server state management
- Performance patterns to avoid unnecessary re-renders

### 12. **Server Function Lifecycle Confusion**
**Problem**: AI agents don't understand the complete request lifecycle.

**Documentation Requirements**:
- Complete request flow: Client → Middleware → Validation → Handler → Response
- Where different types of errors should be caught and handled
- What server functions should return for optimal client integration
- When to use streaming vs static responses

## 📋 Mandatory Elements in Every Code Example

### 1. **Complete Import Block**
```typescript
// ✅ ALWAYS include complete imports
import { createServerFn } from '@tanstack/react-start'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { checkPermission } from '@/lib/utils/permissions'
import { db } from '@/lib/db/db'
```

### 2. **Full TypeScript Signatures**
```typescript
// ✅ ALWAYS show complete function signatures
export const createTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => createTodoSchema.parse(data))
  .handler(async ({ data, context }: { data: CreateTodoInput; context: OrganizationContext }) => {
    // Implementation
  })
```

### 3. **Error Handling**
```typescript
// ✅ ALWAYS include error handling
try {
  return createTodoSchema.parse(data)
} catch (error) {
  if (error instanceof z.ZodError) {
    const fields: Record<string, string[]> = {}
    error.errors.forEach((err) => {
      const path = err.path.join('.')
      if (!fields[path]) fields[path] = []
      fields[path].push('VAL_REQUIRED_FIELD')
    })
    throw new ValidationError(fields, errorTranslations.server.validationFailed)
  }
  throw error
}
```

### 4. **Permission Checks**
```typescript
// ✅ ALWAYS include permission checks for protected operations
await checkPermission('todos', ['create'], context.organizationId)
```

## 🔍 Writing Standards

### Language Requirements
- Use present tense and active voice
- Write declarative statements: "Use X pattern" not "You could use X pattern"
- Include "MUST", "ALWAYS", "NEVER" for non-negotiable requirements
- Use consistent terminology throughout all documentation

### Code Example Standards
- Include file paths for where code should be placed: `src/features/todos/lib/todos.server.ts:42`
- Show before/after examples when modifying existing code
- Include line numbers for specific references
- Mark deprecated patterns clearly

### Format Standards
- Use consistent emoji indicators: ❌ for mistakes, ✅ for correct patterns, 🚨 for critical warnings
- Include numbered implementation steps
- Use code blocks with appropriate language highlighting
- Include file tree structures where relevant

## 🎯 Integration Pattern Documentation

Every feature documentation MUST include these integration sections:

### Authentication Integration
```typescript
// How this feature integrates with Better Auth
// Show exact middleware usage
// Include permission checking examples
```

### Database Integration  
```typescript
// How this feature uses Drizzle ORM
// Show exact schema relationships
// Include transaction patterns where needed
```

### UI Integration
```typescript
// How this connects to Taali UI components
// Show form integration patterns
// Include error state handling
```

### i18n Integration
```typescript
// How this feature handles translations
// Show translation key patterns
// Include validation message translations
```

## 🧪 Testing Documentation Requirements

Every feature guide MUST include:

1. **Unit Test Examples**: Complete test files with proper setup
2. **Integration Test Patterns**: How features work together
3. **Error Case Testing**: How to test failure scenarios
4. **Performance Testing**: When to include performance considerations

## 📋 Quality Checklist for Documentation

Before publishing any documentation, verify:

- [ ] All code examples include complete import statements
- [ ] TypeScript types are fully specified (no `any` types)
- [ ] Security/permission patterns are demonstrated
- [ ] Integration points with other systems are covered
- [ ] Common mistakes section addresses real AI agent pitfalls
- [ ] Examples are copy-paste ready without modification
- [ ] File paths and locations are explicitly stated
- [ ] Framework-specific patterns are prioritized over generic solutions

## 🚀 AI Agent Success Metrics

Documentation is successful if AI agents can:

1. **Implement features without pattern violations**
2. **Maintain type safety throughout implementation**  
3. **Follow established security patterns consistently**
4. **Use correct import paths and aliases**
5. **Integrate properly with existing systems**
6. **Handle errors according to established patterns**

## 📚 Reference Standards

When documenting patterns, always reference:
- Exact file locations in the codebase
- Specific lines of code where patterns are implemented
- Related documentation files
- Framework documentation for TanStack tools
- Better Auth plugin documentation for auth patterns

This approach ensures AI agents have the precise guidance needed to maintain architectural consistency across projects while avoiding common implementation pitfalls.

## 🎯 Advanced AI Agent Guidance Sections

### Performance Optimization Patterns
**Critical Requirements**:
- **Debouncing Standards**: Use 300ms for search, 3000ms for autosave
- **Memoization Rules**: Always include dependencies, explain when to use useMemo vs useCallback  
- **Bundle Impact**: Show import patterns that affect bundle size
- **Loading States**: Demonstrate proper skeleton and loading patterns

```typescript
// ✅ ALWAYS show debouncing patterns
const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    setFilter('search', query)
  }, 300),
  [setFilter]
)
```

### Database Transaction Guidelines
**Critical Requirements**:
- **Transaction Boundaries**: When operations need atomic consistency
- **Concurrency Control**: Handling concurrent updates safely
- **Relationship Loading**: When to use joins vs separate queries
- **Migration Safety**: Non-breaking schema change patterns

```typescript
// ✅ ALWAYS use transactions for multi-table operations
await db.transaction(async (tx) => {
  const todo = await tx.insert(todos).values(data).returning()
  await tx.insert(auditLog).values({ action: 'create', todoId: todo[0].id })
})
```

### Environment Configuration Patterns
**Critical Requirements**:
- **Environment Variables**: Required vs optional environment variables
- **Development vs Production**: Different behaviors per environment
- **Feature Flags**: Conditional feature implementation
- **Deployment Configuration**: Build-time vs runtime settings

```typescript
// ✅ ALWAYS validate environment variables
const requiredEnvVars = {
  DATABASE_URL: process.env.DATABASE_URL!,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY!,
} as const
```

### Testing Integration Standards
**Critical Requirements**:
- **Testable Architecture**: Structure code for easy unit testing
- **Mock Strategies**: What to mock vs integration test
- **Test Data Patterns**: Creating realistic test data
- **Snapshot Testing**: When appropriate vs unit tests

```typescript
// ✅ ALWAYS structure for testability
export const createTodoLogic = async (data: CreateTodoInput, orgId: string) => {
  // Pure business logic that's easy to test
  return { /* processed data */ }
}

export const createTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ data, context }) => {
    return createTodoLogic(data, context.organizationId)
  })
```

### Internationalization Context Requirements  
**Critical Requirements**:
- **Translation Key Naming**: Consistent namespace.key patterns
- **Server-Side Integration**: How translations work in server functions
- **Fallback Handling**: Missing translation strategies
- **Dynamic Loading**: Client vs server translation loading

```typescript
// ✅ ALWAYS use namespaced translation keys
const { t } = useTranslation('todos')
const errorMessage = t('validation.titleRequired')

// ✅ ALWAYS provide fallback in server functions
throw new ValidationError(fields, t('server.validationFailed', 'Validation failed'))
```

## 🧪 Advanced Testing Documentation

### Test Structure Requirements
Every feature documentation MUST include complete test examples:

```typescript
// ✅ Complete test file example
import { describe, it, expect, vi } from 'vitest'
import { createTodoLogic } from './todos.server'

describe('createTodoLogic', () => {
  it('should validate required fields', async () => {
    const invalidData = { title: '' }
    await expect(createTodoLogic(invalidData, 'org123')).rejects.toThrow('VAL_REQUIRED_FIELD')
  })
})
```

### Integration Test Patterns
Show how features integrate across the system:

```typescript
// ✅ Integration test showing middleware + server function + database
import { testClient } from '~/test/setup'

it('should create todo with proper organization isolation', async () => {
  const response = await testClient.createTodo.mutate({
    title: 'Test Todo',
    organizationId: 'org123'
  })
  
  expect(response.organizationId).toBe('org123')
})
```

### Error Case Testing
Document failure scenarios and recovery:

```typescript
// ✅ Error case testing
it('should handle database connection failures', async () => {
  vi.mocked(db.insert).mockRejectedValue(new Error('Connection failed'))
  
  await expect(createTodo(validData)).rejects.toThrow('SYS_SERVER_ERROR')
})
```

## 📊 AI Agent Quality Metrics

### Implementation Success Indicators
Documentation is effective when AI agents consistently:

1. **Follow Framework Patterns**: Use TanStack-specific approaches over generic React
2. **Maintain Type Safety**: No `any` types, complete TypeScript integration
3. **Preserve Security**: Always include auth/permission checks
4. **Use Correct Imports**: Consistent path aliases and import patterns
5. **Handle Errors Properly**: Consistent error handling and user feedback
6. **Integrate Correctly**: Proper middleware chains and context usage
7. **Optimize Performance**: Appropriate debouncing and memoization
8. **Test Thoroughly**: Complete test coverage following established patterns

### Quality Validation Checklist

Before any AI-generated code is considered complete, verify:

- [ ] **Imports**: Complete import statements with correct aliases
- [ ] **Types**: Full TypeScript types, no `any` usage
- [ ] **Authentication**: Proper middleware and permission checks
- [ ] **Validation**: Zod schemas with proper error handling
- [ ] **Error Handling**: Consistent error patterns with translations
- [ ] **Performance**: Appropriate optimization patterns
- [ ] **Testing**: Complete test coverage
- [ ] **Integration**: Proper connection to existing systems
- [ ] **Documentation**: Code is self-documenting with clear intent

This comprehensive approach ensures AI agents can successfully maintain architectural consistency while implementing new features that integrate seamlessly with the established codebase patterns.