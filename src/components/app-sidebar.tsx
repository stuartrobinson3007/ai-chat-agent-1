/**
 * App Sidebar with role-based access control
 */

import { useState, useEffect } from 'react'
import { useRouter, useRouterState, Link } from '@tanstack/react-router'
import { Bot, Users, Settings, CreditCard, Link as LinkIcon } from 'lucide-react'

import { useTranslation } from '@/i18n/hooks/useTranslation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
} from '@/components/ui/sidebar'
import { UserTile } from '@/components/user-tile'
import { OrganizationSwitcher } from '@/features/organization/components/organization-switcher'
import { BillingStatusDisplay } from '@/components/billing-status-display'
import { authClient } from '@/lib/auth/auth-client'
import { useSession } from '@/lib/auth/auth-hooks'
import { useActiveOrganization } from '@/features/organization/lib/organization-context'
import { queryClient } from '@/lib/hooks/providers'

// Type definitions

// Navigation items will be defined inside the component to use proper hooks

// Permission helper functions
const hasAdminPermission = (role: string | null): boolean => {
  return role === 'owner' || role === 'admin'
}

export function AppSidebar() {
  const router = useRouter()
  const { data: session } = useSession()
  const { activeOrganizationId } = useActiveOrganization()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [memberRole, setMemberRole] = useState<string | null>(null)
  const { t } = useTranslation('common')

  const currentPath = useRouterState({
    select: state => state.location.pathname,
  })

  const user = session?.user
  const isImpersonating = !!(session as { session?: { impersonatedBy?: string } })?.session?.impersonatedBy

  // Get the user's role in the active organization
  useEffect(() => {
    async function fetchMemberRole() {
      if (!activeOrganizationId || !user?.id) {
        setMemberRole(null)
        return
      }

      try {
        const response = await authClient.organization.listMembers({
          query: { organizationId: activeOrganizationId },
        })

        // Handle different response structures from Better Auth
        let membersArray: { userId: string; role: string }[] = []

        if (response && 'members' in response) {
          // Response has members property
          membersArray = Array.isArray(response.members) ? response.members : []
        } else if (response && 'data' in response) {
          // Response has data property
          const data = response.data
          if (Array.isArray(data)) {
            membersArray = data
          } else if (data && 'members' in data) {
            membersArray = data.members || []
          }
        } else if (Array.isArray(response)) {
          // Response is directly an array
          membersArray = response
        }

        // Find the current user's membership
        const currentUserMember = membersArray.find((m) => m.userId === user.id)
        setMemberRole(currentUserMember?.role || null)
      } catch {
        setMemberRole(null)
      }
    }

    fetchMemberRole()
  }, [activeOrganizationId, user?.id])

  // Define navigation items with proper hook-based translations
  const navigationItems = [
    {
      title: 'Agents',
      url: '/',
      icon: Bot,
      requiresPermission: null, // Everyone can access
    },
    {
      title: 'Connections',
      url: '/connections',
      icon: LinkIcon,
      requiresPermission: 'admin', // Only admins can manage connections
    },
    {
      title: t('navigation.team'),
      url: '/team',
      icon: Users,
      requiresPermission: null, // Everyone can access (with different capabilities)
    },
    {
      title: t('navigation.billing'),
      url: '/billing',
      icon: CreditCard,
      requiresPermission: 'billing',
    },
    {
      title: t('navigation.settings'),
      url: '/settings',
      icon: Settings,
      requiresPermission: 'workspace',
    },
  ].filter(item => {
    if (!item.requiresPermission) return true
    if (item.requiresPermission === 'admin') return hasAdminPermission(memberRole)

    // Billing and Settings require admin or owner role
    return hasAdminPermission(memberRole)
  })

  const handleLogout = async () => {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)

    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: async () => {
            // Clear local storage items
            if (typeof window !== 'undefined') {
              const itemsToClear = ['activeOrganizationId', 'admin_override_mode']

              itemsToClear.forEach(item => {
                try {
                  localStorage.removeItem(item)
                } catch {
                  // Error clearing localStorage item silently ignored
                }
              })

              // Clear session storage
              try {
                sessionStorage.clear()
              } catch {
                // Error clearing sessionStorage silently ignored
              }
            }

            // IMPORTANT: Invalidate all queries to clear cached session
            await queryClient.invalidateQueries()
            await queryClient.clear()

            // Navigate to signin
            router.navigate({
              to: '/auth/signin',
            })
          },
          onError: () => {
            setIsLoggingOut(false)
          },
        },
      })
    } catch {
      setIsLoggingOut(false)
    }
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="px-2 py-2">
          <h2 className="text-lg font-semibold mb-2">{t('sidebar.app')}</h2>
          <div className='space-y-2'>
            <OrganizationSwitcher />
            <BillingStatusDisplay />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={currentPath === item.url}>
                    <Link to={item.url} className="flex items-center gap-3">
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <UserTile
              user={user ? { ...user, isImpersonating } : user}
              onLogout={handleLogout}
              isLoggingOut={isLoggingOut}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
