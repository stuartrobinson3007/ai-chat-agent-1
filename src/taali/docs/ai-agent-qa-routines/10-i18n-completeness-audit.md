# Internationalization Completeness Audit Routine

This document provides a systematic quality assurance routine for AI agents to validate i18n implementation completeness, translation coverage, namespace consistency, and proper internationalization patterns.

## 🛠️ **Available Tools**

This project includes comprehensive i18n detection tools:

### **`scripts/find-missing-keys.cjs`** - Primary tool for runtime error detection
- **Cross-reference validation**: Detects when `t('namespace:key')` calls reference non-existent keys (runtime errors)
- **Missing key detection**: Finds keys missing between locales (breaks non-English users)
- **Structural validation**: Identifies duplicate keys within JSON files
- **Smart namespace resolution**: Understands component namespace context from `useTranslation()` calls
- **Actionable suggestions**: Provides specific fix recommendations

### **`scripts/find-missing-translations.cjs`** - Secondary tool for hardcoded strings
- Detects hardcoded English strings that should be internationalized
- Filters out technical strings and focuses on user-facing content
- Prioritizes strings by impact (HIGH/MEDIUM/LOW)

### **npm Scripts Available:**
- `npm run i18n:check-keys` - Run missing key and cross-reference detection
- `npm run i18n:audit` - Run hardcoded string detection  
- `npm run i18n:check-all` - Run both tools comprehensively

## 🎯 **Purpose**

This routine ensures that all internationalization code follows established patterns, has complete translation coverage, uses proper namespace organization, and implements correct client/server translation separation.

## 🔍 **Critical Audit Checks**

### **❌ Find Hardcoded User-Facing Strings**
```bash
# Find user-facing strings (EXCLUDE technical identifiers and HTML attributes)  
rg "['\"].*[A-Z][^'\"]*['\"]" --glob "*.tsx" src/ | rg -v "t\(|className|testId|aria-|id=|type=|method=|value=|key=|name=|href=|src=|alt=|placeholder=.*\{|defaultValue=|accessorKey=|for="

# Find hardcoded UI text in components (REFINED)
rg "<(Button|Label|h[1-6]|p)([^>]*)>[^<]*[A-Z][^<]*</" --glob "*.tsx" src/ | rg -v "\{t\("

# Find user-facing error messages (EXCLUDE system/infrastructure errors)
rg "throw.*Error.*['\"][^'\"]*[A-Z][^'\"]*['\"]" --glob "*.ts" src/ | rg -v "errorTranslations|DATABASE_URL|REDIS_URL|environment variable"

# Find hardcoded status/fallback text shown to users
rg "(fallback|default|placeholder).*=.*['\"][A-Z][^'\"]*['\"]" --glob "*.tsx" src/ | rg -v "t\("
```

### **✅ Required Translation Patterns**

**Method 1: Hook-based namespacing (RECOMMENDED)**
```typescript
// Set namespace via hook parameter  
const { t } = useTranslation('todos')
const { t: tCommon } = useTranslation('common')

// Use keys without namespace prefix
<Button>{t('actions.create')}</Button>
<Label>{tCommon('labels.email')}</Label>
throw AppError.notFound(t('errors.notFound', 'Todo'))
```

**Method 2: Explicit namespacing (ALTERNATIVE)**
```typescript
// Use default hook
const { t } = useTranslation()

// Include namespace in every call
<Button>{t('todos:actions.create')}</Button>
<Label>{t('common:labels.email')}</Label>
throw AppError.notFound(t('todos:errors.notFound', 'Todo'))
```

**❌ AVOID: Mixed patterns in same file**

### **❌ Find Translation Key Inconsistencies**
```bash
# Find files using useTranslation() without namespace parameter (ACTUAL VIOLATIONS)
rg "useTranslation\(\)" --glob "*.tsx" --glob "*.ts" src/ 

# Find mixed namespace patterns in same file (hook vs explicit)
rg -l "useTranslation\('[^']+'\)" --glob "*.tsx" src/ | xargs -I {} sh -c 'echo "=== {} ===" && rg "t\('"'"'[^:'"'"']*:.*'"'"'\)" {} && echo'

# Find camelCase violations (underscore in keys)
rg "t\('[^']*_[^']*'\)" --glob "*.tsx" src/

# Find overly nested keys (5+ levels)
rg "t\('[^']*\.[^']*\.[^']*\.[^']*\.[^']*'" --glob "*.tsx" src/
```

### **🔍 Comprehensive i18n Validation**
```bash
# PRIMARY: Run comprehensive missing key and cross-reference detection
npm run i18n:check-keys

# SECONDARY: Run hardcoded string detection
npm run i18n:audit

# COMBINED: Run complete i18n audit (both missing keys and hardcoded strings)
npm run i18n:check-all

# LEGACY: Check for unused translation files (should return nothing)
rg "translation\.json" src/

# LEGACY: Find TODO/FIXME in active translation files only
find src/i18n/locales/ -name "*.json" ! -name "translation.json" -exec rg "TODO|FIXME|xxx" {} + -i
```

### **❌ Find Missing Translation Coverage (ENHANCED)**
The comprehensive script above replaces manual checks and provides:
- **Cross-reference validation**: Detects `t('namespace:key')` calls that reference non-existent keys
- **Missing key detection**: Finds keys present in one locale but missing in others  
- **Duplicate key detection**: Identifies duplicate sections within JSON files
- **Smart namespace resolution**: Understands component namespace context
- **Fix suggestions**: Provides actionable recommendations for each issue

### **✅ Server/Client Translation Separation**
```bash
# Find client hooks in server functions (VIOLATION)
rg "useTranslation" --glob "*.server.ts" src/

# Find proper server translation usage
rg "errorTranslations.*from.*@/i18n" --glob "*.server.ts" src/
```

### **✅ Architecture Validation**
```bash
# Verify translation hook patterns are consistent
echo "=== Components using translation hooks ==="
rg "useTranslation\('[^']*'\)" --glob "*.tsx" src/ -c | sort

# Check for mixed patterns (should be minimal)
echo "=== Files mixing hook and explicit namespace patterns ==="
rg -l "useTranslation\('[^']+'\)" --glob "*.tsx" src/ | while read file; do
  if rg -q "t\('[^']*:[^']*'\)" "$file"; then
    echo "MIXED PATTERN: $file"
  fi
done

# Validate translation file structure
echo "=== Translation file structure ==="
find src/i18n/locales/en/ -name "*.json" ! -name "translation.json" -exec echo "Validating: {}" \; -exec jq empty {} \;
```

## 📋 **Enhanced Report Template**
- **Cross-Reference Issues**: X issues found (runtime translation errors)
- **Missing Keys Between Locales**: X keys missing in secondary locales
- **Structural Issues**: X duplicate keys found in JSON files
- **Translation Coverage**: X% complete (exclude legacy translation.json files) 
- **User-Facing Hardcoded Strings**: X genuine violations found (not HTML attributes/technical IDs)
- **Architecture Pattern**: Hook-based ✅ / Explicit ✅ / Mixed ❌
- **Namespace Consistency**: X files using proper patterns
- **Server/Client Separation**: ✅/❌ Properly implemented
- **Legacy Files**: X unused translation files found (recommend cleanup)

## 🎯 **Interpretation Guide**

### **Expected Results for Well-Architected i18n:**
- **Cross-Reference Issues**: 0 (no runtime translation errors)
- **Missing Keys**: 0 (all locales have consistent keys)
- **Structural Issues**: 0 (no duplicate keys in JSON files)
- **Translation Coverage**: 90%+ (excluding legacy files)
- **Hardcoded Strings**: <10 genuine user-facing violations  
- **Architecture**: Consistent hook-based OR explicit patterns (not mixed)
- **Server/Client Separation**: Clean separation with no client hooks in .server.ts files

### **Critical Red Flags:**
- **Cross-Reference Issues > 0**: These cause actual runtime errors (`i18next::translator: missingKey`)
- **Missing Keys > 10**: Keys missing between locales, breaks app for non-English users
- **Structural Issues > 5**: Duplicate keys in JSON files causing undefined behavior

### **Warning Indicators:**
- Files using `useTranslation()` without namespace parameter
- Mixed namespace patterns within same file
- Client translation hooks in server functions
- High number of genuine user-facing hardcoded strings (excluding technical IDs)

### **False Positives to Ignore:**
- HTML attributes (className, id, testId, aria-*)
- Database field names (accessorKey, column names)  
- System/infrastructure error messages
- Technical identifiers and constants
- Dynamic keys with template literals (`${variable}` patterns)

### **Using the Enhanced Script:**
```bash
# Run and interpret results:
npm run i18n:check-keys

# Focus priority order:
# 1. CRITICAL: Cross-reference issues (fix immediately - runtime errors)  
# 2. HIGH: Missing keys (breaks non-English locales)
# 3. MEDIUM: Structural issues (duplicate keys)
# 4. LOW: Extra keys (minor inconsistencies)
```

## 🚀 **Quick Start for AI Agents**

When encountering i18n issues:

1. **First, run the comprehensive check:**
   ```bash
   npm run i18n:check-all
   ```

2. **Interpret results by priority:**
   - **Cross-reference issues = 0**: ✅ No runtime errors
   - **Cross-reference issues > 0**: 🔴 Fix immediately (causes `missingKey` console errors)
   - **Missing keys > 10**: 🟡 Breaks non-English users  
   - **Structural issues > 5**: 🟡 Clean up duplicate keys

3. **Focus on cross-reference issues first** - these cause the runtime errors users see

4. **Use script suggestions** - Each issue includes specific fix recommendations