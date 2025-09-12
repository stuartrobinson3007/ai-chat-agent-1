import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'

import { cn } from '@/taali/lib/utils'
import { useTranslation } from '@/i18n/hooks/useTranslation'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        primary: 'border-transparent',
        secondary: 'border-transparent',
        muted: 'border-transparent',
        success: 'border-transparent',
        warning: 'border-transparent',
        info: 'border-transparent',
        destructive: 'border-transparent',
      },
      appearance: {
        solid: '',
        soft: '',
      },
      clickable: {
        true: 'cursor-pointer',
        false: '',
      },
    },
    compoundVariants: [
      // Solid variants
      {
        variant: 'primary',
        appearance: 'solid',
        className: 'bg-primary text-primary-foreground',
      },
      {
        variant: 'secondary',
        appearance: 'solid',
        className: 'bg-secondary text-secondary-foreground',
      },
      {
        variant: 'muted',
        appearance: 'solid',
        className: 'bg-muted text-muted-foreground',
      },
      {
        variant: 'success',
        appearance: 'solid',
        className: 'bg-success text-white',
      },
      {
        variant: 'warning',
        appearance: 'solid',
        className: 'bg-warning text-white',
      },
      {
        variant: 'info',
        appearance: 'solid',
        className: 'bg-info text-white',
      },
      {
        variant: 'destructive',
        appearance: 'solid',
        className: 'bg-destructive text-white dark:bg-destructive/60',
      },
      // Soft variants
      {
        variant: 'primary',
        appearance: 'soft',
        className: 'bg-primary/10 text-primary',
      },
      {
        variant: 'secondary',
        appearance: 'soft',
        className: 'bg-secondary/50 text-secondary-foreground',
      },
      {
        variant: 'muted',
        appearance: 'soft',
        className: 'bg-muted/50 text-muted-foreground',
      },
      {
        variant: 'success',
        appearance: 'soft',
        className: 'bg-success/10 text-success',
      },
      {
        variant: 'warning',
        appearance: 'soft',
        className: 'bg-warning/10 text-warning',
      },
      {
        variant: 'info',
        appearance: 'soft',
        className: 'bg-info/10 text-info',
      },
      {
        variant: 'destructive',
        appearance: 'soft',
        className: 'bg-destructive/10 text-destructive',
      },
      // Clickable hover states - solid
      {
        variant: 'primary',
        appearance: 'solid',
        clickable: true,
        className: 'hover:bg-primary/90',
      },
      {
        variant: 'secondary',
        appearance: 'solid',
        clickable: true,
        className: 'hover:bg-secondary/80',
      },
      {
        variant: 'muted',
        appearance: 'solid',
        clickable: true,
        className: 'hover:bg-muted/80',
      },
      {
        variant: 'success',
        appearance: 'solid',
        clickable: true,
        className: 'hover:bg-success/90',
      },
      {
        variant: 'warning',
        appearance: 'solid',
        clickable: true,
        className: 'hover:bg-warning/90',
      },
      {
        variant: 'info',
        appearance: 'solid',
        clickable: true,
        className: 'hover:bg-info/90',
      },
      {
        variant: 'destructive',
        appearance: 'solid',
        clickable: true,
        className:
          'hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
      },
      // Clickable hover states - soft
      {
        variant: 'primary',
        appearance: 'soft',
        clickable: true,
        className: 'hover:bg-primary/20',
      },
      {
        variant: 'secondary',
        appearance: 'soft',
        clickable: true,
        className: 'hover:bg-secondary/60',
      },
      {
        variant: 'muted',
        appearance: 'soft',
        clickable: true,
        className: 'hover:bg-muted/60',
      },
      {
        variant: 'success',
        appearance: 'soft',
        clickable: true,
        className: 'hover:bg-success/20',
      },
      {
        variant: 'warning',
        appearance: 'soft',
        clickable: true,
        className: 'hover:bg-warning/20',
      },
      {
        variant: 'info',
        appearance: 'soft',
        clickable: true,
        className: 'hover:bg-info/20',
      },
      {
        variant: 'destructive',
        appearance: 'soft',
        clickable: true,
        className:
          'hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
      },
    ],
    defaultVariants: {
      variant: 'primary',
      appearance: 'solid',
      clickable: false,
    },
  }
)

interface BadgeProps extends React.ComponentProps<'span'>, VariantProps<typeof badgeVariants> {
  asChild?: boolean
  startIcon?: React.ReactNode
  endIcon?: React.ReactNode
  startImage?: string
  endImage?: string
  dismissible?: boolean
  status?: boolean
  onDismiss?: () => void
}

function Badge({
  className,
  variant,
  appearance,
  clickable,
  asChild = false,
  startIcon,
  endIcon,
  startImage,
  endImage,
  dismissible,
  status,
  onDismiss,
  children,
  ...props
}: BadgeProps) {
  const { t } = useTranslation('common')
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, appearance, clickable }), className)}
      {...props}
    >
      {startImage && <img src={startImage} alt="" className="size-4 rounded-full object-cover" />}
      {startIcon}
      {status && <div className="size-1.5 rounded-full bg-current" />}
      {children}
      {endIcon}
      {endImage && <img src={endImage} alt="" className="size-4 rounded-full object-cover" />}
      {dismissible && (
        <button
          type="button"
          onClick={onDismiss}
          className="touch-hitbox ml-1 -mr-1 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          aria-label={t('accessibility.remove')}
        >
          <X className="size-2.5" />
        </button>
      )}
    </Comp>
  )
}

export { Badge, badgeVariants }
