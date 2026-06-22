/**
 * Hand-written widget types for the VIT app.
 *
 * Avoid z.infer / TVitApp / deep ReturnType chains on vit.rserve.ts — the compiled
 * schema is large enough to exhaust tsc's heap (~4GB+).
 */
import type { UseWidgetReturn } from '@tmelliott/react-rserve'
import type { samplingVariation, vitWidget } from './vit.rserve'

type PropertyGet<T> = {
  get: () => Promise<T>
  set: (v: T) => Promise<void>
}

export type VitWidgetProperties = {
  dsInfo: PropertyGet<{ nrows: number; ncols: number }>
}

export type VitWidgetMethods = {
  load_dataset: (url: string) => Promise<null>
}

export type VitWidgetChildren = {
  samplingVariation: typeof samplingVariation
}

export type VitAppShape = {
  vitWidget: typeof vitWidget
}

export type VitWidgetHook = UseWidgetReturn<
  VitWidgetProperties,
  VitWidgetMethods,
  VitWidgetChildren
>

export type SamplingVariationProperties = {
  variables: PropertyGet<string[]>
  xvar: PropertyGet<string>
  yvar: PropertyGet<string>
  sample_size: PropertyGet<number>
  statistic: PropertyGet<string>
  status: PropertyGet<string>
  progress: PropertyGet<number>
  error_message: PropertyGet<string>
  population: PropertyGet<Float64Array>
  population_stat: PropertyGet<number>
  sample_stats: PropertyGet<Float64Array>
  sample_indices: PropertyGet<Int32Array>
  dist_y: PropertyGet<Float64Array>
  scales: PropertyGet<{
    pop: Float64Array
    sample: Float64Array
    dist: Float64Array
  }>
}

export type SamplingVariationMethods = {
  record_choices: () => Promise<null>
}

export type SamplingVariationHook = UseWidgetReturn<
  SamplingVariationProperties,
  SamplingVariationMethods,
  unknown
>

export type SamplingVariationState = NonNullable<SamplingVariationHook['state']>

export type SamplingVariationCtor = typeof samplingVariation
