# Email System Comprehensive Integration Audit Routine

This document provides a systematic quality assurance routine for AI agents to validate email system integration, template compliance, Better Auth email patterns, translation support, and email security in the TanStack SaaS starter template.

## 🎯 **Purpose**

This routine ensures that all email functionality follows established patterns, uses React Email templates correctly, integrates properly with Better Auth email flows, maintains complete translation support, and handles email delivery failures gracefully.

## 📋 **Pre-Audit Checklist**

Before beginning the audit, ensure:
- [ ] Email documentation (`08-email-system.md`) is current
- [ ] Understanding of React Email and Better Auth email integration
- [ ] Access to all email templates, delivery functions, and email-related code

## 🔍 **Phase 1: Email System Discovery**

### **1.1 Find All Email-Related Files**

Run these commands to discover all email code:

```bash
# Find all email template files
find src/emails/ -name "*.tsx" -type f

# Find email delivery functions
rg "sendEmail|resend|email.*send" --type ts src/lib/utils/email.ts -l

# Find Better Auth email integration
rg "sendMagicLink|sendInvitationEmail|sendOTPEmail" --type ts src/ -l

# Find email configuration
rg "RESEND_API_KEY|EMAIL_FROM|SMTP" --type ts src/ -l

# Find email preview setup
rg "PreviewProps|email.*dev" --type ts --type tsx src/ -l
```

### **1.2 Categorize by Email Type**

Create email lists by category:
- **Authentication Emails**: Magic link, OTP, password reset
- **Invitation Emails**: Team member invitations, organization invites
- **Notification Emails**: System notifications, alerts, updates
- **Transactional Emails**: Billing receipts, subscription changes
- **Marketing Emails**: Announcements, feature updates (if applicable)

## 📧 **Phase 2: React Email Template Compliance**

### **2.1 Template Architecture Verification**

#### **❌ CRITICAL: Find manual HTML email creation**
```bash
# Find manual HTML email construction (VIOLATION)
rg "html.*=.*<html|emailHtml.*=.*<|innerHTML.*email|template.*string" --type ts src/

# Should return ZERO - use React Email templates exclusively

# Find emails without React Email components
rg "email.*component|Email.*function" --type tsx src/emails/ -A 10 | rg -v "Html.*Body.*Container|@react-email"

# Email templates should use React Email components
```

#### **✅ Required React Email Patterns:**
```typescript
// REQUIRED: React Email template structure
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Section,
  Tailwind,
} from '@react-email/components'

export default function EmailTemplate({ props }: EmailTemplateProps) {
  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>Email preview text</Preview>
        <Body className="bg-gray-100 font-sans">
          <Container className="max-w-[600px] mx-auto">
            {/* Email content */}
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

// REQUIRED: Preview props for development
EmailTemplate.PreviewProps = {
  // Sample data for email preview
}
```

### **2.2 Template Security Verification**

#### **❌ CRITICAL: Find unsafe email content**
```bash
# Find potential XSS vulnerabilities in email templates
rg "dangerouslySetInnerHTML|innerHTML.*\{" --type tsx src/emails/

# Should return ZERO - React Email handles safe rendering

# Find unescaped user content in emails
rg "\{.*user\.|data\.|props\." --type tsx src/emails/ -B 2 -A 2 | rg -v "escape|sanitize|getTranslation"

# User data in emails should be properly escaped
```

## 🔐 **Phase 3: Better Auth Email Integration**

### **3.1 Email Plugin Integration Verification**

#### **❌ CRITICAL: Find email functions bypassing Better Auth**
```bash
# Find email sending not using Better Auth integration
rg "resend\.emails\.send|smtp\.send|nodemailer" --type ts src/ | rg -v "lib/utils/email\.ts"

# Email sending should go through centralized email utility

# Find Better Auth email config missing functions
rg "magicLink.*sendMagicLink|emailOTP.*sendVerificationOTP|organization.*sendInvitationEmail" --type ts src/lib/auth/auth.ts -A 5 | rg -v "sendMagicLinkEmail|sendOTPEmail|sendInvitationEmail"

# Better Auth plugins should reference proper email functions
```

#### **✅ Required Better Auth Integration:**
```typescript
// REQUIRED: Better Auth email plugin configuration
betterAuth({
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url) // Centralized function
      },
      expiresIn: 60 * 5,
    }),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        await sendOTPEmail(email, otp, type) // Centralized function
      },
    }),
    organization({
      sendInvitationEmail: async data => {
        const inviteUrl = `${process.env.BETTER_AUTH_URL}/invite/${data.id}`
        await sendInvitationEmail(
          data.email,
          data.inviter?.user?.name || 'A team member',
          data.organization.name,
          inviteUrl
        )
      },
    }),
  ],
})
```

### **3.2 Email Delivery Security**

#### **❌ CRITICAL: Find email delivery without error handling**
```bash
# Find email sending without proper error handling
rg "sendEmail|resend\.emails\.send" --type ts src/ -A 5 -B 5 | rg -v "try.*catch|\.catch\(|error"

# Email sending should handle delivery failures gracefully

# Find email functions that might break user flows on failure
rg "await.*sendEmail.*\n.*return|await.*send.*Email.*return" --type ts src/ -B 2 -A 2

# Email failures should not break main user flows
```

#### **✅ Required Email Error Handling:**
```typescript
// REQUIRED: Graceful email error handling
export async function sendInvitationEmail(
  email: string,
  inviterName: string, 
  organizationName: string,
  url: string
) {
  try {
    const result = await sendEmail({
      to: email,
      subject: `${inviterName} invited you to join ${organizationName}`,
      react: InvitationEmail({ inviterName, organizationName, url }),
    })
    
    if (result.success) {
      console.log('✅ Invitation email sent successfully')
    } else {
      console.error('❌ Failed to send invitation email:', result.error)
    }
    
    return result
  } catch (error) {
    // Log error but don't break the invitation flow
    console.error('Email delivery failed:', error)
    return { success: false, error: 'Email delivery failed' }
  }
}
```

## 🌐 **Phase 4: Email Translation Security**

### **4.1 Translation Completeness Verification**

#### **❌ CRITICAL: Find hardcoded email content**
```bash
# Find untranslatable email content
rg "subject.*['\"].*[A-Z]|<Text>.*[A-Z]|<Heading>.*[A-Z]" --type tsx src/emails/ | rg -v "getTranslation|t\("

# All email content should be translatable

# Find email templates without translation function
rg "export.*function.*Email" --type tsx src/emails/ -A 20 | rg -v "getTranslation|fallbackContent"

# Email templates should have translation support
```

#### **✅ Required Email Translation Patterns:**
```typescript
// REQUIRED: Email translation function
const fallbackContent = {
  welcome: 'Welcome to {{organizationName}}',
  message: '{{inviterName}} has invited you to join {{organizationName}}',
}

function getTranslation(key: string, params?: any): string {
  try {
    const i18n = require('@/i18n/config').default
    return i18n.t(`email:invitation.${key}`, params, { lng: 'en' })
  } catch {
    let text = fallbackContent[key] || key
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(v))
      })
    }
    return text
  }
}
```

### **4.2 Email Content Security**

#### **❌ CRITICAL: Find email XSS vulnerabilities**
```bash
# Find potential XSS in email content
rg "dangerouslySetInnerHTML|innerHTML" --type tsx src/emails/

# Should return ZERO - React Email handles safe rendering

# Find unescaped user data in emails
rg "\{.*user\.|props\.|data\." --type tsx src/emails/ -B 2 -A 2 | rg -v "getTranslation.*\{.*\}"

# User data should go through translation system for safety
```

## 📤 **Phase 5: Email Service Integration**

### **5.1 Email Provider Security**

#### **❌ CRITICAL: Find email provider configuration issues**
```bash
# Find email provider credentials exposure
rg "RESEND_API_KEY|SMTP_PASSWORD|EMAIL_.*_SECRET" --type ts src/ | rg -v "process\.env\."

# Should return ZERO - credentials should come from environment only

# Find email sending without proper authentication
rg "resend.*new|Resend\(" --type ts src/ -B 2 -A 5 | rg -v "process\.env\.RESEND_API_KEY"

# Email service should use proper API key from environment
```

#### **✅ Required Email Service Security:**
```typescript
// REQUIRED: Secure email service configuration
const resend = new Resend(process.env.RESEND_API_KEY!) // From environment only

export async function sendEmail({
  to,
  subject,
  react,
  from = process.env.EMAIL_FROM!, // From environment only
}: SendEmailOptions) {
  try {
    const result = await resend.emails.send({
      from,
      to,
      subject,
      react,
    })
    
    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to send email:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send email' 
    }
  }
}
```

## 🧪 **Phase 6: Email Testing Verification**

### **6.1 Email Integration Test Coverage**

Check that email scenarios are tested:

```bash
# Find email template tests
rg "describe.*email.*template|it.*should.*render.*email" --type ts src/

# Should cover: template rendering, translation, preview generation

# Find email delivery tests
rg "describe.*email.*delivery|it.*should.*send.*email" --type ts src/

# Should cover: delivery success, failure handling, retry logic
```

## 📋 **Email System Report Template**

### **Email System Integration Audit Report**

**Date**: [Audit Date]  
**Auditor**: [AI Agent ID]
**Scope**: [Email Components Audited]

#### **Template Compliance**
- **React Email Usage**: X/X templates using React Email components
- **Template Security**: ✅/❌ No unsafe HTML injection
- **Preview Configuration**: X/X templates have preview props
- **Component Architecture**: ✅/❌ Proper component structure

#### **Better Auth Integration**
- **Email Plugin Configuration**: ✅/❌ All required plugins configured
- **Email Function Mapping**: X/X plugins reference correct functions
- **Authentication Flow**: ✅/❌ Proper email-auth integration
- **Delivery Error Handling**: ✅/❌ Graceful failure handling

#### **Translation Support**
- **Content Translation**: X/X templates translatable
- **Translation Function**: X/X templates have translation support
- **Fallback Content**: X/X templates have fallbacks
- **Multi-Language**: ✅/❌ Supporting multiple languages

#### **Email Service Security**
- **Provider Configuration**: ✅/❌ Secure credential handling
- **API Key Security**: ✅/❌ Environment variable usage
- **Delivery Monitoring**: ✅/❌ Proper error logging
- **Rate Limiting**: ✅/❌ Preventing abuse

#### **Critical Email Security Issues**
| File | Line | Issue | Risk Level | Impact |
|------|------|-------|-----------|--------|
| ... | ... | ... | ... | ... |

#### **Email System Recommendations**
1. [Template Security Improvements]
2. [Better Auth Integration Fixes]
3. [Translation Completeness]
4. [Delivery Error Handling]

---

## 🚀 **Usage Instructions for AI Agents**

1. **Run this audit** after implementing any email functionality
2. **Verify React Email compliance** for all email templates
3. **Check Better Auth integration** for authentication emails
4. **Validate translation support** for all email content
5. **Test email delivery scenarios** including failure cases

This routine ensures **reliable and secure email communication** with proper template structure, authentication integration, and comprehensive error handling.