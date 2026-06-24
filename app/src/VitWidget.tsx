import { useRserve } from '@tmelliott/react-rserve'
import vitAppSchema from './rserve/vit.rserve'
import type { VitAppShape } from './rserve/vit.types'
import { VitAppProvider } from './context/VitAppProvider'
import { AppRouter } from './AppRouter'

export function VitWidget() {
  const rserveHost =
    import.meta.env.VITE_RSERVE_HOST ?? 'http://127.0.0.1:6311'

  const { app, loading, error } = useRserve(vitAppSchema, {
    host: rserveHost,
  })

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-gray-600">
        Connecting to Rserve…
      </div>
    )
  }

  if (error) {
    return (
      <p className="p-4" role="alert">
        Rserve: {error} (is <code>Rscript server/main.R</code> running?)
      </p>
    )
  }

  if (!app) return null

  return (
    <VitAppProvider app={app as VitAppShape}>
      <AppRouter />
    </VitAppProvider>
  )
}
