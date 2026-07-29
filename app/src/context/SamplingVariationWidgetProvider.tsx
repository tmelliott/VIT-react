import { useWidget } from '@tmelliott/react-rserve'
import type { ReactNode } from 'react'
import type {
  SamplingVariationCtor,
  SamplingVariationHook,
} from '../rserve/vit.types'
import { SamplingVariationWidgetContext } from './samplingVariationWidgetContext'

/**
 * Keeps the sampling-variation R widget connected for the lifetime of the VIT
 * session. Remounting `useWidget` on the same child ocap fails because RserveTS
 * `register()` refuses a second client (`Already registered`) and never pushes
 * state to the new React store.
 */
export function SamplingVariationWidgetProvider({
  ctor,
  children,
}: {
  ctor: SamplingVariationCtor
  children: ReactNode
}) {
  const widget = useWidget(ctor) as SamplingVariationHook
  return (
    <SamplingVariationWidgetContext.Provider value={widget}>
      {children}
    </SamplingVariationWidgetContext.Provider>
  )
}
