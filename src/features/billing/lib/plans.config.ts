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
      todos: 20,
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
