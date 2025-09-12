import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Building2, Plus, Loader2, Check } from 'lucide-react'

import { useListOrganizations } from '@/lib/auth/auth-hooks'
import { setActiveOrganizationId } from '@/features/organization/lib/organization-utils'
import { authClient } from '@/lib/auth/auth-client'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useErrorHandler } from '@/lib/errors/hooks'
import { AppError, ERROR_CODES } from '@/taali/utils/errors'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Textarea } from '@/ui/textarea'
import { Button } from '@/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'

export const Route = createFileRoute('/_authenticated/select-organization')({
  staticData: {
    sidebar: false,
    skipOrgCheck: true,  // Skip org check since this IS the org selection page
  },
  component: SelectOrganizationPage,
})

function SelectOrganizationPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('common')
  const { t: tNotifications } = useTranslation('notifications')
  const { showError, showSuccess } = useErrorHandler()

  const { data: organizations, isPending: isLoading, refetch: refetchOrganizations } = useListOrganizations()
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const handleSelectOrganization = async (organizationId: string) => {
    try {
      setIsSelecting(true)
      setSelectedOrg(organizationId)

      setActiveOrganizationId(organizationId)

      await new Promise(resolve => setTimeout(resolve, 300))

      navigate({ to: '/' })
    } catch (error) {
      showError(error)
      setIsSelecting(false)
      setSelectedOrg(null)
    }
  }

  const handleCreateOrganization = async () => {
    if (!formData.name.trim()) {
      setValidationErrors({ name: tNotifications('error.organizationNameRequired') })
      return
    }

    setValidationErrors({})
    setIsCreating(true)

    try {
      const { data: result, error } = await authClient.organization.create({
        name: formData.name.trim(),
        slug: formData.name.trim().toLowerCase().replace(/\s+/g, '-'),
      })

      if (error) {
        throw new AppError(
          ERROR_CODES.BIZ_INVALID_STATE,
          400,
          { organizationName: formData.name },
          error.message || tNotifications('error.organizationCreateFailed')
        )
      }

      if (result) {
        setActiveOrganizationId(result.id)

        await refetchOrganizations()

        setFormData({ name: '', description: '' })
        setShowCreateDialog(false)

        showSuccess(tNotifications('success.organizationCreated'))

        navigate({ to: '/' })
      }
    } catch (error: unknown) {
      // Failed to create organization - handled by showError
      const errorMessage = (error as Error)?.message || tNotifications('error.failedToCreateWorkspace')
      setValidationErrors({
        name: errorMessage,
      })
      showError(error)
    } finally {
      setIsCreating(false)
    }
  }

  const updateFormField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">{t('states.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('organization.selectWorkspace')}
          </h1>
          <p className="text-muted-foreground">
            {organizations && organizations.length > 0
              ? t('organization.chooseWorkspaceDescription')
              : t('organization.noWorkspacesDescription')}
          </p>
        </div>

        {organizations && organizations.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => (
              <Card
                key={org.id}
                className={`cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 ${selectedOrg === org.id ? 'border-primary shadow-lg' : ''
                  }`}
                onClick={() => handleSelectOrganization(org.id)}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                    {selectedOrg === org.id && (
                      isSelecting ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <Check className="h-5 w-5 text-primary" />
                      )
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="mb-1">{org.name}</CardTitle>
                  {org.slug && (
                    <CardDescription className="text-sm">
                      {org.slug}
                    </CardDescription>
                  )}
                </CardContent>
              </Card>
            ))}

            <Card
              className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 border-dashed"
              onClick={() => setShowCreateDialog(true)}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="h-8 w-8 rounded-md border-2 border-dashed border-muted-foreground/50 flex items-center justify-center">
                    <Plus className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="mb-1">{t('organization.createWorkspace')}</CardTitle>
                <CardDescription className="text-sm">
                  {t('organization.createNewWorkspaceDescription')}
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex justify-center">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <CardTitle>{t('organization.noWorkspacesTitle')}</CardTitle>
                <CardDescription>
                  {t('organization.noWorkspacesDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Button onClick={() => setShowCreateDialog(true)} size="lg">
                  <Plus />
                  {t('organization.createFirstWorkspace')}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('organization.createWorkspace')}</DialogTitle>
            <DialogDescription>{t('organization.createWorkspaceDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">{t('organization.workspaceName')}</Label>
              <Input
                id="name"
                placeholder={t('organization.workspaceNamePlaceholder')}
                value={formData.name}
                onChange={e => updateFormField('name', e.target.value)}
                className={
                  validationErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''
                }
              />
              {validationErrors.name && (
                <p className="text-sm text-destructive">{validationErrors.name}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">{t('organization.workspaceDescriptionOptional')}</Label>
              <Textarea
                id="description"
                placeholder={t('organization.workspaceDescriptionPlaceholder')}
                value={formData.description}
                onChange={e => updateFormField('description', e.target.value)}
                className={
                  validationErrors.description
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }
              />
              {validationErrors.description && (
                <p className="text-sm text-destructive">{validationErrors.description}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                setFormData({ name: '', description: '' })
                setValidationErrors({})
              }}
              disabled={isCreating}
            >
              {t('actions.cancel')}
            </Button>
            <Button onClick={handleCreateOrganization} disabled={!formData.name.trim() || isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="animate-spin" />
                  {t('states.creating')}
                </>
              ) : (
                <>
                  <Building2 />
                  {t('organization.createWorkspace')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}