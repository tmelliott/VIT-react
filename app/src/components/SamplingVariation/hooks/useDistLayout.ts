import { useEffect, useRef, type RefObject } from 'react'
import { precomputeDistLayout, type DistLayout } from '../d3/distPhysics'
import { toNumberArray } from '../types'
import type { SamplingVariationState } from '../../rserve/vit.types'
import type { ThreePaneHandle } from '../ThreePaneDisplay'

function layoutCacheKey(
  statsLen: number,
  handle: ThreePaneHandle,
): string {
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
  paneRef: RefObject<ThreePaneHandle | null>,
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
  handle: ThreePaneHandle,
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
