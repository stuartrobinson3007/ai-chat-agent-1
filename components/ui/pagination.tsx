import * as React from 'react'
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from 'lucide-react'

import { Button, buttonVariants } from './button'

import { cn } from '@/taali/lib/utils'
import { useTranslation } from '@/i18n/hooks/useTranslation'

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  const { t } = useTranslation('common')
  return (
    <nav
      role="navigation"
      aria-label={t('accessibility.pagination')}
      data-slot="pagination"
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  )
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('flex flex-row items-center gap-1', className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<React.ComponentProps<typeof Button>, 'size'> &
  React.ComponentProps<'a'>

function PaginationLink({ className, isActive, size = 'icon', ...props }: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? 'page' : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(
        buttonVariants({
          variant: isActive ? 'outline' : 'ghost',
          size,
        }),
        className
      )}
      {...props}
    />
  )
}

function PaginationPrevious({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  const { t } = useTranslation('common')

  return (
    <PaginationLink
      aria-label={t('accessibility.goToPrevious')}
      size="default"
      className={cn('gap-1 px-2.5 sm:pl-2.5', className)}
      {...props}
    >
      <ChevronLeftIcon />
      <span className="hidden sm:block">{t('pagination.previous')}</span>
    </PaginationLink>
  )
}

function PaginationNext({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  const { t } = useTranslation('common')

  return (
    <PaginationLink
      aria-label={t('accessibility.goToNext')}
      size="default"
      className={cn('gap-1 px-2.5 sm:pr-2.5', className)}
      {...props}
    >
      <span className="hidden sm:block">{t('pagination.next')}</span>
      <ChevronRightIcon />
    </PaginationLink>
  )
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  const { t } = useTranslation('common')

  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn('flex size-9 items-center justify-center', className)}
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">{t('accessibility.morePages')}</span>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
}
