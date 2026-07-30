import { useEffect, useRef, type RefObject } from 'react'
import type * as d3 from 'd3'
import { precomputeDistLayout, type DistLayout } from '../d3/distPhysics'
import { toNumberArray } from '../types'
import type { SamplingVariationState } from '../../rserve/vit.types'
import type { PaneLayout } from '../d3/paneCoords'
import type { PaneHandle } from '../paneHandle'

/** Minimal handle surface needed to stack the sampling-distribution dots. */
export type DistLayoutHandle = {
  distX: d3.ScaleLinear<number, number>
  distBaselineY: number
  dotRadius: number
  paneLayout: PaneLayout
}

function hasDistLayoutFields(handle: PaneHandle): handle is PaneHandle & DistLayoutHandle {
  return (
    'distBaselineY' in handle &&
    typeof handle.distBaselineY === 'number' &&
    'dotRadius' in handle &&
    typeof handle.dotRadius === 'number'
  )
}

function layoutCacheKey(statsLen: number, handle: DistLayoutHandle): string {
  const [d0, d1] = handle.distX.domain()
  return [
    statsLen,
    handle.paneLayout.innerWidth,
    handle.distBaselineY,
    d0,
    d1,
  ].join(':')
}

export function useDistLayout(
  state: SamplingVariationState | undefined,
  paneRef: RefObject<PaneHandle | null>,
) {
  const layoutRef = useRef<DistLayout | null>(null)
  const keyRef = useRef('')

  useEffect(() => {
    if (state?.status !== 'ready') {
      layoutRef.current = null
      keyRef.current = ''
      return
    }

    let cancelled = false
    const compute = () => {
      if (cancelled) return
      const handle = paneRef.current
      if (!handle) {
        requestAnimationFrame(compute)
        return
      }
      if (!hasDistLayoutFields(handle)) {
        layoutRef.current = null
        keyRef.current = ''
        return
      }
      const stats = toNumberArray(state.sample_stats)
      if (stats.length === 0) return
      const key = layoutCacheKey(stats.length, handle)
      if (key === keyRef.current && layoutRef.current) return

      layoutRef.current = precomputeDistLayout(
        stats,
        handle.distX,
        handle.distBaselineY,
        handle.dotRadius,
      )
      keyRef.current = key
    }

    compute()
    return () => {
      cancelled = true
    }
  }, [state?.status, state?.sample_stats, state?.scales, paneRef])

  return { layoutRef, keyRef }
}

export function ensureDistLayout(
  state: SamplingVariationState,
  handle: DistLayoutHandle,
  layoutRef: RefObject<DistLayout | null>,
  keyRef: RefObject<string>,
): DistLayout {
  const stats = toNumberArray(state.sample_stats)
  const key = layoutCacheKey(stats.length, handle)
  if (keyRef.current === key && layoutRef.current) {
    return layoutRef.current
  }
  const layout = precomputeDistLayout(
    stats,
    handle.distX,
    handle.distBaselineY,
    handle.dotRadius,
  )
  layoutRef.current = layout
  keyRef.current = key
  return layout
}
