# Billing & Subscription System Implementation Guide

This document provides comprehensive guidance for implementing Stripe billing with Better Auth integration, plan management, usage limits, and subscription lifecycle management.

## 🚨 Critical Rules

- **ALWAYS use Better Auth Stripe plugin** - Never implement custom Stripe logic
- **MUST validate billing permissions** - Only owners/admins can manage billing
- **NEVER bypass plan limits** - Enforce usage limits consistently
- **ALWAYS scope subscriptions by organization** - Use referenceId for organization binding
- **MUST handle Stripe webhooks properly** - Use Better Auth webhook handling

## ❌ Common AI Agent Mistakes

### Stripe Integration Violations
```typescript
// ❌ NEVER create custom Stripe integration
import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Custom checkout creation - wrong approach
const session = await stripe.checkout.sessions.create({
  // Custom implementation
})

// ✅ ALWAYS use Better Auth Stripe plugin
await auth.api.upgradeSubscription({
  body: {
    plan: 'pro',
    referenceId: organizationId,
  },
  headers: context.headers,
})
```

### Plan Limit Bypass
```typescript
// ❌ NEVER skip plan limit validation
export const createTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ data, context }) => {
    // No plan limit check - users can exceed limits!
    await db.insert(todos).values(data)
  })

// ✅ ALWAYS check plan limits before operations
export const createTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ data, context }) => {
    const { organizationId } = context

    // Check plan limits first
    const limitCheck = await checkPlanLimit({ resource: 'todos', action: 'create' })
    if (!limitCheck.allowed) {
      throw new AppError('BIZ_PLAN_LIMIT_EXCEEDED', 402, { reason: limitCheck.reason })
    }

    await checkPermission('todos', ['create'], organizationId)
    await db.insert(todos).values({ ...data, organizationId })
  })
```

### Permission Bypass in Billing
```typescript
// ❌ NEVER allow non-admins to manage billing
export const createCheckout = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // Missing organization context and billing permission check!
    await auth.api.upgradeSubscription()
  })

// ✅ ALWAYS check billing permissions
export const createCheckout = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    await checkPermission('billing', ['manage'], context.organizationId)
    // Safe to proceed with billing operations
  })
```

## 🔐 Understanding authorizeReference

The `authorizeReference` function is a **security callback** that Better Auth calls internally to verify permissions before any subscription operation. **You never call this function directly** - Better Auth invokes it automatically.

### How It Works

1. **Definition**: You define `authorizeReference` in your Better Auth configuration
2. **Automatic Invocation**: Better Auth calls it when you use subscription APIs with a `referenceId`
3. **Permission Check**: It verifies if the current user can manage billing for the given organization

### When It's Called

Better Auth automatically invokes `authorizeReference` when these methods receive a `referenceId`:

```typescript
// When you call this in your server function:
await auth.api.upgradeSubscription({
  body: {
    plan: 'pro',
    referenceId: orgId, // ← This triggers authorizeReference
  },
  headers: context.headers,
})

// Better Auth internally:
// 1. Extracts the user from headers
// 2. Calls authorizeReference({ user, referenceId: orgId, action: 'upgrade' })
// 3. Only proceeds if it returns true
```

### Example Flow

```typescript
// In billing.server.ts - Your code
export const createCheckout = createServerFn({ method: 'POST' })
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId
    
    // This call triggers authorizeReference internally
    const result = await auth.api.upgradeSubscription({
      body: {
        plan: 'pro',
        referenceId: orgId, // ← Triggers permission check
      },
      headers: context.headers,
    })
    
    // If authorizeReference returned false, Better Auth would throw an error
    // and this line would never be reached
    return { checkoutUrl: result.url }
  })

// In auth.ts - Your callback definition
authorizeReference: async ({ user, referenceId }) => {
  // Better Auth calls this automatically
  // You never invoke it directly
  const member = await db.member.findFirst({
    where: {
      userId: user.id,
      organizationId: referenceId
    }
  })
  
  // Return true if user can manage billing
  return member?.role === 'owner' || member?.role === 'admin'
}
```

### Methods That Trigger authorizeReference

All these Better Auth API methods trigger the callback when called with a `referenceId`:

- `auth.api.upgradeSubscription()` - Creating checkout sessions
- `auth.api.listActiveSubscriptions()` - Fetching subscription data
- `auth.api.createBillingPortal()` - Opening Stripe customer portal
- `auth.api.cancelSubscription()` - Cancelling subscriptions
- `auth.api.restoreSubscription()` - Restoring cancelled subscriptions

### Important Notes

- **Never bypass this check** - Always include `referenceId` in subscription operations
- **It's working even if it looks unused** - IDEs won't show it as "used" because Better Auth calls it internally
- **Double-check permissions** - You can add additional `checkPermission()` calls for defense in depth
- **Organization scoping is critical** - The `referenceId` ensures subscriptions are bound to organizations

## ✅ Established Patterns

### 1. **Plan Configuration**
```typescript
// File: src/features/billing/lib/plans.config.ts
export const BILLING_PLANS = {
  free: {
    name: 'Free',
    stripePriceId: null,
    features: {
      todos: 10,
      members: 2,
      customFields: false,
      apiAccess: false,
      prioritySupport: false,
    },
    limits: {
      todos: 10,
      members: 2,
      storage: 100, // MB
    },
  },
  pro: {
    name: 'Pro',
    stripePriceId: {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
      annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID!,
    },
    features: {
      todos: -1, // Unlimited
      members: 10,
      customFields: true,
      apiAccess: true,
      prioritySupport: false,
    },
    limits: {
      todos: -1,
      members: 10,
      storage: 5000, // MB
    },
    seats: 10, // For Better Auth Stripe plugin
  },
  business: {
    name: 'Business',
    stripePriceId: {
      monthly: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID!,
      annual: process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID!,
    },
    features: {
      todos: -1,
      members: -1,
      customFields: true,
      apiAccess: true,
      prioritySupport: true,
    },
    limits: {
      todos: -1,
      members: -1,
      storage: -1, // Unlimited
    },
    seats: 50,
  },
} as const

export type PlanType = keyof typeof BILLING_PLANS
```

### 2. **Better Auth Stripe Configuration**
```typescript
// File: src/lib/auth/auth.ts (Stripe plugin section)
import { stripe as stripePlugin } from '@better-auth/stripe'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil',
})

export const auth = betterAuth({
  plugins: [
    stripePlugin({
      stripeClient: stripe,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      createCustomerOnSignUp: false, // We'll create on org creation
      successUrl: `${process.env.BETTER_AUTH_URL}/billing?success=true`,
      cancelUrl: `${process.env.BETTER_AUTH_URL}/billing`,
      subscription: {
        enabled: true,
        // IMPORTANT: authorizeReference is a callback that Better Auth calls internally
        // It's invoked automatically when subscription operations include a referenceId
        // This ensures only authorized users can manage billing for an organization
        authorizeReference: async ({ user, referenceId }) => {
          // This function is called by Better Auth when:
          // - auth.api.upgradeSubscription() is called with referenceId
          // - auth.api.listActiveSubscriptions() is called with referenceId  
          // - auth.api.createBillingPortal() is called with referenceId
          // - auth.api.cancelSubscription() is called with referenceId
          
          // Check if user can manage billing for this organization
          const membership = await db
            .select()
            .from(schema.member)
            .where(
              and(
                eq(schema.member.userId, user.id),
                eq(schema.member.organizationId, referenceId)
              )
            )
            .limit(1)

          if (membership.length === 0) {
            return false // User is not a member of this organization
          }

          const member = membership[0]
          // Only owners and admins can manage billing
          return member.role === 'owner' || member.role === 'admin'
        },
        plans: [
          {
            name: 'pro',
            priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
            annualDiscountPriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID!,
            limits: {
              todos: -1,
              members: 10,
              storage: 5000,
            },
          },
          {
            name: 'business',
            priceId: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID!,
            annualDiscountPriceId: process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID!,
            limits: {
              todos: -1,
              members: -1,
              storage: -1,
            },
          },
        ],
      },
    }),
    // ... other plugins
  ],
})
```

### 3. **Subscription Management Server Functions**
```typescript
// File: src/features/billing/lib/billing.server.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { eq, count } from 'drizzle-orm'

import { BILLING_PLANS } from './plans.config'
import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { checkPermission } from '@/lib/utils/permissions'
import { db } from '@/lib/db/db'
import { auth } from '@/lib/auth/auth'
import { AppError } from '@/lib/utils/errors'

// Get current subscription status
export const getSubscription = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const orgId = context.organizationId!

    const [org] = await db.select().from(organization).where(eq(organization.id, orgId))
    if (!org) {
      throw AppError.notFound('Organization')
    }

    // Use Better Auth API to get subscription data
    let activeSubscription: any = null
    let allSubscriptions: any[] = []

    try {
      const subscriptions = await auth.api.listActiveSubscriptions({
        query: { referenceId: orgId },
        headers: context.headers,
      })

      if (subscriptions && subscriptions.length > 0) {
        allSubscriptions = subscriptions
        activeSubscription =
          subscriptions.find((sub: any) => sub.status === 'active' || sub.status === 'trialing') ||
          subscriptions[0]
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error)
    }

    return {
      organization: org,
      subscription: activeSubscription,
      currentPlan: activeSubscription?.plan || org.currentPlan || 'free',
      limits: activeSubscription?.limits || org.planLimits || BILLING_PLANS.free.limits,
      hasStripeCustomer: !!org.stripeCustomerId || !!activeSubscription?.stripeCustomerId,
    }
  })

// Create checkout session
const createCheckoutSchema = z.object({
  plan: z.enum(['pro', 'business']),
  interval: z.enum(['monthly', 'annual']),
})

export const createCheckout = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => createCheckoutSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId!

    // REQUIRED: Check billing permissions
    await checkPermission('billing', ['manage'], orgId)

    const { plan, interval } = data

    try {
      const result = await auth.api.upgradeSubscription({
        body: {
          plan,
          successUrl: `${process.env.BETTER_AUTH_URL}/billing?success=true`,
          cancelUrl: `${process.env.BETTER_AUTH_URL}/billing`,
          annual: interval === 'annual',
          referenceId: orgId, // REQUIRED: Organization binding
        },
        headers: context.headers,
      })

      if (!result?.url) {
        throw new AppError('SYS_CONFIG_ERROR', 500, undefined, 'Failed to create checkout session')
      }

      return { checkoutUrl: result.url }
    } catch (error) {
      // Handle specific Stripe error types
      if ((error as any).type === 'StripeCardError') {
        throw new AppError('BIZ_PAYMENT_FAILED', 400, { reason: (error as any).message })
      }

      if (error instanceof AppError) {
        throw error
      }

      throw new AppError('SYS_SERVER_ERROR', 500, undefined, 'Checkout failed')
    }
  })

// Plan limit validation
const checkLimitSchema = z.object({
  resource: z.enum(['todos', 'members', 'storage']),
  action: z.enum(['create', 'update']),
})

export const checkPlanLimit = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => checkLimitSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId!

    // Get organization limits
    const [org] = await db.select().from(organization).where(eq(organization.id, orgId)).limit(1)
    const limits = org?.planLimits || BILLING_PLANS.free.limits

    // Count current usage
    const usage = await getCurrentUsage(orgId)
    const resourceUsage = usage[data.resource]

    // Check if limit is unlimited (-1)
    if ((resourceUsage?.limit || 0) === -1) {
      return { allowed: true }
    }

    // Check create action against limits
    if (data.action === 'create') {
      const allowed = (resourceUsage?.used || 0) < (resourceUsage?.limit || 0)
      return {
        allowed,
        reason: allowed 
          ? undefined 
          : `You've reached your plan limit of ${resourceUsage?.limit || 0} ${data.resource}`,
      }
    }

    return { allowed: true }
  })

// Usage statistics
export const getUsageStats = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const orgId = context.organizationId!

    const usage = await getCurrentUsage(orgId)
    return { usage }
  })

// Helper function for usage calculation
async function getCurrentUsage(organizationId: string) {
  const [org] = await db.select().from(organization).where(eq(organization.id, organizationId)).limit(1)
  
  const todoCount = await db
    .select({ count: count(todos.id) })
    .from(todos)
    .where(eq(todos.organizationId, organizationId))

  const memberCount = await db
    .select({ count: count(member.id) })
    .from(member)
    .where(eq(member.organizationId, organizationId))

  const limits = org?.planLimits || BILLING_PLANS.free.limits

  return {
    todos: {
      used: todoCount[0]?.count || 0,
      limit: limits.todos || 0,
      percentage: (limits.todos || 0) === -1 
        ? 0 
        : Math.round(((todoCount[0]?.count || 0) / (limits.todos || 1)) * 100),
    },
    members: {
      used: memberCount[0]?.count || 0,
      limit: limits.members || 0,
      percentage: (limits.members || 0) === -1 
        ? 0 
        : Math.round(((memberCount[0]?.count || 0) / (limits.members || 1)) * 100),
    },
    storage: {
      used: 0, // Implement storage tracking as needed
      limit: limits.storage || 0,
      percentage: 0,
    },
  }
}
```

### 4. **Plan Limits Enforcement Middleware**
```typescript
// File: src/features/billing/lib/billing-middleware.ts
import { createMiddleware } from '@tanstack/react-start'

import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { checkPlanLimit } from './billing.server'
import { AppError } from '@/lib/utils/errors'

export const planLimitMiddleware = (resource: 'todos' | 'members' | 'storage') =>
  createMiddleware({ type: 'function' })
    .middleware([organizationMiddleware])
    .server(async ({ next, context }) => {
      try {
        const limitCheck = await checkPlanLimit({
          resource,
          action: 'create',
        })

        if (!limitCheck.allowed) {
          throw new AppError(
            'BIZ_PLAN_LIMIT_EXCEEDED',
            402,
            { resource, reason: limitCheck.reason },
            `Plan limit exceeded for ${resource}`,
            [{ action: 'upgrade' }] // Suggest upgrade action
          )
        }

        return next({ context })
      } catch (error) {
        throw error
      }
    })

// Usage in server functions
export const createTodo = createServerFn({ method: 'POST' })
  .middleware([planLimitMiddleware('todos')])
  .handler(async ({ data, context }) => {
    // Plan limits already validated by middleware
    await checkPermission('todos', ['create'], context.organizationId)
    // Proceed with todo creation
  })
```

### 5. **Client-Side Billing Integration**
```typescript
// Usage limits hook
import { useQuery } from '@tanstack/react-query'
import { getUsageStats } from '@/features/billing/lib/billing.server'

export function usePlanLimits() {
  const usageQuery = useQuery({
    queryKey: ['usage-stats'],
    queryFn: getUsageStats,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  const isNearLimit = (resource: 'todos' | 'members' | 'storage') => {
    const usage = usageQuery.data?.usage?.[resource]
    if (!usage || usage.limit === -1) return false
    return usage.percentage >= 80
  }

  const isAtLimit = (resource: 'todos' | 'members' | 'storage') => {
    const usage = usageQuery.data?.usage?.[resource]
    if (!usage || usage.limit === -1) return false
    return usage.used >= usage.limit
  }

  return {
    usage: usageQuery.data?.usage,
    isLoading: usageQuery.isLoading,
    isNearLimit,
    isAtLimit,
    refetch: usageQuery.refetch,
  }
}

// Billing page component
import { useQuery, useMutation } from '@tanstack/react-query'
import { getSubscription, createCheckout, createBillingPortal } from '@/features/billing/lib/billing.server'
import { Button } from '@/ui/button'
import { Card, CardHeader, CardContent } from '@/ui/card'

function BillingPage() {
  const { data: billing, isLoading } = useQuery({
    queryKey: ['billing'],
    queryFn: getSubscription,
  })

  const checkoutMutation = useMutation({
    mutationFn: createCheckout,
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl
    },
  })

  const portalMutation = useMutation({
    mutationFn: createBillingPortal,
    onSuccess: (data) => {
      window.open(data.portalUrl, '_blank')
    },
  })

  if (isLoading) return <div>Loading...</div>

  const { currentPlan, hasStripeCustomer, limits } = billing

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2>Current Plan: {currentPlan}</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Usage statistics */}
            <div>
              <p>Todos: {limits.todos === -1 ? 'Unlimited' : limits.todos}</p>
              <p>Members: {limits.members === -1 ? 'Unlimited' : limits.members}</p>
            </div>

            {/* Upgrade buttons */}
            {currentPlan === 'free' && (
              <div className="space-x-2">
                <Button
                  onClick={() => checkoutMutation.mutate({ plan: 'pro', interval: 'monthly' })}
                  disabled={checkoutMutation.isPending}
                >
                  Upgrade to Pro
                </Button>
                <Button
                  onClick={() => checkoutMutation.mutate({ plan: 'business', interval: 'monthly' })}
                  disabled={checkoutMutation.isPending}
                >
                  Upgrade to Business
                </Button>
              </div>
            )}

            {/* Billing portal */}
            {hasStripeCustomer && (
              <Button
                variant="outline"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
              >
                Manage Billing
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

## 🔧 Step-by-Step Implementation

### 1. Environment Configuration
```bash
# Stripe configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Price IDs from Stripe dashboard
STRIPE_PRO_MONTHLY_PRICE_ID=price_your_pro_monthly_id
STRIPE_PRO_ANNUAL_PRICE_ID=price_your_pro_annual_id
STRIPE_BUSINESS_MONTHLY_PRICE_ID=price_your_business_monthly_id  
STRIPE_BUSINESS_ANNUAL_PRICE_ID=price_your_business_annual_id
```

### 2. Stripe Webhook Handler
```typescript
// File: src/routes/api/stripe/webhook.ts
import { createServerFileRoute } from '@tanstack/react-start/server'

import { auth } from '@/lib/auth/auth'

export const ServerRoute = createServerFileRoute('/api/stripe/webhook').methods({
  POST: async ({ request }) => {
    try {
      // Better Auth handles Stripe webhook validation and processing
      const result = await auth.api.stripeWebhook({
        body: await request.text(),
        headers: request.headers,
      })

      return new Response('OK', { status: 200 })
    } catch (error) {
      console.error('Stripe webhook error:', error)
      return new Response('Webhook error', { status: 400 })
    }
  },
})
```

### 3. Plan Limits Integration in Features
```typescript
// Applying plan limits to feature operations
export const createTodo = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator(createTodoSchema.parse)
  .handler(async ({ data, context }) => {
    const { organizationId, user } = context

    // 1. Check plan limits FIRST
    const limitCheck = await checkPlanLimit({
      resource: 'todos',
      action: 'create',
    })

    if (!limitCheck.allowed) {
      throw new AppError(
        'BIZ_PLAN_LIMIT_EXCEEDED',
        402,
        { 
          resource: 'todos',
          reason: limitCheck.reason,
          currentUsage: limitCheck.usage,
        },
        limitCheck.reason || 'Plan limit exceeded',
        [{ action: 'upgrade' }]
      )
    }

    // 2. Check permissions
    await checkPermission('todos', ['create'], organizationId)

    // 3. Create the todo
    const newTodo = await db
      .insert(todos)
      .values({
        ...data,
        organizationId,
        createdBy: user.id,
      })
      .returning()

    return newTodo[0]
  })
```

## 🎯 Integration Requirements

### With Organization System
```typescript
// Organization creation with billing setup
export const createOrganization = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const result = await auth.api.organization.create({
      name: data.name,
      slug: data.slug,
    })

    if (result.organization) {
      // Initialize with free plan
      await db
        .update(organization)
        .set({
          currentPlan: 'free',
          planLimits: BILLING_PLANS.free.limits,
        })
        .where(eq(organization.id, result.organization.id))
    }

    return result
  })
```

### With Error Handling
```typescript
// Plan limit error with upgrade action
export class PlanLimitError extends AppError {
  constructor(resource: string, usage: any, limit: number) {
    super(
      'BIZ_PLAN_LIMIT_EXCEEDED',
      402,
      { resource, usage, limit },
      `You've reached your plan limit of ${limit} ${resource}`,
      [{ action: 'upgrade', label: 'Upgrade Plan' }]
    )
  }
}
```

## 🧪 Testing Requirements

### Billing Flow Testing
```typescript
// Test plan limits enforcement
import { describe, it, expect, vi } from 'vitest'

describe('Plan Limits', () => {
  it('should enforce todo creation limits', async () => {
    // Mock organization with free plan (10 todos limit)
    vi.mocked(getCurrentUsage).mockResolvedValue({
      todos: { used: 10, limit: 10 }
    })

    await expect(
      createTodo({ title: 'Test' }, 'org1', 'user1')
    ).rejects.toThrow('Plan limit exceeded')
  })

  it('should allow unlimited for pro plans', async () => {
    vi.mocked(getCurrentUsage).mockResolvedValue({
      todos: { used: 100, limit: -1 } // Unlimited
    })

    const result = await createTodo({ title: 'Test' }, 'org1', 'user1')
    expect(result).toBeDefined()
  })
})
```

### Subscription Testing
```typescript
// Test subscription management
describe('Subscription Management', () => {
  it('should create checkout session for valid plans', async () => {
    const mockContext = {
      organizationId: 'org1',
      user: { id: 'user1' },
      headers: new Headers(),
    }

    vi.mocked(auth.api.upgradeSubscription).mockResolvedValue({
      url: 'https://checkout.stripe.com/session123',
    })

    const result = await createCheckout.handler({
      data: { plan: 'pro', interval: 'monthly' },
      context: mockContext,
    })

    expect(result.checkoutUrl).toBe('https://checkout.stripe.com/session123')
  })
})
```

## 📋 Implementation Checklist

Before considering billing implementation complete, verify:

- [ ] **Stripe Configuration**: All price IDs and webhook secret configured
- [ ] **Better Auth Integration**: Stripe plugin properly configured
- [ ] **Plan Definitions**: All plans with proper limits defined
- [ ] **Permission Checks**: Billing operations require admin/owner permissions
- [ ] **Limit Enforcement**: Plan limits validated before resource creation
- [ ] **Organization Scoping**: All subscriptions bound to organizations via referenceId
- [ ] **Webhook Handling**: Stripe webhooks processed through Better Auth
- [ ] **Error Handling**: Proper error types for billing failures
- [ ] **Usage Tracking**: Current usage calculated accurately
- [ ] **Client Integration**: Billing UI properly connected to server functions

## 🚀 Advanced Patterns

### Prorated Upgrades
```typescript
// Handle mid-cycle plan changes
export const changePlan = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator(z.object({ newPlan: z.enum(['pro', 'business']) }))
  .handler(async ({ data, context }) => {
    await checkPermission('billing', ['manage'], context.organizationId)

    // Better Auth handles prorated changes automatically
    return await auth.api.upgradeSubscription({
      body: {
        plan: data.newPlan,
        referenceId: context.organizationId,
        prorate: true, // Enable prorated billing
      },
      headers: context.headers,
    })
  })
```

### Usage-Based Billing
```typescript
// Track usage events for usage-based billing
export const trackUsage = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ data, context }) => {
    const { organizationId } = context

    // Record usage event
    await db.insert(usageEvents).values({
      organizationId,
      eventType: data.eventType,
      quantity: data.quantity,
      timestamp: new Date(),
    })

    // Update usage counters
    await updateUsageCounters(organizationId, data.eventType, data.quantity)
  })
```

This billing system provides enterprise-grade subscription management with automatic plan enforcement, seamless Stripe integration, and comprehensive usage tracking.