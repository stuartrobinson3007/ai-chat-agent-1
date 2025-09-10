# Email System Integration Audit Routine

This document provides a systematic quality assurance routine for AI agents to validate email system integration, template compliance, Better Auth email integration, and email security patterns.

## 🎯 **Purpose**

This routine ensures that all email functionality follows established patterns, uses React Email templates correctly, integrates properly with Better Auth, maintains translation support, and handles email failures gracefully.

## 🔍 **Critical Audit Checks**

### **❌ Find Manual HTML Email Creation**
```bash
# Find manual HTML email construction (VIOLATION)
rg "html.*=.*<html|emailHtml.*=|innerHTML.*email" --type ts src/

# Should return ZERO - use React Email templates only
```

### **✅ Required React Email Pattern**
```typescript
// REQUIRED: React Email template usage
import { Html, Body, Container, Button } from '@react-email/components'

export default function EmailTemplate({ props }) {
  return (
    <Html>
      <Body>
        <Container>
          <Button href={url}>Action</Button>
        </Container>
      </Body>
    </Html>
  )
}
```

### **❌ Find Missing Better Auth Integration**
```bash
# Find email sending without Better Auth integration
rg "sendEmail|resend\.emails\.send" --type ts src/ -B 5 | rg -v "betterAuth.*sendMagicLink|betterAuth.*sendInvitationEmail"

# Email functions should integrate with Better Auth plugins
```

### **❌ Find Hardcoded Email Content**
```bash
# Find untranslatable email content  
rg "subject.*['\"].*[A-Z]|text.*['\"].*[A-Z]" --type tsx src/emails/ | rg -v "getTranslation|t\("

# Email content should be translatable
```

### **✅ Required Email Translation**
```typescript
// REQUIRED: Translatable email content
function getTranslation(key: string, params?: any): string {
  try {
    const i18n = require('@/i18n/config').default
    return i18n.t(`email:${key}`, params, { lng: 'en' })
  } catch {
    return fallbackContent[key]
  }
}
```

## 📋 **Report Template**
- **React Email Usage**: X/X templates compliant
- **Better Auth Integration**: X/X emails integrated
- **Translation Support**: X/X emails translatable
- **Error Handling**: X/X emails handle failures gracefully