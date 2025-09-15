import { pgTable, text, timestamp, boolean, integer, jsonb, vector } from 'drizzle-orm/pg-core'
import { nanoid } from 'nanoid'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified')
    .$defaultFn(() => false)
    .notNull(),
  image: text('image'),
  role: text('role').default('user').notNull(),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
  language: text('language').default('en').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})


export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const organization = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  logo: text('logo'),

  // Billing fields
  currentPlan: text('current_plan').default('free').notNull(), // Cached from Stripe for quick access
  stripeCustomerId: text('stripe_customer_id'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: text('metadata'),
})

export const member = pgTable('member', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').default('member').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const invitation = pgTable('invitation', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role'),
  status: text('status').default('pending').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  inviterId: text('inviter_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

// Better Auth Stripe subscription table
export const subscription = pgTable('subscription', {
  id: text('id').primaryKey(),
  plan: text('plan').notNull(),
  referenceId: text('reference_id').notNull(), // Can be userId or organizationId
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  status: text('status').default('incomplete'),
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  trialStart: timestamp('trial_start'),
  trialEnd: timestamp('trial_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  seats: integer('seats'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Custom todos table
export const todos = pgTable('todos', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  title: text('title').notNull(),
  description: text('description'),
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  createdBy: text('created_by')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  assignedTo: text('assigned_to').references(() => user.id, { onDelete: 'set null' }),
  completed: boolean('completed').default(false).notNull(),
  priority: integer('priority').default(3).notNull(),
  dueDate: timestamp('due_date'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// RAG Documents (metadata only, files stored in filesystem)
export const documents = pgTable('documents', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  title: text('title').notNull(),
  filePath: text('file_path').notNull(), // Path to file in storage
  contentType: text('content_type').notNull(), // e.g., 'application/pdf', 'text/plain'
  fileSize: integer('file_size').notNull(), // File size in bytes
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  createdBy: text('created_by')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// RAG Document Chunks - REMOVED: Using Mastra vector system instead

// Agents table
export const agents = pgTable('agents', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  instructions: text('instructions').notNull(),
  selectedTools: text('selected_tools').array().notNull().$default(() => []),
  createdBy: text('created_by')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Link agents to documents for knowledge base
export const agentDocuments = pgTable('agent_documents', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  agentId: text('agent_id')
    .references(() => agents.id, { onDelete: 'cascade' })
    .notNull(),
  documentId: text('document_id')
    .references(() => documents.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Tool connections (OAuth tokens for external services)
export const toolConnections = pgTable('tool_connections', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })
    .notNull(),
  provider: text('provider').notNull(), // 'google_calendar', 'hubspot'
  displayName: text('display_name').notNull(), // User-defined name like "CEO Calendar"
  description: text('description'), // Optional user description
  accountEmail: text('account_email'), // For display (e.g., sales@company.com)
  accessToken: text('access_token'), // Encrypted with AES-256
  refreshToken: text('refresh_token'), // Encrypted with AES-256
  expiresAt: timestamp('expires_at'),
  scopes: text('scopes').array(), // OAuth scopes granted
  metadata: jsonb('metadata'), // Provider-specific data
  connectedBy: text('connected_by')
    .references(() => user.id, { onDelete: 'cascade' }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Link agents to specific connections (not just providers)
export const agentConnections = pgTable('agent_connections', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  agentId: text('agent_id')
    .references(() => agents.id, { onDelete: 'cascade' })
    .notNull(),
  connectionId: text('connection_id')
    .references(() => toolConnections.id, { onDelete: 'cascade' })
    .notNull(),
  toolAlias: text('tool_alias').notNull(), // "ceo_calendar", "sales_crm"
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

