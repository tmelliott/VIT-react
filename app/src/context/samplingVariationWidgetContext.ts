import { createContext } from 'react'
import type { SamplingVariationHook } from '../rserve/vit.types'

export const SamplingVariationWidgetContext =
  createContext<SamplingVariationHook | null>(null)
