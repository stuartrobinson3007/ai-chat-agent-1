# Billing Security Audit Routine

This document provides a systematic quality assurance routine for AI agents to validate billing system security, payment processing protection, and Stripe integration security patterns.

## 🎯 **Purpose**

This routine ensures that all billing code follows payment security best practices, implements proper permission checks, maintains plan limit enforcement, and prevents financial fraud or unauthorized access to billing operations.

## 🔍 **Critical Audit Checks**

### **❌ Find Billing Operations Without Permission Checks**
```bash
# Find billing operations missing permission verification
rg "createServerFn.*method.*POST" -A 15 --type ts src/features/billing/ | rg "stripe|billing|payment|subscription" -B 5 | rg -v "checkPermission.*billing.*manage"

# Should return ZERO - only owners/admins can manage billing
```

### **✅ Required Billing Permission Pattern**
```typescript
// REQUIRED: Billing permission check
export const billingAction = createServerFn({ method: 'POST' })
  .middleware([organizationMiddleware])
  .handler(async ({ context }) => {
    await checkPermission('billing', ['manage'], context.organizationId)
    // Safe to proceed with billing operations
  })
```

### **❌ Find Plan Limit Bypass**
```bash
# Find resource creation without limit checks
rg "db\.insert.*todos|db\.insert.*members" --type ts src/ -B 10 | rg -v "checkPlanLimit|planLimit"

# Resource creation should check plan limits first
```

### **❌ Find Unsafe Stripe Integration**
```bash
# Find custom Stripe implementations (should use Better Auth)
rg "stripe\.checkout\.|stripe\.subscriptions\.|stripe\.customers\." --type ts src/ | rg -v "better-auth"

# Should use Better Auth Stripe plugin exclusively

# Find hardcoded Stripe keys
rg "sk_test|sk_live|pk_test|pk_live" --type ts src/

# Should return ZERO - use environment variables only
```

### **✅ Required Stripe Security**
```typescript
// REQUIRED: Use Better Auth Stripe plugin
await auth.api.upgradeSubscription({
  body: { plan: 'pro', referenceId: organizationId },
  headers: context.headers,
})
```

## 📋 **Report Template**
- **Permission Verification**: X/X billing operations protected
- **Plan Limit Enforcement**: X/X resource operations checked
- **Stripe Integration**: ✅/❌ Using Better Auth exclusively  
- **Financial Data Protection**: ✅/❌ Properly secured