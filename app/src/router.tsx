import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { LandingPage } from './components/LandingPage'
import { RootLayout } from './routes/RootLayout'
import { SamplingVariationRoute } from './routes/SamplingVariationRoute'
import { parseAppSearch } from './searchParams'

const rootRoute = createRootRoute({
  component: RootLayout,
  validateSearch: parseAppSearch,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
})

export const sampvarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sampvar',
  component: SamplingVariationRoute,
})

const routeTree = rootRoute.addChildren([indexRoute, sampvarRoute])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
