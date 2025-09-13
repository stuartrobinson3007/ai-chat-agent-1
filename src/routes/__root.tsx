import { HeadContent, Scripts, createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanstackDevtools } from '@tanstack/react-devtools'
import { Toaster } from 'sonner'
import { ThemeProvider, useTheme } from 'next-themes'

import appCss from '../styles.css?url'

import { Providers } from '@/lib/hooks/providers'
import { NotFoundComponent } from '@/components/not-found'
import { ConfirmDialogProvider } from '@/ui/confirm-dialog'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Jevora',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
  component: RootComponent,

  notFoundComponent: NotFoundComponent,
})

function RootComponent() {
  const { theme } = useTheme()
  return (
    <Providers>
      <ConfirmDialogProvider>
        <Outlet />
        <Toaster position="bottom-right" theme={theme as 'light' | 'dark' | 'system'} />
      </ConfirmDialogProvider>
    </Providers>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <TanstackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
          <Scripts />
        </ThemeProvider>
      </body>
    </html>
  )
}
