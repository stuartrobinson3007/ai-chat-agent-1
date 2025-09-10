# Billing Security Comprehensive Audit Routine

This document provides a systematic quality assurance routine for AI agents to validate billing system security, payment processing protection, Stripe integration patterns, and financial operation security in the TanStack SaaS starter template.

## 🎯 **Purpose**

This routine ensures that all billing and payment code follows financial security best practices, implements proper permission checks, maintains plan limit enforcement, prevents payment fraud, and protects sensitive financial data.

## 📋 **Pre-Audit Checklist**

Before beginning the audit, ensure:
- [ ] Billing documentation (`09-billing-subscription-system.md`) is current
- [ ] Understanding of Better Auth Stripe integration patterns
- [ ] Access to all billing, subscription, and payment-related code

## 🔍 **Phase 1: Billing System Discovery**

### **1.1 Find All Billing-Related Files**

Run these commands to discover all billing code:

```bash
# Find all billing server functions
rg "billing|subscription|payment|stripe|checkout" --type ts src/features/billing/ -l

# Find all plan-related code
rg "plan|limit|usage|quota" --type ts src/ -l

# Find all Stripe integration
rg "stripe|Stripe" --type ts src/ -l

# Find all billing UI components
rg "billing|subscription|payment|checkout" --type tsx src/ -l

# Find billing middleware and permissions
rg "billing.*permission|checkPermission.*billing" --type ts src/ -l
```

### **1.2 Categorize by Financial Risk**

Create file lists by financial impact:
- **Critical Financial**: Payment processing, subscription changes, billing admin
- **High Risk**: Plan upgrades, usage tracking, billing portals
- **Medium Risk**: Usage display, plan information, billing history
- **Low Risk**: Plan comparison, feature lists, billing help

## 💳 **Phase 2: Payment Security Audit**

### **2.1 Stripe Integration Security**

#### **❌ CRITICAL: Find custom Stripe implementations**
```bash
# Find direct Stripe usage bypassing Better Auth
rg "new Stripe\(|stripe\.checkout|stripe\.subscriptions|stripe\.customers" --type ts src/ | rg -v "better-auth|auth\.ts"

# Should return ZERO - use Better Auth Stripe plugin exclusively

# Find hardcoded Stripe credentials
rg "sk_test_|sk_live_|pk_test_|pk_live_|whsec_" --type ts src/

# Should return ZERO - use environment variables only

# Find Stripe client creation outside auth config
rg "Stripe\(.*process\.env\.STRIPE" --type ts src/ | rg -v "src/lib/auth/auth\.ts"

# Stripe client should only be created in auth configuration
```

#### **✅ Required Stripe Security Patterns:**
```typescript
// REQUIRED: Use Better Auth Stripe plugin exclusively
export const createCheckout = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ data, context }) => {
    await checkPermission('billing', ['manage'], context.organizationId)
    
    const result = await auth.api.upgradeSubscription({
      body: {
        plan: data.plan,
        referenceId: context.organizationId, // Organization binding
        annual: data.interval === 'annual',
      },
      headers: context.headers,
    })
    
    return { checkoutUrl: result.url }
  })

// REQUIRED: Stripe configuration in auth.ts only
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil',
})
```

### **2.2 Financial Permission Security**

#### **❌ CRITICAL: Find billing operations without proper permissions**
```bash
# Find billing operations missing permission checks
rg "createServerFn.*method.*POST" -A 15 --type ts src/features/billing/ | rg "auth\.api\.upgradeSubscription|auth\.api\.createBillingPortal|stripe" -B 5 | rg -v "checkPermission.*billing.*manage"

# Should return ZERO - all billing operations need explicit permission checks

# Find billing UI without permission validation
rg "upgradeSubscription|createCheckout|billingPortal" --type tsx src/ -B 10 | rg -v "canManageBilling|permission.*billing"

# Billing UI should check user permissions before showing options
```

#### **✅ Required Permission Patterns:**
```typescript
// REQUIRED: Billing permission validation
export const billingAction = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    // CRITICAL: Only owners/admins can manage billing
    await checkPermission('billing', ['manage'], context.organizationId)
    
    // Safe to proceed with billing operations
  })

// REQUIRED: Client-side permission checking
function BillingComponent() {
  const { canManageBilling } = useClientPermissions()
  
  if (!canManageBilling) {
    return <div>You don't have billing permissions</div>
  }
  
  // Show billing management UI
}
```

## 📊 **Phase 3: Plan Limit Security Audit**

### **3.1 Plan Limit Enforcement Verification**

#### **❌ CRITICAL: Find resource creation without limit checks**
```bash
# Find resource creation bypassing plan limits
rg "db\.insert.*todos|db\.insert.*members|db\.insert.*storage" --type ts src/ -B 10 | rg -v "checkPlanLimit|planLimitMiddleware"

# Resource creation should check plan limits first

# Find plan limit middleware bypass
rg "createServerFn.*method.*POST" -A 10 --type ts src/ | rg "insert.*todos|insert.*members" -B 5 | rg -v "planLimitMiddleware\(.*\)|checkPlanLimit"

# User data creation should enforce plan limits
```

#### **✅ Required Plan Limit Patterns:**
```typescript
// REQUIRED: Plan limit enforcement in server functions
export const createTodo = createServerFn({ method: 'POST' })
  .middleware([planLimitMiddleware('todos')])
  .handler(async ({ data, context }) => {
    // Plan limits already validated by middleware
    await checkPermission('todos', ['create'], context.organizationId)
    // Proceed with creation
  })

// REQUIRED: Manual limit checking
const limitCheck = await checkPlanLimit({ 
  resource: 'todos', 
  action: 'create' 
})

if (!limitCheck.allowed) {
  throw new AppError(
    'BIZ_PLAN_LIMIT_EXCEEDED',
    402,
    { resource: 'todos', reason: limitCheck.reason },
    limitCheck.reason,
    [{ action: 'upgrade' }]
  )
}
```

### **3.2 Usage Tracking Security**

#### **❌ CRITICAL: Find usage calculation vulnerabilities**
```bash
# Find usage calculations without organization scoping
rg "count\(|sum\(|usage" --type ts src/features/billing/ -A 5 -B 5 | rg -v "organizationId|eq.*organization"

# Usage calculations must be organization-scoped

# Find usage tracking without validation
rg "trackUsage|recordUsage|incrementUsage" --type ts src/ -B 5 | rg -v "organizationMiddleware|checkPermission"

# Usage tracking should be authenticated and validated
```

## 💰 **Phase 4: Subscription Security Audit**

### **4.1 Subscription Management Security**

#### **❌ CRITICAL: Find subscription operations without organization binding**
```bash
# Find subscription operations missing referenceId
rg "auth\.api\.upgradeSubscription|auth\.api\.cancelSubscription" --type ts src/ -A 5 -B 5 | rg -v "referenceId.*organizationId"

# All subscription operations must bind to organizations

# Find subscription data access without validation
rg "listActiveSubscriptions|getSubscription" --type ts src/ -A 10 | rg -v "organizationId|referenceId"

# Subscription access should validate organization membership
```

#### **✅ Required Subscription Security:**
```typescript
// REQUIRED: Organization-bound subscriptions
const result = await auth.api.upgradeSubscription({
  body: {
    plan: 'pro',
    referenceId: organizationId, // CRITICAL: Organization binding
    annual: interval === 'annual',
  },
  headers: context.headers,
})

// REQUIRED: Subscription access validation
const subscriptions = await auth.api.listActiveSubscriptions({
  query: { referenceId: organizationId }, // CRITICAL: Scope to organization
  headers: context.headers,
})
```

### **4.2 Webhook Security Verification**

#### **❌ CRITICAL: Find webhook handling vulnerabilities**
```bash
# Find webhook endpoints without proper validation
rg "webhook|stripe.*event" --type ts src/routes/api/ -A 15 | rg -v "auth\.api\.stripeWebhook"

# Stripe webhooks should use Better Auth validation

# Find webhook data processing without verification
rg "webhook.*body|event\.data|stripe.*event" --type ts src/ -B 5 -A 5 | rg -v "verified|signature"

# Webhook data should be verified before processing
```

#### **✅ Required Webhook Security:**
```typescript
// REQUIRED: Webhook validation through Better Auth
export const ServerRoute = createServerFileRoute('/api/stripe/webhook').methods({
  POST: async ({ request }) => {
    try {
      // Better Auth handles Stripe webhook validation automatically
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

## 💸 **Phase 5: Financial Data Protection**

### **5.1 Sensitive Financial Data Security**

#### **❌ CRITICAL: Find financial data exposure**
```bash
# Find payment information in logs
rg "console\.log.*payment|console\.log.*card|console\.log.*stripe" --type ts src/

# Should return ZERO - never log payment information

# Find financial data in client state
rg "useState.*payment|useState.*card|localStorage.*billing" --type tsx src/

# Should return ZERO - no sensitive financial data in client storage

# Find unencrypted financial data
rg "creditCard|cardNumber|cvv|expiryDate" --type ts --type tsx src/

# Should return ZERO - no direct card data handling
```

#### **✅ Required Financial Data Patterns:**
```typescript
// REQUIRED: Let Better Auth and Stripe handle sensitive data
// NEVER store card data directly - use Stripe's secure tokenization

// SAFE: Reference subscription metadata only
interface SubscriptionData {
  plan: string
  status: string
  currentPeriodEnd: Date
  // NO credit card details
}
```

### **5.2 Billing Error Security**

#### **❌ CRITICAL: Find billing errors exposing sensitive information**
```bash
# Find billing errors that might expose internal details
rg "error\.message.*stripe|error.*payment.*details" --type ts src/features/billing/ -B 2 -A 2

# Should not expose Stripe error details to users

# Find billing error handling without proper user messages
rg "catch.*error.*billing|catch.*stripe" --type ts src/ -A 5 | rg -v "user-friendly|AppError"

# Should use user-friendly error messages for billing failures
```

## 🧪 **Phase 6: Billing Testing Security**

### **6.1 Financial Test Coverage**

Check that billing security is tested:

```bash
# Find billing security tests
rg "describe.*billing.*security|it.*should.*require.*billing.*permission" --type ts src/

# Should cover: permission checks, plan limits, subscription security

# Find payment flow tests
rg "describe.*payment|describe.*checkout|it.*should.*upgrade.*plan" --type ts src/

# Should cover: upgrade flows, payment failures, permission errors
```

### **6.2 Plan Limit Test Coverage**

```bash
# Find plan limit tests
rg "describe.*plan.*limit|it.*should.*enforce.*limit" --type ts src/

# Should cover: limit enforcement, upgrade prompts, resource creation blocking
```

## 📋 **Billing Security Report Template**

### **Billing Security Audit Report**

**Date**: [Audit Date]
**Auditor**: [AI Agent ID]
**Scope**: [Billing Components Audited]

#### **Payment Processing Security**
- **Stripe Integration**: ✅/❌ Using Better Auth exclusively
- **Webhook Validation**: ✅/❌ Properly secured
- **Credential Protection**: ✅/❌ No hardcoded keys
- **Financial Data**: ✅/❌ No sensitive data exposure

#### **Permission Security**
- **Billing Operations**: X/X require proper permissions
- **Admin Verification**: X/X billing admin operations protected
- **Organization Binding**: X/X subscriptions bound to organizations
- **UI Permission Checks**: X/X billing UI validates permissions

#### **Plan Limit Security**
- **Resource Creation**: X/X operations check limits
- **Usage Tracking**: X/X usage calculations organization-scoped
- **Limit Enforcement**: ✅/❌ Consistently applied
- **Upgrade Prompts**: ✅/❌ Proper limit exceeded handling

#### **Financial Data Protection**
- **Data Exposure**: X violations found
- **Logging Security**: ✅/❌ No financial data logged
- **Client Storage**: ✅/❌ No sensitive data in browser
- **Error Information**: ✅/❌ Safe error messages

#### **Critical Financial Security Issues**
| File | Line | Vulnerability | Risk Level | Financial Impact |
|------|------|--------------|-----------|------------------|
| ... | ... | ... | ... | ... |

#### **Billing Security Recommendations**
1. [Critical Payment Security Fixes]
2. [Permission System Improvements]
3. [Plan Limit Enforcement]
4. [Financial Data Protection]

---

## 🚨 **Critical Financial Security Patterns**

### **Payment Processing Anti-Patterns**
```bash
# Find these DANGEROUS patterns:
rg "stripe_secret|card_number|cvv|payment.*token" --type ts src/
rg "localStorage.*payment|sessionStorage.*billing" --type tsx src/
rg "console\.log.*stripe|alert.*payment" --type ts src/
```

### **Permission Bypass Detection**
```bash
# Find these DANGEROUS patterns:
rg "// Skip billing.*permission|// TODO.*billing.*auth" --type ts src/
rg "billing.*admin.*false|permission.*billing.*bypass" --type ts src/
```

### **Plan Limit Bypass Detection**
```bash
# Find these DANGEROUS patterns:
rg "// Skip.*limit|// TODO.*limit.*check" --type ts src/
rg "unlimited.*true|limit.*-1.*bypass" --type ts src/
```

## 🔒 **Phase 7: Subscription Lifecycle Security**

### **7.1 Subscription State Security**

#### **❌ CRITICAL: Find unsafe subscription state changes**
```bash
# Find subscription updates without proper validation
rg "update.*subscription|change.*plan|cancel.*subscription" --type ts src/ -B 10 | rg -v "auth\.api\.|checkPermission.*billing"

# Subscription changes should go through Better Auth API

# Find subscription status without validation
rg "subscription\.status|plan\.active|billing\.current" --type ts --type tsx src/ -B 5 | rg -v "auth\.api\.|validated"

# Subscription status should come from validated sources
```

#### **✅ Required Subscription Security:**
```typescript
// REQUIRED: Subscription changes through Better Auth
const result = await auth.api.upgradeSubscription({
  body: {
    plan: newPlan,
    referenceId: organizationId,
    prorate: true,
  },
  headers: context.headers,
})

// REQUIRED: Subscription status validation
const subscriptions = await auth.api.listActiveSubscriptions({
  query: { referenceId: organizationId },
  headers: context.headers,
})

const activeSubscription = subscriptions?.find(
  sub => sub.status === 'active' || sub.status === 'trialing'
)
```

### **7.2 Plan Change Security**

#### **❌ CRITICAL: Find plan changes without authorization verification**
```bash
# Find plan changes that might bypass authorization
rg "changePlan|upgradePlan|downgradePlan" --type ts src/ -B 10 -A 5 | rg -v "referenceId.*organizationId|checkPermission"

# Plan changes must be authorized for the specific organization

# Find billing portal access without validation
rg "createBillingPortal|billingPortal" --type ts src/ -B 5 | rg -v "checkPermission.*billing.*manage"

# Billing portal access requires billing management permissions
```

## 💰 **Phase 8: Financial Error Handling Security**

### **8.1 Payment Error Security**

#### **❌ CRITICAL: Find payment errors exposing sensitive details**
```bash
# Find Stripe errors that might expose sensitive information
rg "StripeError|stripe.*error|payment.*error" --type ts src/ -A 5 -B 2 | rg -v "user-friendly|AppError"

# Payment errors should be converted to user-friendly messages

# Find error handling that might leak financial details
rg "error\.message.*payment|error\.details.*stripe" --type ts src/

# Should not expose Stripe internal error details to users
```

#### **✅ Required Payment Error Patterns:**
```typescript
// REQUIRED: Secure payment error handling
try {
  const result = await auth.api.upgradeSubscription(data)
  return { checkoutUrl: result.url }
} catch (error) {
  // Handle specific Stripe error types securely
  if ((error as any).type === 'StripeCardError') {
    throw new AppError(
      ERROR_CODES.BIZ_PAYMENT_FAILED,
      400,
      { reason: 'Card was declined' }, // Generic message
      'Payment failed. Please check your payment method'
    )
  }
  
  if ((error as any).type === 'StripeRateLimitError') {
    throw new AppError(ERROR_CODES.SYS_RATE_LIMIT, 429)
  }
  
  // Generic error for unknown payment issues
  throw new AppError(
    ERROR_CODES.SYS_SERVER_ERROR,
    500,
    undefined,
    'Payment processing failed. Please try again'
  )
}
```

## 📈 **Phase 9: Usage & Analytics Security**

### **9.1 Usage Data Security**

#### **❌ CRITICAL: Find usage tracking without proper scoping**
```bash
# Find usage calculations that might expose cross-organization data
rg "count\(.*\)|sum\(.*\)|usage.*calculation" --type ts src/features/billing/ -A 5 -B 5 | rg -v "where.*eq.*organizationId"

# Usage calculations must be organization-scoped

# Find usage display without permission verification
rg "usage.*stats|billing.*analytics|plan.*usage" --type tsx src/ -B 5 | rg -v "canViewBilling|checkPermission"

# Usage information should require proper permissions
```

#### **✅ Required Usage Security:**
```typescript
// REQUIRED: Organization-scoped usage calculation
async function getCurrentUsage(organizationId: string) {
  const todoCount = await db
    .select({ count: count(todos.id) })
    .from(todos)
    .where(eq(todos.organizationId, organizationId)) // CRITICAL: Scoping
    
  const memberCount = await db
    .select({ count: count(member.id) })
    .from(member)
    .where(eq(member.organizationId, organizationId)) // CRITICAL: Scoping
    
  return { todos: todoCount[0]?.count || 0, members: memberCount[0]?.count || 0 }
}
```

## 🧪 **Phase 10: Billing Testing Verification**

### **10.1 Payment Security Test Coverage**

Check that billing security scenarios are tested:

```bash
# Find billing permission tests
rg "describe.*billing.*permission|it.*should.*require.*billing.*admin" --type ts src/

# Should cover: permission requirements, role restrictions, unauthorized access

# Find plan limit tests
rg "describe.*plan.*limit|it.*should.*enforce.*limit|it.*should.*block.*creation" --type ts src/

# Should cover: limit enforcement, resource blocking, upgrade prompts

# Find payment error handling tests
rg "describe.*payment.*error|it.*should.*handle.*payment.*failure" --type ts src/

# Should cover: card declined, insufficient funds, network failures
```

### **10.2 Stripe Integration Test Coverage**

```bash
# Find Stripe webhook tests
rg "describe.*webhook|it.*should.*process.*stripe.*event" --type ts src/

# Should cover: webhook validation, event processing, signature verification
```

## 📋 **Comprehensive Billing Security Report Template**

### **Billing Security Audit Report**

**Date**: [Audit Date]
**Auditor**: [AI Agent ID]
**Scope**: [Billing Operations Audited]

#### **Payment Processing Security**
- **Stripe Integration**: X/X using Better Auth exclusively
- **Credential Security**: ✅/❌ No hardcoded keys found
- **Webhook Validation**: ✅/❌ Properly secured through Better Auth
- **Payment Error Handling**: X/X errors properly sanitized

#### **Financial Permission Security**
- **Billing Operations**: X/X require billing management permissions
- **Admin Verification**: X/X billing admin operations protected
- **Organization Binding**: X/X subscriptions properly bound
- **UI Permission Validation**: X/X billing UI checks permissions

#### **Plan Limit Security**
- **Resource Creation**: X/X operations enforce limits
- **Usage Calculations**: X/X calculations organization-scoped
- **Limit Bypass Prevention**: ✅/❌ No bypass mechanisms found
- **Upgrade Flow Security**: ✅/❌ Proper permission verification

#### **Subscription Security**
- **Lifecycle Management**: X/X operations through Better Auth
- **Organization Scoping**: X/X subscriptions organization-bound
- **State Validation**: ✅/❌ Subscription status properly verified
- **Access Control**: ✅/❌ Proper membership validation

#### **Financial Data Protection**
- **Sensitive Data Exposure**: X violations found
- **Error Message Security**: X/X errors properly sanitized
- **Logging Security**: ✅/❌ No financial data in logs
- **Client Storage**: ✅/❌ No sensitive data in browser

#### **Critical Financial Vulnerabilities**
| File | Line | Vulnerability | Risk Level | Financial Impact |
|------|------|--------------|-----------|------------------|
| ... | ... | ... | ... | ... |

#### **Financial Security Recommendations**
1. [Critical Payment Security Fixes]
2. [Permission System Strengthening]
3. [Plan Limit Enforcement]
4. [Subscription Security Improvements]
5. [Financial Data Protection]

---

## 🚀 **Usage Instructions for AI Agents**

1. **Run this audit** after implementing any billing or payment functionality
2. **Verify permission checks** for all financial operations
3. **Check organization binding** for all subscription operations
4. **Validate plan limit enforcement** for all resource creation
5. **Test payment error scenarios** to ensure proper handling

This routine ensures **bank-grade financial security** and prevents unauthorized access, payment fraud, and financial data exposure in the billing system.