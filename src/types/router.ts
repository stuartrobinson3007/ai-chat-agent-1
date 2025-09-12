// TanStack Router type extensions

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    sidebar?: boolean
    skipOrgCheck?: boolean
  }
}

export {}
