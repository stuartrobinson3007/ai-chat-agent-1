import { createFileRoute, Navigate } from '@tanstack/react-router'
import { z } from 'zod'

import { useSession } from '@/lib/auth/auth-hooks'
import { OnboardingForm } from '@/features/auth/components/onboarding-form'
import { getInvitationDetails } from '@/features/organization/lib/onboarding.server'

const searchSchema = z.object({
  invite: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/onboarding')({
  staticData: {
    sidebar: false,
    skipOrgCheck: true,  // Skip org check since user is still onboarding
  },
  validateSearch: searchSchema,
  loader: async ({ location }) => {
    const searchParams = location.search as { invite?: string }

    if (searchParams.invite) {
      try {
        const invitation = await getInvitationDetails({
          data: { invitationId: searchParams.invite },
        })
        return { invitation }
      } catch (_error) {
        // Failed to load invitation - handled by showError
        return { invitation: null }
      }
    }

    return { invitation: null }
  },
  component: OnboardingPage,
})

function OnboardingPage() {
  const { data: session } = useSession()
  const { invitation } = Route.useLoaderData()
  const search = Route.useSearch()

  // If already onboarded, redirect to home
  if (session?.user?.onboardingCompleted) {
    return <Navigate to="/" />
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="bg-card rounded-xl shadow-lg p-8 w-full max-w-md">
        <OnboardingForm
          invitationId={search.invite}
          organizationName={invitation?.organizationName}
        />
      </div>
    </div>
  )
}
