import { useContext } from 'react'
import { ModuleHeader } from '../components/SamplingVariation/ModuleHeader'
import { SamplingVariation } from '../components/SamplingVariation'
import { VitAppContext } from '../context/vitAppContext'
import { useRserveConnection } from '../hooks/useRserveConnection'
import type { VitWidgetHook } from '../rserve/vit.types'

export function SamplingVariationRoute() {
  const { isReady } = useRserveConnection()
  const vitApp = useContext(VitAppContext)

  if (!isReady || !vitApp) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <ModuleHeader />
        <p className="text-sm text-gray-600" role="status">
          This module is unavailable until the R connection is ready.
        </p>
      </div>
    )
  }

  return <SamplingVariationRouteContent widget={vitApp} />
}

function SamplingVariationRouteContent({ widget }: { widget: VitWidgetHook }) {
  const { children } = widget

  if (!children?.samplingVariation) {
    return (
      <p className="p-4 text-gray-600" role="alert">
        Sampling variation module is not available.
      </p>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <ModuleHeader />
      <SamplingVariation module={children.samplingVariation} />
    </div>
  )
}
