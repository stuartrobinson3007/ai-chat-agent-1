# Development Workflow Audit Routine

This document provides a systematic quality assurance routine for AI agents to validate development workflow compliance, build configuration, code quality standards, and performance optimization patterns.

## 🎯 **Purpose**

This routine ensures that all code follows established development standards, maintains proper build configuration, implements performance optimizations, and adheres to code quality requirements.

## 🔍 **Critical Audit Checks**

### **❌ Find Build Configuration Issues**
```bash
# Check Vite configuration compliance
rg "defineConfig" --type ts vite.config.ts -A 20 | rg -v "tanstackStart|viteTsConfigPaths|tailwindcss"

# Should include all required plugins in correct order

# Check TypeScript configuration
rg "strict.*false|noUnusedLocals.*false" --type json tsconfig.json

# Should have strict TypeScript settings enabled
```

### **✅ Required Build Patterns**
```typescript
// REQUIRED: Proper Vite configuration
const config = defineConfig({
  plugins: [
    viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart({ customViteReactPlugin: true }),
    viteReact(),
  ],
})
```

### **❌ Find Performance Anti-Patterns**
```bash
# Find inefficient re-renders
rg "useEffect.*\[\]|useState.*expensive|useMemo.*\[\]" --type tsx src/

# Should have proper dependency arrays

# Find missing React.memo on expensive components
rg "export.*function.*Component" --type tsx src/components/ -A 10 | rg -v "memo\(|React\.memo"

# Consider memoization for expensive components
```

### **❌ Find Code Quality Issues**
```bash
# Find missing TypeScript types
rg "any\[\]|: any" --type ts --type tsx src/

# Should minimize 'any' usage

# Find console.log in production code
rg "console\.log|console\.warn" --type ts --type tsx src/ | rg -v "error|NODE_ENV.*development"

# Should use proper logging in production
```

## 📋 **Report Template**
- **Build Configuration**: ✅/❌ All plugins properly configured
- **TypeScript Compliance**: X violations found
- **Performance Optimization**: X improvements needed
- **Code Quality Standards**: X/X files compliant