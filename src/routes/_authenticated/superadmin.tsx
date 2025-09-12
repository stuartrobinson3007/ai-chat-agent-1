import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/superadmin')({
  staticData: {
    skipOrgCheck: true,  // Skip org check for superadmin routes (they transcend orgs)
  },
  component: SuperAdminPage,
})

function SuperAdminPage() {
  // Use our SuperAdminLayout component which has purple sidebar
  return <Outlet />
}
