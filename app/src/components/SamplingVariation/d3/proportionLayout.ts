/** Colours for proportion bars — matches VIT / VITonline focus vs other. */
export const PROP_FOCUS_COLOR = '#00bfff'
export const PROP_ALT_COLOR = '#ff6b6b'
export const PROP_FOCUS_STROKE = '#0284c7'
export const PROP_ALT_STROKE = '#dc2626'

export type ProportionBarLayout = {
  top: number
  height: number
  baselineY: number
}

/** Use most of the pane height so dots pack densely instead of as a thin strip. */
export function singleProportionBarLayout(innerHeight: number): ProportionBarLayout {
  const height = Math.max(72, Math.min(innerHeight * 0.58, innerHeight - 28))
  const top = Math.max(18, (innerHeight - height) / 2)
  return {
    top,
    height,
    baselineY: top + height / 2,
  }
}

export function multiProportionBarLayouts(
  innerHeight: number,
  nGroups: number,
): ProportionBarLayout[] {
  const gap = 10
  const labelSpace = 14
  const available = Math.max(40, innerHeight - 8)
  const barHeight = Math.min(
    64,
    Math.max(28, (available - labelSpace * nGroups - gap * (nGroups - 1)) / nGroups),
  )
  const block = barHeight + labelSpace
  const total = nGroups * block + gap * Math.max(0, nGroups - 1)
  let top = Math.max(14, (innerHeight - total) / 2 + labelSpace / 2)

  const layouts: ProportionBarLayout[] = []
  for (let i = 0; i < nGroups; i++) {
    layouts.push({
      top,
      height: barHeight,
      baselineY: top + barHeight / 2,
    })
    top += block + gap
  }
  return layouts
}

export function proportionFromEncoded(encoded: number[], focusValue = 0): number {
  if (encoded.length === 0) return NaN
  let count = 0
  for (const v of encoded) {
    if (v === focusValue) count++
  }
  return count / encoded.length
}

export function formatProportion(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return (Math.round(value * 1000) / 1000).toFixed(3)
}
