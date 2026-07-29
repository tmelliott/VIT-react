import { useWidget } from '@tmelliott/react-rserve'
import type { ReactNode } from 'react'
import type { VitAppShape } from '../rserve/vit.types'
import type { VitWidgetHook } from '../rserve/vit.types'
import { VitAppContext } from './vitAppContext'
import { SamplingVariationWidgetProvider } from './SamplingVariationWidgetProvider'

export function VitAppProvider({
  app,
  children,
}: {
  app: VitAppShape
  children: ReactNode
}) {
  const widget = useWidget(app.vitWidget) as VitWidgetHook

  if (!widget.state) {
    return <p className="p-4 text-gray-600">Loading VIT…</p>
  }

  const samplingVariationCtor = widget.children?.samplingVariation

  return (
    <VitAppContext.Provider value={widget}>
      {samplingVariationCtor ? (
        <SamplingVariationWidgetProvider ctor={samplingVariationCtor}>
          {children}
        </SamplingVariationWidgetProvider>
      ) : (
        children
      )}
    </VitAppContext.Provider>
  )
}
