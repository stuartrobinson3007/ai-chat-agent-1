import { createServerFileRoute } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'

import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/db'
import { organization } from '@/database/schema'
import { BILLING_PLANS } from '@/features/billing/lib/plans.config'

export const ServerRoute = createServerFileRoute('/api/stripe/webhook').methods({
  POST: async ({ request }) => {
    
    try {
      // Get body first since Better Auth will consume the request
      const body = await request.text()
      
      // Parse to check what we're dealing with
      const event: { type: string; data: { object: any }; [key: string]: unknown } = JSON.parse(body)
      
      // Create a new request with the body for Better Auth to process
      const clonedRequest = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: body,
      })
      
      // Better Auth handles signature verification internally
      try {
        await auth.api.stripeWebhook({
          request: clonedRequest,
          headers: request.headers,
        })
      } catch {
        // Don't throw - continue with our own processing
      }
      
      // Handle our custom logic
      switch (event.type) {
        case 'customer.created': {
          const customer = event.data.object
          const orgId = customer.metadata?.organizationId
          
          if (orgId && customer.id) {
            await db
              .update(organization)
              .set({
                stripeCustomerId: customer.id,
                updatedAt: new Date(),
              })
              .where(eq(organization.id, orgId))
          }
          break
        }
        
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object
          const orgId = subscription.metadata?.organizationId
          
          if (orgId) {
            // Only update if subscription is active or trialing
            if (subscription.status === 'active' || subscription.status === 'trialing') {
              // Determine plan from price ID
              let planName = 'free'
              const priceId = subscription.items?.data?.[0]?.price?.id
              
              // Check each plan's price IDs
              for (const [key, plan] of Object.entries(BILLING_PLANS)) {
                if (plan.stripePriceId && typeof plan.stripePriceId === 'object') {
                  if (plan.stripePriceId.monthly === priceId) {
                    planName = key
                    break
                  }
                  if (plan.stripePriceId.annual === priceId) {
                    planName = key
                    break
                  }
                }
              }
              
              // Extract Stripe customer ID from subscription
              const stripeCustomerId = subscription.customer
              
              const updateData: { currentPlan: string; updatedAt: Date; stripeCustomerId?: string } = {
                currentPlan: planName,
                updatedAt: new Date(),
              }
              
              // Also update stripeCustomerId if available
              if (stripeCustomerId && typeof stripeCustomerId === 'string') {
                updateData.stripeCustomerId = stripeCustomerId
              }
              
              await db
                .update(organization)
                .set(updateData)
                .where(eq(organization.id, orgId))
            }
          }
          break
        }
        
        case 'customer.subscription.deleted': {
          const subscription = event.data.object
          const orgId = subscription.metadata?.organizationId
          
          if (orgId) {
            await db
              .update(organization)
              .set({
                currentPlan: 'free',
                updatedAt: new Date(),
              })
              .where(eq(organization.id, orgId))
          }
          break
        }
      }

      return new Response('OK', { status: 200 })
    } catch (error) {
      // Error could be from Better Auth signature validation or our processing
      
      return new Response(
        `Webhook processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        { status: 400 }
      )
    }
  },
})