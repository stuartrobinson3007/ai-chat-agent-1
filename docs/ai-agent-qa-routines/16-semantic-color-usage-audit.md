# Semantic Color Usage Audit

## Purpose
Ensure all color usage throughout the codebase uses semantic CSS variables instead of direct color names for better theming and maintainability.

## Automated Checks

### 1. Non-Semantic Color Detection
```bash
# Check for direct color usage in Tailwind classes
rg -t tsx -t ts -t jsx -t js '\b(text-|bg-|border-)(red|blue|green|yellow|amber|orange|gray|slate|purple)-[0-9]+' --glob '!**/node_modules/**'

# Check for inline color styles
rg -t tsx -t ts -t jsx -t js 'color:\s*["\']?(red|blue|green|yellow|amber|orange|purple)' --glob '!**/node_modules/**'
rg -t tsx -t ts -t jsx -t js 'backgroundColor:\s*["\']?(red|blue|green|yellow|amber|orange|purple)' --glob '!**/node_modules/**'
```

### 2. Semantic Variables Available
Check `src/styles.css` for available semantic color variables:
- `success` - For positive states, confirmations
- `warning` - For caution states, alerts
- `info` - For informational states
- `destructive` - For errors, dangerous actions
- `muted` - For subtle/secondary content
- `primary`, `secondary`, `accent` - For brand colors

## Manual Review Process

### 1. Color Mapping Guidelines
- **Green colors** → `success`
- **Yellow/Amber colors** → `warning`
- **Blue colors** → `info` or `primary`
- **Red colors** → `destructive`
- **Orange colors** → `warning` or custom semantic
- **Gray/Slate colors** → `muted` or appropriate semantic

### 2. Files to Check
Priority files that commonly use colors:
- Email templates (`src/emails/*.tsx`)
- Authentication components (`src/features/auth/components/*.tsx`)
- Status indicators and badges
- Alert/notification components
- Form validation states

### 3. Replacement Patterns
```tsx
// ❌ Bad - Direct color usage
<div className="bg-green-50 text-green-600 border-green-200">
<Icon className="text-yellow-600" />

// ✅ Good - Semantic variables
<div className="bg-success/10 text-success border-success/20">
<Icon className="text-warning" />
```

### 4. Opacity Support
Use Tailwind's opacity modifier with semantic colors:
- `bg-success/10` - 10% opacity
- `text-warning/80` - 80% opacity
- `border-info/20` - 20% opacity

## Validation Steps

1. **Run automated checks** to find direct color usage
2. **Review each occurrence** and map to semantic variable
3. **Test theme switching** to ensure colors adapt properly
4. **Verify accessibility** with both light and dark themes
5. **Check email templates** render correctly with semantic colors

## Common Issues to Look For

- [ ] Hardcoded colors in email templates
- [ ] Status indicators using direct colors
- [ ] Form validation states with non-semantic colors
- [ ] Icon colors not using semantic variables
- [ ] Background/border combinations inconsistent

## Success Criteria

- No direct color names (red, blue, green, etc.) in className strings
- All colors use semantic CSS variables
- Consistent color usage for similar UI states
- Theme switching works without color issues
- Email templates use semantic colors properly

## Frequency
Run monthly or after major UI updates

## Notes
- Purple is allowed as it's likely part of the brand palette
- Check that semantic color usage makes sense contextually
- Consider creating additional semantic variables if patterns emerge