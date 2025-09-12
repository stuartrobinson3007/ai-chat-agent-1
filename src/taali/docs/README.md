# TanStack SaaS Starter - Complete Architecture Documentation

This repository serves as a production-ready SaaS starter template that can be copied and used as the foundation for building multiple applications with consistent architecture patterns. This documentation provides comprehensive guides for AI agents and developers to understand and replicate every aspect of the implementation.

## 🏗️ Architecture Overview

### Core Technology Stack

**Frontend Framework**
- **TanStack Start**: Full-stack React framework with SSR/SSG support
- **TanStack Router**: File-based routing with type-safe navigation
- **TanStack Query**: Server state management and caching
- **TanStack Table**: Advanced data table functionality

**Backend & Database**
- **PostgreSQL**: Primary database with ACID compliance
- **Drizzle ORM**: Type-safe database queries and migrations
- **Redis**: Session storage and caching layer

**Authentication & Authorization**
- **Better Auth**: Multi-provider authentication system
- **Role-based Access Control**: Custom permission system
- **Multi-tenancy**: Organization-based data isolation

**UI & Styling**
- **Tailwind CSS v4**: Utility-first styling with modern features
- **Radix UI**: Unstyled, accessible component primitives
- **Taali UI**: Custom component library built on Radix
- **Next Themes**: Dark/light mode support

**Integrations**
- **Stripe**: Payment processing and subscription management
- **Resend**: Email delivery service
- **React Email**: Email template system

**Internationalization**
- **i18next**: Translation management
- **Automated extraction**: String discovery and validation

## 📂 Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── taali-ui/        # Custom component library
│   └── ui/              # Application-specific components
├── features/            # Feature-based organization
│   ├── auth/           # Authentication flows
│   ├── billing/        # Payment and subscription logic
│   ├── organization/   # Multi-tenancy management
│   ├── todos/          # Example feature implementation
│   └── admin/          # Administrative functionality
├── lib/                # Shared utilities and configurations
│   ├── auth/           # Authentication setup
│   ├── db/             # Database connections
│   ├── errors/         # Error handling system
│   └── utils/          # Utility functions
├── database/           # Database schema and migrations
├── routes/             # File-based routing structure
├── i18n/              # Internationalization setup
├── emails/            # Email templates
└── types/             # TypeScript type definitions
```

## 🔐 Authentication System

### Multi-Provider Support
- **Google OAuth**: Social authentication
- **GitHub OAuth**: Developer-focused login
- **Magic Link**: Passwordless email authentication  
- **OTP**: One-time password via email

### Authorization Architecture
- **Role Hierarchy**: superadmin → owner → admin → member → viewer
- **Resource Permissions**: todos, billing, organization, member, invitation
- **Organization Scoping**: All permissions scoped to specific organizations

### Better Auth Configuration
```typescript
// Custom access control with organization-scoped permissions
const statement = {
  todos: ['create', 'read', 'update', 'delete', 'assign'],
  billing: ['view', 'manage'],
  organization: ['update', 'delete'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'read', 'delete', 'cancel']
}
```

## 🏢 Multi-Tenancy Architecture

### Organization-Based Isolation
- **Data Separation**: All user data scoped by organizationId
- **Member Management**: Role-based access within organizations
- **Invitation System**: Email-based team member onboarding
- **Context Switching**: Users can belong to multiple organizations

### Database Schema
```sql
-- Core multi-tenancy tables
user (id, email, name, role, ...)
organization (id, name, slug, currentPlan, ...)
member (id, organizationId, userId, role, ...)
invitation (id, organizationId, email, role, ...)
```

## 💳 Billing & Subscriptions

### Stripe Integration
- **Better Auth Stripe Plugin**: Seamless subscription management
- **Plan Tiers**: Free, Pro, Business with usage limits
- **Usage Enforcement**: Middleware-based limit checking
- **Customer Management**: Automatic Stripe customer creation

### Plan Configuration
```typescript
const BILLING_PLANS = {
  free: { todos: 10, members: 2, storage: 100 },
  pro: { todos: -1, members: 10, storage: 5000 },
  business: { todos: -1, members: -1, storage: -1 }
}
```

## 🎨 UI Component System (Taali UI)

### Design Philosophy
- **Headless Components**: Built on Radix UI primitives
- **Composition Pattern**: Flexible, reusable component architecture
- **Accessibility First**: WCAG compliant by default
- **Type Safety**: Full TypeScript integration

### Advanced Data Table
- **Server-side Operations**: Pagination, sorting, filtering
- **Bulk Actions**: Multi-row operations
- **Column Configuration**: Resizable, hideable columns
- **Real-time Updates**: Optimistic UI updates

## 🌐 Internationalization (i18n)

### Translation Architecture
- **Namespace Organization**: Feature-based translation files
- **Automated Extraction**: i18next-parser for string discovery
- **Validation Scripts**: Missing translation detection
- **Client/Server Sync**: Consistent translations across boundaries

### Supported Languages
- **English** (en): Primary language
- **Spanish** (es): Secondary language
- **Extensible**: Easy addition of new languages

## 🛡️ Error Handling & Data Fetching

### Standardized Error Handling Patterns

The application uses a comprehensive error handling system with consistent patterns for different data scenarios:

#### Quick Decision Tree
```
Is it a table/list? → useTableQuery + Full ErrorState
Is it critical for page? → useResourceQuery + Full ErrorState  
Is it supporting data? → useSupportingQuery + Inline Error
Is it background data? → useQuery + Silent Fallback
Is it a mutation? → useFormMutation + Toast + Form Errors
```

#### Pattern Examples
```typescript
// 1. Table/List Data - Full page error replacement
const { data, isError, error, refetch } = useTableQuery({
  queryKey: ['todos'],
  queryFn: getTodosTable,
})

if (isError && error) {
  return <ErrorState error={parseError(error)} onRetry={refetch} />
}

// 2. Critical Resources - Full page error or redirect  
const { data: todo, isError, error } = useResourceQuery({
  queryKey: ['todo', id],
  queryFn: () => getTodoById(id),
  redirectOnError: '/' // Optional redirect
})

// 3. Supporting Data - Inline error with graceful degradation
const { data: stats, showError } = useSupportingQuery({
  queryKey: ['stats'], 
  queryFn: getStats,
})

{showError ? (
  <ErrorState variant="inline" error={parseError({ message: 'Stats unavailable' })} />
) : (
  <StatsDisplay stats={stats} />
)}

// 4. Form Mutations - Field errors + toasts
const mutation = useFormMutation({
  mutationFn: updateResource,
  setError, // from react-hook-form
  onSuccess: () => showSuccess('Updated successfully')
})
```

#### ErrorState Variants
- **`full-page`** (default): Complete page replacement for critical failures
- **`inline`**: Small inline message for supporting data
- **`card`**: Contained error for specific sections

#### Better-Auth Integration
- Authentication errors are handled by better-auth hooks
- Business logic errors use our standardized patterns
- No interference between auth and application error handling

### Error System Components
- **Custom Error Types**: ValidationError, AppError with i18n keys
- **Client Boundaries**: React error boundaries for graceful failure
- **Server Validation**: Zod schema validation with translated messages
- **User Feedback**: Toast notifications with actionable messages

## 📧 Email System

### React Email Templates
- **Magic Link**: Passwordless authentication
- **OTP Codes**: One-time password delivery
- **Invitations**: Team member onboarding
- **Responsive Design**: Mobile-optimized templates

### Email Configuration
```typescript
// Transactional email types with Better Auth integration
sendMagicLinkEmail(email, url)
sendOTPEmail(email, otp, type)
sendInvitationEmail(email, inviter, organization, url)
```

## 🚀 Development Workflow

### Build System
- **Vite**: Lightning-fast development server
- **TanStack Start Plugin**: SSR/SSG capabilities
- **TypeScript**: Full type safety
- **Path Aliases**: Clean import statements

### Code Quality
- **ESLint**: Code linting with React and TypeScript rules
- **Prettier**: Code formatting
- **Drizzle Kit**: Database migration management
- **Vitest**: Unit testing framework

## 📊 Server Functions & API

### TanStack Start Patterns
- **Server Functions**: Type-safe client-server communication
- **Middleware Chain**: Authentication and organization context
- **Validation Layer**: Zod schema validation
- **Error Boundaries**: Consistent error handling

### Data Fetching Strategy
```typescript
// Server function with middleware and validation
export const getTodoById = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => todoIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Organization-scoped data fetching with validation
  })
```

## 📁 File Management

### Upload System
- **Avatar Management**: User profile images
- **Image Processing**: Sharp for optimization
- **Local Storage**: Development-friendly file handling
- **Security**: File type validation and size limits

## 🎯 Key Implementation Patterns

### 1. Feature-Based Architecture
Each feature (auth, billing, todos) is self-contained with its own components, server functions, and types.

### 2. Type-Safe Full Stack
End-to-end type safety from database schema to client components using TypeScript and Drizzle.

### 3. Middleware-First Security
Authentication and authorization checks happen at the middleware level before reaching handlers.

### 4. Optimistic UI Updates
Client-side state updates happen immediately with server reconciliation for better UX.

### 5. Error-First Design
Comprehensive error handling with user-friendly messages and proper fallback states.

### 6. Route Metadata Patterns
Authentication and layout behavior controlled through TanStack Router `staticData`:
- Type-safe route configuration eliminates hardcoded path arrays
- Inheritance model works correctly with nested routes
- Single source of truth per route for authentication behavior

## 📖 Documentation Structure

This overview is part of a comprehensive documentation system covering **all architectural components**:

### 🏗️ **Core Architecture (Complete)**
- [x] **01. Architecture & Tech Stack** - Complete technology overview and build system configuration
- [x] **02. Authentication & Authorization** - Better Auth implementation with RBAC and multi-provider support  
- [x] **03. Database Schema & Patterns** - Drizzle ORM patterns and multi-tenant data modeling
- [x] **04. Multi-Tenancy Implementation** - Organization-based isolation strategies and context management
- [x] **05. UI Component Library (Taali UI)** - Advanced component system with data tables and form patterns
- [x] **06. Server Functions & API Patterns** - TanStack Start server function architecture and API design
- [x] **07. Internationalization System** - i18next translation management with automated workflows
- [x] **08. Email System** - React Email templates with Resend integration and Better Auth compatibility
- [x] **09. Billing & Subscription System** - Stripe integration with plan enforcement and usage tracking
- [x] **10. Error Handling, Development Workflow & File Management** - Error systems, development tooling, and secure file handling

### 🚀 **Advanced Systems (Complete)**
- [x] **11. Advanced Form System** - Form error boundaries, form actions, autosave, and sync patterns
- [x] **12. Validation Architecture** - Centralized validation registry, schemas, and async database constraint validation
- [x] **13. Super Admin System** - User impersonation, admin layouts, user/workspace management, and visual admin wrapper
- [x] **14. Advanced Hook Patterns** - Provider composition, form mutations, sync hooks, and loading state management
- [x] **15. Team Management System** - Member invitations, role management, permission hierarchy, and collaboration features
- [x] **16. Enhanced Error Management** - Error categorization, comprehensive error codes, and advanced client-side error strategies
- [x] **17. Soft Delete & Undo Patterns** - Comprehensive soft delete implementation with user-friendly undo functionality and data recovery patterns

### 📋 **Documentation Standards**
- [x] **AI-Optimized Writing Guidelines** - Comprehensive standards for creating documentation that AI agents can effectively use to maintain consistency

**Status**: ✅ **Complete Architecture Documentation (17 Guides)** - Production-ready starter template with comprehensive AI-friendly documentation covering every aspect of the sophisticated TanStack SaaS architecture

## 🚀 Quick Start for New Projects

1. **Copy Repository**: Clone this template as starting point
2. **Environment Setup**: Configure database, auth providers, and email
3. **Customize Features**: Adapt the todos example to your domain
4. **Deploy**: Use the included build configuration

This architecture provides a solid foundation for building production-ready SaaS applications with modern best practices and comprehensive feature coverage.