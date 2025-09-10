# UI Component Standards Audit Routine

This document provides a systematic quality assurance routine for AI agents to validate UI component consistency, design system compliance, and accessibility standards across the TanStack SaaS starter template.

## 🎯 **Purpose**

This routine ensures that all UI components written by AI agents follow the established Taali UI design system, maintain consistent import patterns, implement proper accessibility features, and adhere to modern React component architecture standards.

## 📋 **Pre-Audit Checklist**

Before beginning the audit, ensure:
- [ ] UI component documentation (`05-ui-component-library.md`) is current
- [ ] Understanding of Taali UI component architecture
- [ ] Access to all component files and styling patterns

## 🔍 **Phase 1: Component Architecture Discovery**

### **1.1 Find All UI Components**

Run these commands to discover all component files:

```bash
# Find all component files
rg "export.*function.*Component|export.*const.*=" --type tsx src/components/ -l

# Find all UI component files
find src/components/taali-ui/ui/ -name "*.tsx" -type f

# Find custom component files
find src/components/ -name "*.tsx" -type f | grep -v taali-ui

# Find all component imports
rg "import.*from.*@/ui/|import.*from.*@/components/" --type tsx src/ -l
```

### **1.2 Categorize Component Types**

Create component lists by category:
- **Taali UI Base Components**: Button, Input, Card, Dialog, etc.
- **Composite Components**: DataTable, FormField, etc.
- **Application Components**: PageHeader, ErrorBoundary, etc.
- **Feature Components**: TodoForm, BillingCard, etc.

## 🎨 **Phase 2: Import Path Consistency Audit**

### **2.1 Import Pattern Violations**

#### **❌ CRITICAL: Find incorrect import paths**
```bash
# Find components using wrong import paths
rg "import.*from.*\.\./\.\./\.\./components|import.*from.*src/components" --type tsx src/

# Should return ZERO results - all should use @/ alias

# Find UI components using wrong import paths  
rg "import.*from.*\.\./\.\./.*ui/|import.*from.*components/taali-ui/ui" --type tsx src/

# Should return ZERO results - all should use @/ui/ alias
```

#### **✅ Required Import Patterns:**
```typescript
// REQUIRED: UI components use @/ui alias
import { Button } from '@/ui/button'
import { Card, CardHeader, CardContent } from '@/ui/card'

// REQUIRED: Application components use @/ alias
import { PageHeader } from '@/components/page-header'
import { ErrorBoundary } from '@/components/error-boundary'
```

### **2.2 Import Consistency Verification**

#### **✅ Consistent Import Grouping:**
```bash
# Check import organization
rg "import.*from.*@/ui.*\n.*import.*from.*@/components" --type tsx src/ -U

# UI imports should be grouped together, followed by application imports
```

## 🚨 **Phase 2.5: Raw HTML Element Detection**

### **2.5.1 Form Element Compliance**

#### **❌ CRITICAL: Find raw HTML form elements instead of taali-ui components**
```bash
# Find raw button elements instead of Button component
rg "<button[^>]*(?!.*component.*Button)" --type tsx src/ -n

# Find raw input elements instead of Input component  
rg "<input[^>]*(?!.*Input.*from)" --type tsx src/ -n

# Find raw textarea elements instead of Textarea component
rg "<textarea[^>]*(?!.*Textarea.*from)" --type tsx src/ -n

# Find raw label elements instead of Label component
rg "<label[^>]*(?!.*Label.*from)" --type tsx src/ -n

# Find raw select elements instead of Select component
rg "<select[^>]*(?!.*Select.*from)" --type tsx src/ -n

# Find manual form styling instead of form components
rg "className.*\bbutton\b|className.*\binput\b" --type tsx src/ | rg -v "Button|Input"
```

#### **❌ CRITICAL: Check specific known violation files**
```bash
# Check magic-link component for raw HTML elements
rg "<button|<input|<label" src/features/auth/components/magic-link-sign-in.tsx -n

# Check profile page for raw input elements
rg "<input|<label" src/routes/_authenticated/profile.tsx -n

# Check team page for raw input elements  
rg "<input|<label" src/routes/_authenticated/team.tsx -n

# Check onboarding form for raw input elements
rg "<input|<label" src/features/auth/components/onboarding-form.tsx -n
```

### **2.5.2 Interactive Element Standards**

#### **❌ CRITICAL: Find interactive elements with manual styling**
```bash
# Find clickable elements not using Button component
rg "onClick.*=.*\{" --type tsx src/ -B 2 -A 2 | rg "<div|<span|<a" | rg -v "Button|Link"

# Find form submissions not using proper form structure
rg "onSubmit.*=.*\{" --type tsx src/ -B 5 -A 5 | rg -v "Form.*from.*@/ui/form"
```

#### **✅ Required taali-ui Component Patterns:**
```typescript
// REQUIRED: Use taali-ui components instead of raw HTML elements

// Import proper components
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Textarea } from '@/ui/textarea'
import { Label } from '@/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'

// Use components, not raw HTML
<Button variant="default" size="md" onClick={handleClick}>
  Click me
</Button>

<div className="space-y-2">
  <Label htmlFor="email">Email Address</Label>
  <Input 
    id="email"
    type="email" 
    value={email} 
    onChange={e => setEmail(e.target.value)}
    placeholder="Enter your email"
  />
</div>

<div className="space-y-2">
  <Label htmlFor="description">Description</Label>
  <Textarea
    id="description"
    value={description}
    onChange={e => setDescription(e.target.value)}
    placeholder="Enter description"
    rows={4}
  />
</div>

// NEVER use raw HTML elements like:
// <button className="...">  ❌
// <input className="...">   ❌
// <textarea className="..."> ❌
// <label className="...">   ❌
```

### **2.5.3 Component Consistency Verification**

#### **❌ CRITICAL: Mixed component usage patterns**
```bash
# Find files mixing raw HTML with taali-ui components
rg -l "import.*from.*@/ui/" --type tsx src/ | xargs -I {} sh -c 'echo "=== {} ===" && rg "<button|<input|<textarea|<label|<select" {}'

# This identifies files that import taali-ui components but still use raw HTML
```

## 🔧 **Phase 2.6: Redundant SVG Styling Detection**

### **2.6.1 Components with Automatic SVG Styling**

These taali-ui components automatically style SVG icons and **should not** have manual styling added:

#### **Button Component**
- **Automatic styles**: `[&_svg:not([class*='size-'])]:size-4` + `gap-2` + `shrink-0` + `pointer-events-none`
- **Redundant styles to avoid**: `w-4 h-4`, `size-4`, `mr-2`, `ml-2`, `shrink-0`

#### **Badge Component**
- **Automatic styles**: `[&>svg]:size-3` + `gap-1` + `pointer-events-none`
- **Redundant styles to avoid**: `w-3 h-3`, `size-3`, `mr-1`, `ml-1`

#### **DropdownMenuItem Component**
- **Automatic styles**: `[&_svg:not([class*='size-'])]:size-4` + `gap-2` + `shrink-0` + `pointer-events-none`
- **Redundant styles to avoid**: `w-4 h-4`, `size-4`, `mr-2`, `ml-2`, `shrink-0`

#### **DropdownMenuSubTrigger Component**
- **Automatic styles**: `[&_svg:not([class*='size-'])]:size-4` + `gap-2` + `shrink-0` + `pointer-events-none`
- **Redundant styles to avoid**: `w-4 h-4`, `size-4`, `mr-2`, `ml-2`, `shrink-0`

#### **Select Component**
- **Automatic styles**: `[&_svg:not([class*='size-'])]:size-4` + `gap-2` + `shrink-0` + `pointer-events-none`
- **Redundant styles to avoid**: `w-4 h-4`, `size-4`, `mr-2`, `ml-2`

#### **Command Components**
- **CommandItem**: `[&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5` (size-5)
- **Redundant styles to avoid**: `w-5 h-5`, `size-5`

#### **Toggle Component**
- **Automatic styles**: `[&_svg:not([class*='size-'])]:size-4` + `gap-2` + `shrink-0`
- **Redundant styles to avoid**: `w-4 h-4`, `size-4`, `mr-2`, `ml-2`

### **2.6.2 Critical Redundant SVG Styling Checks**

#### **❌ CRITICAL: Find redundant sizing in Button components**
```bash
# Find icons with redundant size classes inside Button components
rg "<Button[^>]*>.*<[^>]*Icon[^>]*className.*['\"].*(?:w-4.*h-4|size-4)" --type tsx src/ -U

# Find Button content with manual icon spacing
rg "<Button[^>]*>.*<[^>]*Icon[^>]*className.*['\"].*(?:mr-2|ml-2)" --type tsx src/ -U

# Alternative approach - find files with Button and then check for redundant icon styling
rg -l "from.*@/ui/button" --type tsx src/ | xargs -I {} rg "<.*Icon.*className.*(?:size-4|w-4.*h-4|mr-2)" {}
```

#### **❌ CRITICAL: Find redundant styling in DropdownMenuItem components**
```bash
# Find redundant icon styling in dropdown menu items
rg "<DropdownMenuItem[^>]*>.*<[^>]*Icon[^>]*className.*['\"].*(?:size-4.*mr-2|w-4.*h-4.*mr-2)" --type tsx src/ -U

# Find redundant icon styling in dropdown menu sub triggers
rg "<DropdownMenuSubTrigger[^>]*>.*<[^>]*Icon[^>]*className.*['\"].*(?:size-4.*mr-2|w-4.*h-4.*mr-2)" --type tsx src/ -U

# Find specific pattern we discovered
rg "className.*size-4.*mr-2|className.*w-4.*h-4.*mr-2" --type tsx src/ -n

# Check files using DropdownMenuItem and DropdownMenuSubTrigger for redundant icon classes
rg -l "DropdownMenuItem|DropdownMenuSubTrigger" --type tsx src/ | xargs -I {} rg "<.*Icon.*className.*(?:size-4.*mr-2|w-4.*h-4.*mr-2)" {}
```

#### **❌ CRITICAL: Find redundant styling in Badge components**
```bash
# Find redundant badge icon styling
rg "<Badge[^>]*>.*<[^>]*Icon[^>]*className.*['\"].*(?:w-3.*h-3|size-3)" --type tsx src/ -U

# Find Badge with manual icon spacing (should use gap-1 automatically)
rg "<Badge[^>]*>.*<[^>]*Icon[^>]*className.*['\"].*(?:mr-1|ml-1)" --type tsx src/ -U
```

#### **❌ CRITICAL: Find redundant styling in Select components**
```bash
# Find redundant select trigger icon styling
rg "<SelectTrigger[^>]*>.*<[^>]*Icon[^>]*className.*['\"].*(?:size-4|w-4.*h-4)" --type tsx src/ -U
rg "<SelectItem[^>]*>.*<[^>]*Icon[^>]*className.*['\"].*(?:size-4|w-4.*h-4)" --type tsx src/ -U
```

### **2.6.3 Advanced Pattern Detection**

#### **❌ CRITICAL: Multi-line component patterns**
```bash
# Find multi-line Button with redundant icon styling
rg -U "(?s)<Button[^>]*>.*?<[^>]*Icon[^>]*className.*?(?:size-4|w-4.*h-4|mr-2).*?</Button>" --type tsx src/

# Find multi-line DropdownMenuItem patterns
rg -U "(?s)<DropdownMenuItem[^>]*>.*?<[^>]*Icon[^>]*className.*?(?:size-4.*mr-2).*?</DropdownMenuItem>" --type tsx src/
```

### **2.6.4 Positive Patterns (What Should Be Used)**

#### **✅ Required SVG Usage Patterns:**
```typescript
// CORRECT: Let Button handle SVG styling automatically
<Button>
  <PlusIcon />  {/* ✅ No size or spacing classes needed */}
  Add Item
</Button>

// CORRECT: Badge with automatic SVG styling  
<Badge>
  <CheckIcon />  {/* ✅ No size classes needed */}
  Verified
</Badge>

// CORRECT: DropdownMenuItem with automatic styling
<DropdownMenuItem>
  <SettingsIcon />  {/* ✅ No size or spacing classes needed */}
  Settings
</DropdownMenuItem>

// CORRECT: DropdownMenuSubTrigger with automatic styling
<DropdownMenuSubTrigger>
  <ThemeIcon />  {/* ✅ No size or spacing classes needed */}
  Theme
</DropdownMenuSubTrigger>

// INCORRECT: Redundant styling that components already provide
<Button>
  <PlusIcon className="w-4 h-4 mr-2" />  {/* ❌ Redundant - Button already handles this */}
  Add Item
</Button>

<DropdownMenuItem>
  <SettingsIcon className="size-4 mr-2 text-muted-foreground" />  {/* ❌ All redundant */}
  Settings  
</DropdownMenuItem>

<DropdownMenuSubTrigger>
  <ThemeIcon className="size-4 mr-2 text-muted-foreground" />  {/* ❌ All redundant */}
  Theme
</DropdownMenuSubTrigger>
```

## 🔄 **Phase 2.7: Button Loading State Consistency**

### **2.7.1 Custom Loading State Detection**

The Button component provides a built-in `loading` prop that automatically:
- Renders a `Loader2` spinner with `animate-spin` class
- Disables the button during loading state
- Positions the spinner correctly with the existing content

#### **❌ CRITICAL: Find buttons with custom loading implementations**
```bash
# Find buttons manually rendering Loader2 instead of using loading prop
rg "<Button[^>]*>.*\{.*\?.*<Loader2.*animate-spin" --type tsx src/ -U -n

# Find buttons with conditional Loader2 rendering
rg "Loader2.*className.*animate-spin.*\}.*:" --type tsx src/ -n

# Find buttons with manual loading state logic
rg "<Button[^>]*disabled.*loading.*>.*\{.*loading.*\?" --type tsx src/ -U -n

# Find buttons that should be using loading prop
rg -l "<Button" --type tsx src/ | xargs -I {} rg -l "Loader2.*animate-spin" {} | xargs -I {} rg "Button.*>.*\{.*\?.*Loader2" {} -n
```

#### **❌ CRITICAL: Find specific manual loading patterns**
```bash
# Find isLoading/isPending conditions with manual Loader2
rg "\{.*(?:isLoading|isPending|isSubmitting|isUploading).*\?.*<Loader2.*animate-spin" --type tsx src/ -n

# Find buttons with redundant disabled and loading logic
rg "<Button[^>]*disabled=\{[^}]*loading[^}]*\}[^>]*>" --type tsx src/ -n

# Find buttons that manually disable for loading but don't use loading prop
rg "<Button[^>]*disabled=\{[^}]*(?:isLoading|isPending|isSubmitting|isUploading)" --type tsx src/ | rg -v "loading=\{" -n
```

### **2.7.2 Loading State Anti-Pattern Examples**

#### **❌ WRONG: Manual loading state implementation**
```typescript
// Anti-pattern 1: Manual Loader2 rendering
<Button disabled={isLoading}>
  {isLoading ? (
    <>
      <Loader2 className="animate-spin" />
      {t('states.loading')}
    </>
  ) : (
    <>
      <PlusIcon />
      {t('actions.add')}
    </>
  )}
</Button>

// Anti-pattern 2: Redundant disabled logic
<Button disabled={isLoading || isDisabled} loading={isLoading}>
  {t('actions.submit')}
</Button>

// Anti-pattern 3: Manual spinner positioning
<Button disabled={isUploading}>
  {isUploading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
  {isUploading ? t('uploading') : t('upload')}
</Button>
```

#### **✅ CORRECT: Built-in loading prop usage**
```typescript
// Correct pattern 1: Simple loading state
<Button loading={isLoading}>
  <PlusIcon />
  {isLoading ? t('states.loading') : t('actions.add')}
</Button>

// Correct pattern 2: Loading overrides disabled automatically
<Button loading={isLoading} disabled={isDisabled}>
  {t('actions.submit')}
</Button>

// Correct pattern 3: Clean conditional text only
<Button loading={isUploading}>
  {isUploading ? t('uploading') : t('upload')}
</Button>
```

### **2.7.3 Button Loading State File-Specific Checks**

#### **❌ CRITICAL: Check known files with loading state issues**
```bash
# Check avatar upload dialog for manual loading states
rg "Button.*disabled.*loading.*>.*\{.*\?.*Loader2" src/components/avatar-upload-dialog.tsx -n

# Check billing page for manual loading implementations  
rg "Button.*>.*\{.*isPending.*\?.*Loader2" src/features/billing/components/billing-page.tsx -n

# Check auth components for manual loading states
rg "Button.*>.*\{.*isLoading.*\?.*Loader2" src/features/auth/components/ -n

# Check organization components for manual loading
rg "Button.*>.*\{.*isCreating.*\?.*Loader2" src/features/organization/components/ -n
```

### **2.7.4 Loading State Consistency Verification**

#### **❌ CRITICAL: Mixed loading implementation patterns**
```bash
# Find files that use both loading prop and manual Loader2
rg -l "loading=\{" --type tsx src/ | xargs -I {} rg "Loader2.*animate-spin" {} -l

# Find components with inconsistent button loading patterns
rg -l "Button.*loading=\{" --type tsx src/ | xargs -I {} sh -c 'echo "=== {} ===" && rg "Button.*>.*\{.*\?.*Loader2|Button.*disabled.*loading" {}'

# This identifies files mixing proper loading prop with manual implementations
```

### **2.7.5 Loading State Best Practices Enforcement**

#### **✅ Required Loading State Patterns:**
```typescript
// REQUIRED: Use loading prop for all button loading states
import { Button } from '@/ui/button'

// Simple loading button
<Button loading={isLoading}>
  {isLoading ? t('processing') : t('submit')}
</Button>

// Loading button with icon (icon shows when not loading)
<Button loading={isSubmitting}>
  {!isSubmitting && <SaveIcon />}
  {isSubmitting ? t('saving') : t('save')}
</Button>

// Loading button with additional disabled logic
<Button loading={isLoading} disabled={!isValid}>
  {t('submit')}
</Button>

// NEVER manually implement loading states
// ❌ Don't do: disabled={isLoading} with manual Loader2
// ❌ Don't do: Conditional Loader2 rendering inside Button
// ❌ Don't do: Manual spinner positioning or styling
```

## 🎨 **Phase 3: Styling Standards Audit**

### **3.1 CVA Pattern Compliance**

#### **❌ CRITICAL: Find components without CVA variants**
```bash
# Find custom components that should use CVA
rg "interface.*Props.*extends.*ComponentProps" -A 10 --type tsx src/components/ | rg -v "cva|VariantProps"

# Custom components should use class-variance-authority for variants
```

#### **✅ Required CVA Patterns:**
```typescript
// REQUIRED: CVA usage for custom components
import { cva, type VariantProps } from 'class-variance-authority'

const componentVariants = cva(
  "base-classes",
  {
    variants: {
      variant: { default: "default-styles" },
      size: { default: "default-size" },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

interface ComponentProps extends VariantProps<typeof componentVariants> {
  // Additional props
}
```

### **3.2 Styling Anti-Pattern Detection**

#### **❌ CRITICAL: Find inline styles and manual className concatenation**
```bash
# Find inline styles (security and consistency risk)
rg "style=\{|style=\"" --type tsx src/

# Should return ZERO results - no inline styles allowed

# Find manual className concatenation
rg "className=.*\+|className=.*\`.*\$\{" --type tsx src/

# Should use cn() utility instead

# Find hardcoded Tailwind classes on UI components
rg "<Button.*className=\".*bg-|<Card.*className=\".*border-" --type tsx src/

# Should use variants instead of overriding base classes
```

#### **✅ Required Styling Patterns:**
```typescript
// REQUIRED: Use cn() utility for className merging
import { cn } from '@/ui/lib/utils'
const className = cn("base-classes", isActive && "active-classes")

// REQUIRED: Use variants instead of className overrides
<Button variant="destructive" size="lg">Delete</Button>
<Card variant="outline">Content</Card>
```

## ♿ **Phase 4: Accessibility Compliance Audit**

### **4.1 Radix UI Foundation Verification**

#### **❌ CRITICAL: Find components not built on Radix UI**
```bash
# Find interactive components that should use Radix
rg "onClick.*=|onSubmit.*=|button.*type=" --type tsx src/components/taali-ui/ui/ -B 5 | rg -v "@radix-ui|Slot"

# Interactive UI components should be built on Radix primitives
```

#### **✅ Required Radix Patterns:**
```typescript
// REQUIRED: Use Radix primitives for interactive components
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Slot } from "@radix-ui/react-slot"

// REQUIRED: Forward refs for proper component composition
const Component = React.forwardRef<HTMLElement, ComponentProps>(
  ({ className, ...props }, ref) => {
    return <Primitive ref={ref} className={cn(variants({ className }))} {...props} />
  }
)
Component.displayName = "Component"
```

### **4.2 Accessibility Pattern Verification**

#### **❌ CRITICAL: Find missing ARIA labels and roles**
```bash
# Find interactive elements without proper ARIA
rg "button.*onClick|input.*type=|select.*onChange" --type tsx src/ -B 2 -A 2 | rg -v "aria-|role=|htmlFor="

# Interactive elements should have proper ARIA attributes

# Find form fields without labels
rg "<input|<textarea|<select" --type tsx src/ -B 3 -A 3 | rg -v "<label.*htmlFor=|aria-label="

# Form fields should have associated labels
```

## 🏗️ **Phase 5: Component Architecture Audit**

### **5.1 React Component Standards**

#### **❌ CRITICAL: Find components without proper TypeScript interfaces**
```bash
# Find components without proper prop interfaces
rg "function.*Component.*\(" --type tsx src/components/ | rg -v "interface.*Props"

# Components should have explicit prop interfaces
```

#### **✅ Required Component Architecture:**
```typescript
// REQUIRED: Proper component structure
import * as React from 'react'
import { cn } from '@/ui/lib/utils'

interface ComponentProps extends React.ComponentProps<'div'> {
  // Specific props
}

const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("component-classes", className)}
        {...props}
      />
    )
  }
)
Component.displayName = "Component"

export { Component }
```

### **5.2 Data Table Standards**

#### **❌ CRITICAL: Find custom table implementations**
```bash
# Find manual table implementations instead of DataTable
rg "<table|<tr.*<td|<tbody" --type tsx src/ | rg -v "DataTable|Table.*from.*@/ui"

# Should use DataTable component for all tabular data
```

#### **✅ Required DataTable Patterns:**
```typescript
// REQUIRED: Use DataTable with proper configuration
import { DataTable } from '@/ui/data-table'
import { useTableQuery } from '@/ui/hooks/use-table-query'

const { data, totalCount, isLoading, tableState, onStateChange } = useTableQuery({
  queryKey: ['resource'],
  queryFn: getResourceServer,
  defaultPageSize: 20,
})

<DataTable
  columns={columns}
  data={data}
  config={config}
  totalCount={totalCount}
  isLoading={isLoading}
  onStateChange={onStateChange}
/>
```

## 📱 **Phase 6: Form Component Standards**

### **6.1 Form Architecture Compliance**

#### **❌ CRITICAL: Find forms without proper structure**
```bash
# Find forms not using Form component
rg "<form" --type tsx src/ -B 5 -A 5 | rg -v "Form.*from.*@/ui/form|FormErrorBoundary"

# Forms should use established form components
```

#### **✅ Required Form Patterns:**
```typescript
// REQUIRED: Form component structure
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/ui/form'
import { FormErrorBoundary } from '@/components/form'

<FormErrorBoundary>
  <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FormField
        control={form.control}
        name="fieldName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Label</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </form>
  </Form>
</FormErrorBoundary>
```

### **6.2 Form Validation Integration**

#### **❌ CRITICAL: Find forms without proper validation**
```bash
# Find forms without zodResolver
rg "useForm.*\(" --type tsx src/ -A 5 | rg -v "zodResolver|resolver.*zodResolver"

# Forms should use Zod validation with zodResolver
```

## 🎨 **Phase 7: Theme & Responsive Design Audit**

### **7.1 Theme Support Verification**

#### **❌ CRITICAL: Find components without dark mode support**
```bash
# Find hardcoded colors that won't work with themes
rg "bg-white|bg-black|text-black|text-white|border-gray-" --type tsx src/components/ | rg -v "dark:|bg-white.*dark:bg-"

# Should use semantic color tokens that support themes
```

#### **✅ Required Theme Patterns:**
```typescript
// REQUIRED: Use semantic color tokens
className="bg-background text-foreground"
className="bg-primary text-primary-foreground"
className="border border-border"

// REQUIRED: Support dark mode variants
className="bg-white dark:bg-gray-900"
```

### **7.2 Responsive Design Verification**

#### **❌ CRITICAL: Find non-responsive components**
```bash
# Find components with fixed widths
rg "w-\[.*px\]|h-\[.*px\]|fixed.*dimensions" --type tsx src/components/ | rg -v "sm:|md:|lg:|xl:"

# Components should use responsive design patterns
```

## 📋 **UI Standards Audit Report Template**

### **UI Component Standards Audit Report**

**Date**: [Audit Date]
**Auditor**: [AI Agent ID]
**Scope**: [Components Audited Count]

#### **Import Pattern Compliance**
- **@/ui Alias Usage**: X/X UI components compliant
- **@/ Alias Usage**: X/X app components compliant
- **Import Organization**: ✅/❌ Properly grouped

#### **Raw HTML Element Compliance** 
- **Button Elements**: X/X using Button component
- **Input Elements**: X/X using Input component  
- **Textarea Elements**: X/X using Textarea component
- **Label Elements**: X/X using Label component
- **Select Elements**: X/X using Select component
- **Raw HTML Violations**: X violations found
- **Mixed Usage Patterns**: X files mixing raw HTML with taali-ui

#### **SVG Styling Compliance**
- **Button SVG Redundancy**: X/X icons without redundant styling
- **DropdownMenuItem SVG Redundancy**: X/X icons without redundant styling
- **DropdownMenuSubTrigger SVG Redundancy**: X/X icons without redundant styling
- **Badge SVG Redundancy**: X/X icons without redundant styling  
- **Select SVG Redundancy**: X/X icons without redundant styling
- **Command SVG Redundancy**: X/X icons without redundant styling
- **Toggle SVG Redundancy**: X/X icons without redundant styling
- **Total Redundant Styling Violations**: X violations found
- **Components with Proper Icon Usage**: X/X compliant

#### **Button Loading State Compliance**
- **Built-in Loading Prop Usage**: X/X buttons using loading prop correctly
- **Custom Loading Implementation**: X buttons using manual Loader2 rendering
- **Mixed Loading Patterns**: X files with inconsistent loading implementations  
- **Redundant Disabled Logic**: X buttons with unnecessary disabled+loading logic
- **Loading State Violations**: X total violations found
- **Proper Loading State Implementation**: X/X buttons compliant

#### **Design System Compliance**
- **CVA Pattern Usage**: X/X custom components compliant
- **Styling Violations**: X violations found
- **Variant System**: ✅/❌ Properly implemented

#### **Accessibility Standards**
- **Radix UI Foundation**: X/X interactive components compliant
- **ARIA Attributes**: X/X components accessible
- **Keyboard Navigation**: ✅/❌ Properly implemented

#### **Component Architecture**
- **TypeScript Interfaces**: X/X components properly typed
- **ForwardRef Usage**: X/X components properly forwarded
- **DisplayName**: X/X components properly named

#### **Violations Found**
| File | Line | Violation | Severity | Fix Required |
|------|------|-----------|----------|--------------|
| ... | ... | ... | ... | ... |

#### **Design System Improvements**
1. [Import Path Corrections]
2. [Raw HTML Element Replacements]
3. [Redundant SVG Styling Removal]
4. [CVA Implementation Fixes]
5. [Accessibility Enhancements]
6. [Architecture Standardization]

#### **Priority Fixes Required**
**Critical Priority - Button Loading States:**
- Replace manual `<Loader2 className="animate-spin" />` with `loading={state}` prop (X violations)
- Remove redundant `disabled={isLoading}` when using `loading={isLoading}` prop (X violations)  
- Remove conditional Loader2 rendering inside Button components (X violations)
- Standardize loading state text handling (X violations)
- Fix mixed loading implementation patterns in X files

**Critical Priority - Redundant SVG Styling:**
- Remove redundant `size-4`, `w-4 h-4` classes from icons in `<Button>` components (X violations)
- Remove redundant `mr-2`, `ml-2` spacing from icons in components with automatic gap (X violations)
- Remove redundant `size-4 mr-2` from icons in `<DropdownMenuItem>` components (X violations) 
- Remove redundant `size-3` classes from icons in `<Badge>` components (X violations)
- Remove redundant `shrink-0`, `pointer-events-none` from icons in components (X violations)

**High Priority - Raw HTML Elements:**
- Replace `<button>` with `<Button>` component in X files
- Replace `<input>` with `<Input>` component in X files  
- Replace `<textarea>` with `<Textarea>` component in X files
- Replace `<label>` with `<Label>` component in X files
- Add proper taali-ui imports to X files

**Medium Priority - Design System:**
- Implement CVA patterns in X custom components
- Fix import path violations in X files
- Add proper TypeScript interfaces to X components

#### **Button Loading State Best Practices**
**Do This ✅:**
```tsx
<Button loading={isLoading}>
  {isLoading ? t('processing') : t('submit')}
</Button>
<Button loading={isUploading}>
  {!isUploading && <SaveIcon />}
  {isUploading ? t('uploading') : t('upload')}
</Button>
```

**Don't Do This ❌:**
```tsx
<Button disabled={isLoading}>
  {isLoading ? (
    <><Loader2 className="animate-spin" />{t('loading')}</>
  ) : (
    <><PlusIcon />{t('add')}</>
  )}
</Button>
```

#### **SVG Styling Best Practices**
**Do This ✅:**
```tsx
<Button><PlusIcon />Add Item</Button>
<DropdownMenuItem><SettingsIcon />Settings</DropdownMenuItem>
<Badge><CheckIcon />Verified</Badge>
```

**Don't Do This ❌:**
```tsx
<Button><PlusIcon className="w-4 h-4 mr-2" />Add Item</Button>
<DropdownMenuItem><SettingsIcon className="size-4 mr-2" />Settings</DropdownMenuItem>
<Badge><CheckIcon className="size-3" />Verified</Badge>
```

---

## 🚀 **Additional Critical QA Routines Needed:**

Based on my analysis of the documentation, here are the other essential QA routines:

### **Server Function Security Audit** - Critical for API security
### **Validation System Consistency Audit** - Critical for data integrity  
### **Internationalization Completeness Audit** - Critical for global deployment
### **Database Query Security Audit** - Critical for data protection
### **Form Security Audit** - Critical for input validation
### **Email System Integration Audit** - Important for communication
### **Billing Security Audit** - Critical for payment processing

Each follows the same systematic methodology to ensure comprehensive coverage and maintain the high quality standards established in the documentation.