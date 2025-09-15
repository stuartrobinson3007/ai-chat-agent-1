import { serverOnly } from '@tanstack/react-start'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization, magicLink, admin, emailOTP } from 'better-auth/plugins'
import { stripe as stripePlugin } from '@better-auth/stripe'
import { createAccessControl } from 'better-auth/plugins/access'
import Stripe from 'stripe'
import { defaultStatements } from 'better-auth/plugins/organization/access'
import { reactStartCookies } from 'better-auth/react-start'
import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db/db'
import { redis } from '@/lib/db/redis'
import { sendMagicLinkEmail, sendInvitationEmail, sendOTPEmail } from '@/lib/utils/email'
import * as schema from '@/database/schema'

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil',
})

// Use default statements and add our custom resource
const statement = {
  ...defaultStatements, // Includes invitation permissions needed for invites to work
  todos: ['create', 'read', 'update', 'delete', 'assign'],
  billing: ['view', 'manage'], // Add billing permissions
  invitation: ['create', 'read', 'delete', 'cancel'], // Add cancel permission for Better Auth compatibility
} as const

// Create access control instance
const ac = createAccessControl(statement)

// Define roles with specific permissions
const viewer = ac.newRole({
  billing: ['view'],
})

const member = ac.newRole({
  todos: ['create', 'update', 'delete'],
  billing: ['view'],
})

const orgAdmin = ac.newRole({
  organization: ['update'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'delete', 'cancel'],
  todos: ['create', 'update', 'delete', 'assign'],
  billing: ['view', 'manage'],
})

const owner = ac.newRole({
  organization: ['update', 'delete'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'delete', 'cancel'],
  todos: ['create', 'update', 'delete', 'assign'],
  billing: ['view', 'manage'],
})

const getAuthConfig = serverOnly(() =>
  betterAuth({
    baseURL: process.env.BETTER_AUTH_URL!,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: schema,
    }),

    user: {
      additionalFields: {
        firstName: {
          type: 'string',
          required: false,
        },
        lastName: {
          type: 'string',
          required: false,
        },
        onboardingCompleted: {
          type: 'boolean',
          defaultValue: false,
          required: false,
        },
        language: {
          type: 'string',
          defaultValue: 'en',
          required: false,
        },
      },
    },

    // session: {
    //   cookieCache: {
    //     enabled: true,
    //     maxAge: 5 * 60, // 5 minutes
    //   },
    //   expiresIn: 60 * 60 * 24 * 7, // 7 days
    //   updateAge: 60 * 60 * 24 // 1 day
    // },

    secondaryStorage: {
      get: async key => {
        return await redis.get(key)
      },
      set: async (key, value, ttl) => {
        if (ttl) {
          await redis.set(key, value, { EX: ttl })
        } else {
          await redis.set(key, value)
        }
      },
      delete: async key => {
        await redis.del(key)
      },
    },

    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
      ...(process.env.GITHUB_CLIENT_ID && {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        },
      }),
    },

    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendMagicLinkEmail(email, url)
        },
        expiresIn: 60 * 5, // 5 minutes
      }),
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          await sendOTPEmail(email, otp, type)
        },
        disableSignUp: false, // Allow automatic account creation for invitations
      }),
      admin({
        adminRoles: ['superadmin'], // TODO: Not sure if this actually does anything. We keep the superadmin role in the user db for quick checks
        adminUserIds: process.env.ADMIN_USER_IDS?.split(',') || [], // But its this that actually makes a user an admin (superadmin as we call it)
      }),
      stripePlugin({
        stripeClient: stripe,
        stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
        createCustomerOnSignUp: false, // We'll create on org creation
        // Add metadata when creating Stripe customers
        getCustomerCreateParams: async (data, _ctx) => {
          // Note: At customer creation time, we don't have the organizationId yet
          // It will be added when the subscription is created
          return {
            metadata: {
              userId: data.user.id,
            },
          }
        },
        successUrl: `${process.env.BETTER_AUTH_URL}/billing?success=true`,
        cancelUrl: `${process.env.BETTER_AUTH_URL}/billing`,
        subscription: {
          enabled: true,
          // Add metadata to Stripe checkout sessions and subscriptions
          getCheckoutSessionParams: async (data) => {
            return {
              params: {
                subscription_data: {
                  metadata: {
                    organizationId: data.subscription.referenceId,
                  },
                },
                metadata: {
                  organizationId: data.subscription.referenceId,
                },
              },
            }
          },
          // IMPORTANT: This callback is invoked internally by Better Auth
          // when subscription APIs are called with a referenceId.
          // It verifies if the user can manage billing for the organization.
          // You don't call this directly - Better Auth handles it automatically.
          authorizeReference: async ({ user, referenceId }) => {
            // Allow users to manage subscriptions for their organizations
            // Check if user is a member of the organization with billing permissions
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
            // Allow owners and admins to manage billing
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
      organization({
        allowUserToCreateOrganization: true,
        organizationLimit: 99,
        invitationExpiresIn: 60 * 60 * 48, // 48 hours
        cancelPendingInvitationsOnReInvite: false,
        requireEmailVerificationOnInvitation: false,
        sendInvitationEmail: async data => {
          const inviteUrl = `${process.env.BETTER_AUTH_URL}/invite/${data.id}`
          await sendInvitationEmail(
            data.email,
            data.inviter?.user?.name || 'A team member',
            data.organization.name,
            inviteUrl
          )
        },
        ac,
        roles: {
          owner,
          admin: orgAdmin,
          member,
          viewer,
        },
      }),
      reactStartCookies(), // Must be last plugin
    ],
  })
)

export const auth = getAuthConfig()
export const roles = {
  owner,
  admin: orgAdmin,
  member,
  viewer,
}
export { ac }
