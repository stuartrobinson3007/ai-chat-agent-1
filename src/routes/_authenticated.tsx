import {
  createFileRoute,
  Outlet,
  useNavigate,
  useRouterState,
  useMatches,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import {
  SuperAdminWrapper,
  useSuperAdminWrapper,
} from '@/features/admin/components/super-admin-wrapper'
import { useSession, useListOrganizations } from '@/lib/auth/auth-hooks'
import { SuperAdminLayout } from '@/features/admin/components/super-admin-layout'
import { authClient } from '@/lib/auth/auth-client'
import { getActiveOrganizationId } from '@/features/organization/lib/organization-utils'

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { data: session, isPending: sessionPending } = useSession()
  const { data: organizations, isPending: orgsPending } = useListOrganizations()
  const navigate = useNavigate()
  const matches = useMatches()

  // Get SuperAdminWrapper props for overlay
  const superAdminProps = useSuperAdminWrapper()

  // Check if we're on superadmin routes
  // Use useRouterState for reactive pathname updates
  const currentPath = useRouterState({
    select: state => state.location.pathname,
  })
  const isSuperAdminRoute = currentPath.startsWith('/superadmin')

  // Check current route staticData for sidebar preference
  // Default to true (show sidebar) if not specified
  const currentMatch = matches[matches.length - 1]
  const showSidebar = currentMatch?.staticData?.sidebar !== false

  useEffect(() => {
    if (!sessionPending && !orgsPending) {
      if (!session) {
        navigate({ to: '/auth/signin' })
        return
      }

      // Don't redirect to onboarding if we're already on the onboarding page
      if (!session.user.onboardingCompleted && currentPath !== '/onboarding') {
        navigate({ to: '/onboarding' })
        return
      }

      // Check if user needs to select an organization
      // Skip this check for certain pages
      const skipOrgCheckPaths = ['/onboarding', '/select-organization', '/superadmin']
      const shouldSkipOrgCheck = skipOrgCheckPaths.some(path => currentPath.startsWith(path))
      
      if (!shouldSkipOrgCheck && session.user.onboardingCompleted) {
        const activeOrgId = getActiveOrganizationId()
        
        // If no active org ID or the active org doesn't exist in user's organizations
        if (!activeOrgId || (organizations && !organizations.find(org => org.id === activeOrgId))) {
          navigate({ to: '/select-organization' })
          return
        }
      }
    }
  }, [session, organizations, sessionPending, orgsPending, navigate, currentPath])

  // End impersonation when navigating to superadmin routes
  useEffect(() => {
    const endImpersonationIfNeeded = async () => {
      if (isSuperAdminRoute && session?.session?.impersonatedBy) {
        try {
          await authClient.admin.stopImpersonating()
          window.location.reload()
        } catch (error) {
          console.error('Failed to stop impersonation:', error)
        }
      }
    }

    if (!sessionPending && session) {
      endImpersonationIfNeeded()
    }
  }, [isSuperAdminRoute, session, sessionPending])

  if (sessionPending || orgsPending) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (isSuperAdminRoute) {
    return (
      <>
        <SuperAdminLayout>
          <Outlet />
        </SuperAdminLayout>
        <SuperAdminWrapper {...superAdminProps} />
      </>
    )
  }

  // Routes without sidebar (controlled by staticData)
  if (!showSidebar) {
    return (
      <>
        <div className="min-h-screen">
          <Outlet />
        </div>
        <SuperAdminWrapper {...superAdminProps} />
      </>
    )
  }

  // Regular routes with sidebar
  return (
    <>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-1 flex-col">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <SuperAdminWrapper {...superAdminProps} />
    </>
  )
}
