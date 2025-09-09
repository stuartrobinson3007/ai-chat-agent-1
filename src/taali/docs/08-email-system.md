# Email System Implementation Guide

This document provides comprehensive guidance for implementing transactional emails using React Email with Resend delivery, including template patterns, Better Auth integration, and translation support.

## 🚨 Critical Rules

- **ALWAYS use React Email templates** - Never create HTML emails manually
- **MUST include translation support** - All email content must be translatable
- **NEVER bypass email validation** - Validate all email addresses and content
- **ALWAYS handle email failures gracefully** - Log failures but don't break user flows
- **MUST use established email types** - Follow Better Auth integration patterns

## ❌ Common AI Agent Mistakes

### Email Template Violations
```typescript
// ❌ NEVER create HTML emails manually
const htmlEmail = `<html><body>Welcome!</body></html>` // Wrong

// ❌ NEVER skip React Email wrapper
const BadEmail = ({ url }: { url: string }) => (
  <div>Click <a href={url}>here</a></div> // Missing React Email components
)

// ✅ ALWAYS use React Email components
import { Html, Body, Container, Button } from '@react-email/components'

const GoodEmail = ({ url }: { url: string }) => (
  <Html>
    <Body>
      <Container>
        <Button href={url}>Click Here</Button>
      </Container>
    </Body>
  </Html>
)
```

### Email Service Integration Violations
```typescript
// ❌ NEVER create custom email sending logic
const sendCustomEmail = async (to: string, html: string) => {
  // Custom SMTP logic - wrong approach
}

// ❌ NEVER skip error handling
await resend.emails.send({ to, subject, react }) // Missing try/catch

// ✅ ALWAYS use established email service pattern
import { sendEmail } from '@/lib/utils/email'

await sendEmail({
  to: email,
  subject: 'Subject',
  react: <EmailTemplate />,
})
```

### Translation Integration Violations
```typescript
// ❌ NEVER hardcode email content
const InviteEmail = ({ organizationName }: { organizationName: string }) => (
  <Html>
    <Body>
      <Text>Welcome to {organizationName}</Text> {/* Not translatable */}
    </Body>
  </Html>
)

// ✅ ALWAYS use translation functions in emails
const InviteEmail = ({ organizationName }: { organizationName: string }) => {
  const getTranslation = (key: string, params?: any) => {
    try {
      const i18n = require('@/i18n/config').default
      return i18n.t(`email:invitation.${key}`, params, { lng: 'en' })
    } catch {
      return fallbackContent[key]
    }
  }

  return (
    <Html>
      <Body>
        <Text>{getTranslation('welcome', { organizationName })}</Text>
      </Body>
    </Html>
  )
}
```

## ✅ Established Patterns

### 1. **Email Service Configuration**
```typescript
// File: src/lib/utils/email.ts
import { Resend } from 'resend'
import { ReactElement } from 'react'

import emailTranslations from '@/i18n/locales/en/email.json'
import MagicLinkEmail from '@/emails/magic-link-email'
import InvitationEmail from '@/emails/invitation-email'
import OTPEmail from '@/emails/otp-email'

const resend = new Resend(process.env.RESEND_API_KEY!)

interface SendEmailOptions {
  to: string | string[]
  subject: string
  react: ReactElement
  from?: string
}

export async function sendEmail({
  to,
  subject,
  react,
  from = process.env.EMAIL_FROM!,
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
      error: error instanceof Error ? error.message : 'Failed to send email',
    }
  }
}

// Specific email functions for Better Auth integration
export async function sendMagicLinkEmail(email: string, url: string) {
  return sendEmail({
    to: email,
    subject: emailTranslations.magicLink.title,
    react: MagicLinkEmail({ url }),
  })
}

export async function sendInvitationEmail(
  email: string,
  inviterName: string,
  organizationName: string,
  url: string
) {
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
}

export async function sendOTPEmail(
  email: string,
  otp: string,
  type: 'sign-in' | 'email-verification' | 'forget-password'
) {
  const getSubject = () => {
    switch (type) {
      case 'sign-in':
        return emailTranslations.otp.signIn.subject
      case 'email-verification':
        return emailTranslations.otp.emailVerification.subject
      case 'forget-password':
        return emailTranslations.otp.forgetPassword.subject
      default:
        return emailTranslations.otp.default.subject
    }
  }

  return sendEmail({
    to: email,
    subject: getSubject(),
    react: OTPEmail({ otp, type }),
  })
}
```

### 2. **Invitation Email Template**
```typescript
// File: src/emails/invitation-email.tsx
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
  Link,
  Tailwind,
} from '@react-email/components'

interface InvitationEmailProps {
  inviterName: string
  organizationName: string
  url: string
  language?: string
  appName?: string
}

// Fallback content for preview mode
const fallbackContent = {
  preview: 'Invitation to join {{organizationName}}',
  workspaceInvitation: 'Workspace Invitation',
  welcome: 'Welcome to {{organizationName}}',
  greeting: 'Hi there,',
  message: '{{inviterName}} has invited you to join {{organizationName}} on Todo App.',
  description: "You'll be joining a collaborative workspace where teams create, share, and manage projects together.",
  acceptButton: 'Accept Invitation',
  accessTitle: "What you'll get access to:",
  access: {
    collaborate: '• Collaborate with {{inviterName}} and the team',
    projects: '• Access to workspace projects and resources',
    communication: '• Real-time communication and file sharing',
  },
  expiry: 'This invitation expires in 48 hours.',
  orCopy: "If the button doesn't work, copy and paste this link:",
  questions: 'Questions about this invitation? Reply to this email or contact {{inviterName}} directly.',
  footer: "If you weren't expecting this invitation, you can safely ignore this email.",
  copyright: '© {{year}} {{appName}}. All rights reserved.',
}

function getTranslation(key: string, params?: any): string {
  try {
    // Try to import and use i18n
    const i18n = require('@/i18n/config').default
    return i18n.t(`email:invitation.${key}`, params, { lng: 'en' })
  } catch {
    // Fallback for preview mode
    let text = key.split('.').reduce((obj, k) => obj?.[k], fallbackContent as any) || key

    if (typeof text === 'string' && params) {
      // Simple template replacement for fallback
      Object.entries(params).forEach(([paramKey, value]) => {
        text = text.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(value))
      })
    }

    return text
  }
}

export default function InvitationEmail({
  inviterName,
  organizationName,
  url,
  appName = 'Todo App',
}: InvitationEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>{getTranslation('preview', { organizationName })}</Preview>
        <Body className="bg-gray-100 font-sans py-[40px]">
          <Container className="bg-white rounded-[8px] px-[32px] py-[40px] max-w-[600px] mx-auto">
            {/* Header */}
            <Section className="text-center mb-[32px]">
              <Text className="text-[14px] text-green-600 font-semibold m-0 mb-[8px] uppercase tracking-wide">
                {getTranslation('workspaceInvitation')}
              </Text>
              <Heading className="text-[32px] font-bold text-gray-900 m-0">
                {getTranslation('welcome', { organizationName })}
              </Heading>
            </Section>

            {/* Personal Invitation */}
            <Section className="mb-[32px]">
              <Text className="text-[18px] text-gray-700 mb-[16px] leading-[26px]">
                {getTranslation('greeting')}
              </Text>

              <Text className="text-[16px] text-gray-700 mb-[20px] leading-[24px]">
                {getTranslation('message', { inviterName, organizationName })}
              </Text>

              <Text className="text-[16px] text-gray-700 mb-[24px] leading-[24px]">
                {getTranslation('description')}
              </Text>

              {/* Primary CTA */}
              <Section className="text-center mb-[32px]">
                <Button
                  href={url}
                  className="bg-green-600 text-white px-[40px] py-[16px] rounded-[8px] text-[16px] font-semibold no-underline box-border inline-block"
                >
                  {getTranslation('acceptButton')}
                </Button>
              </Section>

              {/* What to Expect */}
              <Section className="bg-green-50 rounded-[8px] p-[24px] mb-[24px]">
                <Heading className="text-[18px] font-bold text-gray-900 mb-[12px] m-0">
                  {getTranslation('accessTitle')}
                </Heading>
                <Text className="text-[14px] text-gray-700 m-0 mb-[8px]">
                  {getTranslation('access.collaborate', { inviterName })}
                </Text>
                <Text className="text-[14px] text-gray-700 m-0 mb-[8px]">
                  {getTranslation('access.projects')}
                </Text>
                <Text className="text-[14px] text-gray-700 m-0">
                  {getTranslation('access.communication')}
                </Text>
              </Section>

              {/* Urgency */}
              <Section className="bg-orange-50 border-l-[4px] border-orange-400 pl-[16px] py-[12px] mb-[24px]">
                <Text className="text-[14px] text-orange-700 m-0">{getTranslation('expiry')}</Text>
              </Section>

              {/* Fallback Link */}
              <Text className="text-[14px] text-gray-600 mb-[12px]">
                {getTranslation('orCopy')}
              </Text>

              <Section className="bg-gray-50 rounded-[4px] p-[12px] mb-[24px]">
                <Link href={url} className="text-[14px] text-green-600 break-all">
                  {url}
                </Link>
              </Section>

              {/* Security Note */}
              <Text className="text-[14px] text-gray-600 leading-[20px]">
                {getTranslation('questions', { inviterName })} {getTranslation('footer')}
              </Text>
            </Section>

            {/* Footer */}
            <Section className="border-t border-gray-200 pt-[24px] text-center">
              <Text className="text-[12px] text-gray-500 m-0">
                {getTranslation('copyright', { year: new Date().getFullYear(), appName })}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

// Preview props for development
InvitationEmail.PreviewProps = {
  appName: 'Todo App',
  organizationName: "John's Workspace",
  inviterName: 'John Doe',
  url: 'https://app.example.com/invite/accept?token=abc123def456',
  language: 'en',
}
```

### 3. **Email Development Setup**
```bash
# Preview emails during development
npm run email:dev

# This starts a preview server at http://localhost:3000
# showing all email templates with preview data
```

## 🎯 Integration Requirements

### With Better Auth
```typescript
// Email integration in Better Auth configuration
import { sendMagicLinkEmail, sendInvitationEmail, sendOTPEmail } from '@/lib/utils/email'

export const auth = betterAuth({
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
      disableSignUp: false,
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

### With Environment Configuration
```bash
# Required environment variables
RESEND_API_KEY=re_your_api_key
EMAIL_FROM="Todo App <noreply@yourdomain.com>"
```

## 🧪 Testing Requirements

### Email Template Testing
```typescript
// Testing email templates
import { render } from '@react-email/render'
import InvitationEmail from '@/emails/invitation-email'

describe('InvitationEmail', () => {
  it('should render with all required content', () => {
    const html = render(
      <InvitationEmail
        inviterName="John Doe"
        organizationName="Test Org"
        url="https://example.com/invite/123"
      />
    )

    expect(html).toContain('John Doe')
    expect(html).toContain('Test Org')
    expect(html).toContain('https://example.com/invite/123')
  })
})
```

This email system provides a robust foundation for transactional emails with comprehensive translation support and seamless Better Auth integration.