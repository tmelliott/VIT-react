import { useContext } from 'react'
import { SamplingVariationWidgetContext } from '../context/samplingVariationWidgetContext'

export function useSamplingVariationWidget() {
  const ctx = useContext(SamplingVariationWidgetContext)
  if (!ctx) {
    throw new Error(
      'useSamplingVariationWidget must be used within SamplingVariationWidgetProvider',
    )
  }
  return ctx
}
