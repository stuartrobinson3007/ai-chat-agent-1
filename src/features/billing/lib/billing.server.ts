import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

import { BILLING_PLANS } from './plans.config'

// Define subscription type based on BetterAuth Stripe plugin actual response
interface BetterAuthSubscription {
  id: string
  status: 'active' | 'trialing' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'unpaid' | 'paused'
  plan: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  limits?: Record<string, number>
  seats?: number
  referenceId?: string
}

import { organizationMiddleware } from '@/features/organization/lib/organization-middleware'
import { checkPermission } from '@/lib/utils/permissions'
import { getOrganizationUsage } from '@/lib/utils/plan-limits'
import { safeEnumAccess } from '@/taali/utils/type-safe-access'
import { db } from '@/lib/db/db'
import { organization } from '@/database/schema'
import * as schema from '@/database/schema'
import { auth } from '@/lib/auth/auth'
import { AppError } from '@/taali/utils/errors'
import { ERROR_CODES } from '@/taali/errors/codes'
import errorTranslations from '@/i18n/locales/en/errors.json'

// Get current subscription using BetterAuth API
export const getSubscription = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const orgId = context.organizationId! // organizationMiddleware ensures this exists


    // Get organization to check if it exists and get current plan
    const [org] = await db.select({
      id: organization.id,
      name: organization.name,
      currentPlan: organization.currentPlan,
      stripeCustomerId: organization.stripeCustomerId,
    }).from(organization).where(eq(organization.id, orgId))


    if (!org) {
      throw AppError.notFound(errorTranslations.fields.organization)
    }

    // Use BetterAuth's API to list subscriptions
    let activeSubscription: BetterAuthSubscription | null = null
    let allSubscriptions: BetterAuthSubscription[] = []

    try {
      // First, let's try to query the database directly to see what's there
      const directDbQuery = await db.select().from(schema.subscription).where(eq(schema.subscription.referenceId, orgId))

      const subscriptions = await auth.api.listActiveSubscriptions({
        query: {
          referenceId: orgId,
        },
        headers: context.headers,
      })


      // Also try without referenceId to see if we get any subscriptions at all
      try {
        await auth.api.listActiveSubscriptions({
          query: {},
          headers: context.headers,
        })
      } catch (_testError) {
        // Silently continue - this is just a test query
      }

      // If BetterAuth returns subscriptions, use them
      if (subscriptions && subscriptions.length > 0) {
        // Cast subscriptions to our interface type - Better-auth returns compatible objects
        allSubscriptions = subscriptions.map(sub => ({
          id: sub.id,
          status: sub.status,
          plan: sub.plan,
          stripeCustomerId: sub.stripeCustomerId,
          stripeSubscriptionId: sub.stripeSubscriptionId,
          limits: sub.limits,
          seats: sub.seats,
          referenceId: sub.referenceId,
        })) as BetterAuthSubscription[]

      }
      // If BetterAuth returns empty but we have subscriptions in DB, use DB results
      else if (directDbQuery && directDbQuery.length > 0) {

        // Map DB results to match BetterAuthSubscription interface
        allSubscriptions = directDbQuery.map(sub => ({
          id: sub.id,
          status: sub.status as BetterAuthSubscription['status'],
          plan: sub.plan,
          stripeCustomerId: sub.stripeCustomerId || undefined,
          stripeSubscriptionId: sub.stripeSubscriptionId || undefined,
          limits: undefined, // Limits are now fetched from BILLING_PLANS config, not stored in DB
          seats: sub.seats || undefined,
          referenceId: sub.referenceId,
        })) as BetterAuthSubscription[]
      }

      // Find the most relevant subscription (including past_due, incomplete, etc.)
      if (allSubscriptions.length > 0) {
        // Prioritize active/trialing, but include all statuses
        activeSubscription =
          allSubscriptions.find(sub => sub.status === 'active' || sub.status === 'trialing') ||
          allSubscriptions[0] // Use first subscription even if past_due/incomplete

      }
    } catch {
      // Continue without subscription data rather than failing entirely
      // Subscription data is optional for basic functionality
    }

    // Use organization's currentPlan as primary source, fall back to subscription or free
    const currentPlan = org.currentPlan || activeSubscription?.plan || 'free'

    const result = {
      organization: org,
      subscription: activeSubscription,
      allSubscriptions,
      currentPlan,
      features: safeEnumAccess(BILLING_PLANS, currentPlan)?.features,
      limits: activeSubscription?.limits || safeEnumAccess(BILLING_PLANS, currentPlan)?.limits || BILLING_PLANS.free.limits,
      hasStripeCustomer:
        !!org.stripeCustomerId ||
        !!activeSubscription?.stripeCustomerId ||
        allSubscriptions.length > 0,
    }


    return result
  })

// Create checkout session using BetterAuth
const createCheckoutSchema = z.object({
  plan: z.enum(['pro', 'business']),
  interval: z.enum(['monthly', 'annual']),
})

export const createCheckout = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator((data: unknown) => createCheckoutSchema.parse(data))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId! // organizationMiddleware ensures this exists

    // Check billing permissions
    await checkPermission('billing', ['manage'], orgId)

    const { plan, interval } = data


    try {
      // Use BetterAuth's subscription upgrade API
      const result = await auth.api.upgradeSubscription({
        body: {
          plan,
          successUrl: `${process.env.BETTER_AUTH_URL}/billing?success=true`,
          cancelUrl: `${process.env.BETTER_AUTH_URL}/billing`,
          annual: interval === 'annual',
          referenceId: orgId,
        },
        headers: context.headers,
      })


      if (!result?.url) {
        throw new AppError(
          ERROR_CODES.SYS_CONFIG_ERROR,
          500,
          undefined,
          errorTranslations.server.checkoutSessionFailed
        )
      }

      return { checkoutUrl: result.url }
    } catch (error) {
      // Handle checkout creation errors

      // Handle specific error types
      if ((error as { type?: string; message?: string }).type === 'StripeCardError') {
        throw new AppError(
          ERROR_CODES.BIZ_PAYMENT_FAILED,
          400,
          { reason: (error as { message?: string }).message },
          errorTranslations.server.paymentFailed
        )
      }

      if ((error as { type?: string }).type === 'StripeRateLimitError') {
        throw new AppError(ERROR_CODES.SYS_RATE_LIMIT, 429, undefined, 'Rate limit exceeded')
      }

      // Re-throw our errors, wrap unknown ones
      if (error instanceof AppError) {
        throw error
      }

      throw new AppError(
        ERROR_CODES.SYS_SERVER_ERROR,
        500,
        undefined,
        `Failed to create checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  })

// Create billing portal session
export const createBillingPortal = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const orgId = context.organizationId! // organizationMiddleware ensures this exists

    // Check billing permissions
    await checkPermission('billing', ['manage'], orgId)


    // Get organization to check for stripeCustomerId
    const [org] = await db.select().from(organization).where(eq(organization.id, orgId)).limit(1)

    if (!org) {
      throw AppError.notFound(errorTranslations.fields.organization)
    }

    // Try to create portal session
    // BetterAuth's createBillingPortal should work if there's a customer associated
    try {
      const result = await auth.api.createBillingPortal({
        body: {
          referenceId: orgId,
        },
        headers: context.headers,
      })

      if (!result?.url) {
        throw new AppError(
          ERROR_CODES.SYS_CONFIG_ERROR,
          500,
          undefined,
          errorTranslations.server.billingPortalFailed
        )
      }

      return { portalUrl: result.url }
    } catch (error) {
      // If no customer exists, we need to handle this differently
      if (org.stripeCustomerId) {
        // Customer exists but portal failed - this is a real error
        throw error
      } else {
        // No customer yet - they need to subscribe first
        throw new AppError(
          ERROR_CODES.BIZ_INVALID_STATE,
          400,
          undefined,
          errorTranslations.server.noBillingHistory,
          [{ action: 'upgrade' }]
        )
      }
    }
  })

// Get usage statistics
export const getUsageStats = createServerFn({ method: 'GET' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    const orgId = context.organizationId

    if (!orgId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: errorTranslations.server.organizationIdRequired },
        'Organization ID is required'
      )
    }

    // Use the new utility function that leverages Better Auth
    const usage = await getOrganizationUsage(orgId, context.headers)

    return { usage }
  })

// Check if action is allowed based on plan limits
export const checkPlanLimit = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .validator(
    z.object({
      resource: z.enum(['todos', 'members', 'storage']),
      action: z.enum(['create', 'update']),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId

    if (!orgId) {
      throw new AppError(
        ERROR_CODES.VAL_REQUIRED_FIELD,
        400,
        { field: 'organizationId' },
        'Organization ID is required'
      )
    }

    // Use the checkPlanLimitUtil function which now uses Better Auth subscriptions
    const { checkPlanLimitUtil } = await import('@/lib/utils/plan-limits')
    const result = await checkPlanLimitUtil(data.resource, data.action, orgId, context.headers)

    return {
      allowed: result.allowed,
      reason: result.reason,
      usage: result.usage,
    }
  })
