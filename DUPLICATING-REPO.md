# Duplicating This Repository

This guide provides comprehensive instructions for duplicating this TanStack application repository while maintaining the Taali subtree integration and properly configuring all dependencies.

## Overview

This repository is a full-stack TanStack application that includes:
- **Main Application**: React + TanStack Router + TanStack Start
- **Taali Subtree**: UI component library managed as a Git subtree
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth with OAuth providers
- **Billing**: Stripe integration
- **Email**: React Email with Resend
- **Internationalization**: i18next
- **Storage**: Local file storage system

## Prerequisites

Before starting, ensure you have:
- Node.js 20+
- pnpm package manager
- Git
- PostgreSQL database access
- Redis instance
- Required API keys (see Environment Configuration section)

## Step 1: Repository Setup

### 1.1 Create New Repository

```bash
# Create a new repository on GitHub/GitLab/etc.
# Then clone it locally
git clone https://github.com/YOUR_USERNAME/YOUR_NEW_REPO_NAME.git
cd YOUR_NEW_REPO_NAME

# Add the original repository as a remote (for reference)
git remote add upstream https://github.com/stuartrobinson3007/tanstack-todo-app.git

# Pull the original code
git pull upstream main

# Push to your new repository
git push origin main
```

### 1.2 Update Remote Configuration

```bash
# Verify your remotes are correct
git remote -v

# Should show:
# origin    https://github.com/YOUR_USERNAME/YOUR_NEW_REPO_NAME.git (fetch)
# origin    https://github.com/YOUR_USERNAME/YOUR_NEW_REPO_NAME.git (push)
# upstream  https://github.com/stuartrobinson3007/tanstack-todo-app.git (fetch)
# upstream  https://github.com/stuartrobinson3007/tanstack-todo-app.git (push)
```

## Step 2: Taali Subtree Configuration

The Taali component library is managed as a Git subtree. You have several options:

### Option 2A: Use Existing Taali Repository (Recommended)

```bash
# Add the existing Taali repository as a remote
git remote add taali https://github.com/stuartrobinson3007/taali.git

# Verify the subtree is properly configured
npm run taali:check
npm run taali:status
```

### Option 2B: Fork Taali Repository

```bash
# 1. Fork https://github.com/stuartrobinson3007/taali.git on GitHub
# 2. Update the remote to point to your fork
git remote remove taali
git remote add taali https://github.com/YOUR_USERNAME/YOUR_TAALI_FORK.git

# 3. Update package.json scripts to reference your fork
# Edit the npm scripts in package.json:
# "taali:push": "git subtree push --prefix=src/taali taali main"
# "taali:pull": "git subtree pull --prefix=src/taali taali main --squash"
```

### Option 2C: Create New Taali Repository

```bash
# 1. Create a new repository for your Taali components
# 2. Push the current taali subtree to your new repository
git subtree push --prefix=src/taali https://github.com/YOUR_USERNAME/YOUR_NEW_TAALI_REPO.git main

# 3. Add as remote
git remote add taali https://github.com/YOUR_USERNAME/YOUR_NEW_TAALI_REPO.git

# 4. Update package.json scripts accordingly
```

### Taali Workflow Commands

After setup, you can use these npm scripts:

```bash
# Check taali subtree structure
npm run taali:check

# View recent taali commits
npm run taali:status

# Pull latest changes from taali repository
npm run taali:pull

# Push local taali changes to taali repository
npm run taali:push

# Check taali remote URL
npm run taali:remote
```

## Step 3: Project Renaming & Configuration

### 3.1 Update Package Configuration

Edit `package.json`:
```json
{
  "name": "your-new-project-name",
  // ... rest of configuration remains the same
}
```

### 3.2 Update TanStack Configuration

Edit `.cta.json`:
```json
{
  "projectName": "your-new-project-name",
  "mode": "file-router",
  "typescript": true,
  "tailwind": true,
  "packageManager": "npm",
  "git": true,
  "version": 1,
  "framework": "react-cra",
  "chosenAddOns": ["start"]
}
```

### 3.3 Search and Replace References

Search for any hardcoded references to "tanstack-todo-app" in your codebase and update them:

```bash
# Search for references (optional)
grep -r "tanstack-todo-app" . --exclude-dir=node_modules --exclude-dir=.git

# Common files that may need updates:
# - README.md
# - Any configuration files
# - Documentation files
```

## Step 4: Port Configuration

### 4.1 Generate Random Ports

When duplicating this repository, you should use unique ports to avoid conflicts with other instances. Here's a script to generate random ports:

```bash
#!/bin/bash
# Generate random ports in the range 3000-9000
generate_random_port() {
  echo $((3000 + RANDOM % 6000))
}

# Generate unique ports
VITE_PORT=$(generate_random_port)
POSTGRES_PORT=$(generate_random_port)
REDIS_PORT=$(generate_random_port)

# Ensure ports are unique
while [ "$POSTGRES_PORT" = "$VITE_PORT" ]; do
  POSTGRES_PORT=$(generate_random_port)
done

while [ "$REDIS_PORT" = "$VITE_PORT" ] || [ "$REDIS_PORT" = "$POSTGRES_PORT" ]; do
  REDIS_PORT=$(generate_random_port)
done

echo "Generated ports:"
echo "VITE_PORT=$VITE_PORT"
echo "POSTGRES_EXTERNAL_PORT=$POSTGRES_PORT"
echo "REDIS_EXTERNAL_PORT=$REDIS_PORT"
```

### 4.2 Port Configuration in .env

The application requires the following ports to be configured in your `.env` file:

```env
# Port Configuration (REQUIRED - no defaults)
VITE_PORT=<your-unique-port>           # Vite dev server port
POSTGRES_EXTERNAL_PORT=<your-unique-port>  # PostgreSQL external port
REDIS_EXTERNAL_PORT=<your-unique-port>     # Redis external port
```

**Important Notes:**
- All ports MUST be configured - there are no defaults
- Vite reads `VITE_PORT` from .env automatically
- Docker Compose reads port variables from .env in the same directory
- Database and Redis URLs in .env should use the external ports

## Step 5: Environment Configuration

### 5.1 Create Environment File

```bash
# Copy the example environment file
cp .env.example .env
```

### 5.2 Configure Environment Variables

Edit `.env` and update the following:

#### Port Configuration
Ensure your ports are set as generated in Step 4:
```env
VITE_PORT=<your-generated-port>
POSTGRES_EXTERNAL_PORT=<your-generated-port>
REDIS_EXTERNAL_PORT=<your-generated-port>
```

#### Database Configuration
Use the POSTGRES_EXTERNAL_PORT you configured:
```env
DATABASE_URL=postgresql://username:password@localhost:<POSTGRES_EXTERNAL_PORT>/your_database_name
```

#### Redis Configuration
Use the REDIS_EXTERNAL_PORT you configured:
```env
REDIS_URL=redis://localhost:<REDIS_EXTERNAL_PORT>
```

#### Better Auth Configuration
Use the VITE_PORT you configured:
```env
BETTER_AUTH_SECRET=your-super-secret-32-char-key-here-change-this
BETTER_AUTH_URL=http://localhost:<VITE_PORT>
VITE_BETTER_AUTH_URL=http://localhost:<VITE_PORT>
```

#### OAuth Providers
```env
# Google OAuth (required)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

#### Email Service (Resend)
```env
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=noreply@yourdomain.com
```

#### Admin Configuration
```env
# Comma-separated list of user IDs who should have admin access
ADMIN_USER_IDS=user-id-1,user-id-2
```

#### Stripe Configuration (for billing features)
```env
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Pricing configuration
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_BUSINESS_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...
STRIPE_BUSINESS_ANNUAL_PRICE_ID=price_...
```

#### Storage Configuration
```env
# For local development
STORAGE_PATH=./storage

# For production (Railway)
# STORAGE_PATH=/storage
```

### 4.3 External Services Setup

#### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs: `http://localhost:<VITE_PORT>/api/auth/callback/google`

#### GitHub OAuth Setup (Optional)
1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth app
3. Set Authorization callback URL: `http://localhost:<VITE_PORT>/api/auth/callback/github`

#### Resend Setup
1. Sign up at [Resend](https://resend.com/)
2. Create an API key
3. Verify your domain for sending emails

#### Stripe Setup (For billing features)
1. Create a [Stripe](https://stripe.com/) account
2. Get your API keys from the dashboard
3. Create products and pricing plans
4. Set up webhook endpoints

## Step 5: Dependencies & Build Setup

### 5.1 Install Dependencies

```bash
# Install all dependencies
pnpm install

# Alternative: if you prefer npm
# rm pnpm-lock.yaml
# npm install
```

### 5.2 Database Setup

```bash
# Generate Drizzle migrations (if schema changes were made)
npx drizzle-kit generate

# Run migrations
npx drizzle-kit migrate

# Optional: Seed initial data
npm run seed:todos
```

### 5.3 Verify Build

```bash
# Type check
npm run typecheck

# Lint code
npm run lint

# Build application
npm run build

# Run tests
npm run test
```

## Step 6: Development Workflow

### 6.1 Start Development Server

```bash
# Start the development server
npm run dev

# Server will start on http://localhost:<VITE_PORT>
```

### 6.2 Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run start           # Start production server
npm run serve           # Preview production build

# Code Quality
npm run typecheck       # Type checking
npm run lint           # Lint code
npm run lint:fix       # Fix linting issues
npm run format         # Format code with Prettier
npm run format:check   # Check code formatting

# Testing
npm run test           # Run tests

# Database
npm run seed:todos     # Seed initial todo data

# Internationalization
npm run i18n:extract   # Extract translation strings
npm run i18n:audit     # Audit missing translations
npm run i18n:check-all # Check i18n completeness

# Error Management
npm run errors:check   # Check for unused error codes
npm run errors:fix     # Fix unused errors

# Email Development
npm run email:dev      # Start email development server

# Taali (Component Library)
npm run taali:status   # View taali subtree status
npm run taali:pull     # Pull changes from taali repo
npm run taali:push     # Push changes to taali repo
npm run taali:check    # Check taali structure
```

## Step 7: Verification & Testing

### 7.1 Verify Application Functionality

1. **Authentication**: Test sign-up/sign-in with configured OAuth providers
2. **Database**: Verify database connection and migrations
3. **UI Components**: Ensure Taali components render correctly
4. **Internationalization**: Test language switching
5. **Email**: Test email sending functionality
6. **File Upload**: Test avatar upload functionality
7. **Billing** (if configured): Test Stripe integration

### 7.2 Verify Taali Subtree

```bash
# Check that taali subtree is properly configured
npm run taali:check

# View recent taali changes
npm run taali:status

# Test pulling from taali (should not make changes if up to date)
npm run taali:pull
```

### 7.3 Test Build Process

```bash
# Ensure production build works
npm run build

# Check for type errors
npm run typecheck

# Lint the codebase
npm run lint

# Run tests
npm run test
```

## Step 8: Customization Guidelines

### 8.1 Application Structure

- `src/features/` - Feature-specific code (auth, billing, todos, etc.)
- `src/components/` - Shared application components
- `src/taali/` - UI component library (managed as subtree)
- `src/lib/` - Utility libraries and configurations
- `src/routes/` - TanStack Router route definitions
- `src/i18n/` - Internationalization configuration and translations

### 8.2 Adding New Features

1. Create feature directory in `src/features/`
2. Follow existing patterns for server functions, components, and hooks
3. Add translations to `src/i18n/locales/`
4. Add routes in `src/routes/`
5. Update navigation and permissions as needed

### 8.3 Modifying Taali Components

```bash
# Make changes to components in src/taali/
# When ready to share changes:
npm run taali:push

# To get updates from other developers:
npm run taali:pull
```

## Step 9: Production Deployment

### 9.1 Environment Variables for Production

Update `.env` for production:
- Set `NODE_ENV=production`
- Use production database URLs
- Use production OAuth callback URLs
- Configure production storage paths
- Set up production email domains

### 9.2 Railway Deployment (Example)

This project includes Railway configuration (`railway.json`):

```json
{
  "version": 2,
  "build": {
    "builder": "dockerfile"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "never"
  }
}
```

### 9.3 Docker Support

The application includes Docker configuration in `docker-compose.yml` for local development with PostgreSQL and Redis.

## Troubleshooting

### Common Issues

1. **Taali Subtree Issues**: If taali operations fail, ensure the remote is correctly configured and you have push access.

2. **Database Connection**: Verify PostgreSQL is running and connection string is correct.

3. **OAuth Errors**: Check that redirect URLs match between your application and OAuth provider settings.

4. **Build Errors**: Run `npm run typecheck` and `npm run lint` to identify issues.

5. **Missing Environment Variables**: Review `.env.example` and ensure all required variables are set.

### Getting Help

- Check the comprehensive documentation in `src/taali/docs/`
- Review existing feature implementations for patterns
- Test changes thoroughly before committing
- Use the provided npm scripts for common tasks

## Conclusion

You should now have a fully functional duplicate of the TanStack application with proper Taali subtree integration. The application includes authentication, billing, internationalization, email functionality, and a comprehensive UI component library.

Remember to:
- Keep your Taali subtree synchronized with your chosen component library repository
- Update translations when adding new features  
- Follow the established patterns for consistency
- Test thoroughly before deploying to production

For more detailed information about specific features, refer to the documentation in `src/taali/docs/`.