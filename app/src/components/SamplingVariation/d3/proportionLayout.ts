/** Accessible colour tokens for categorical / proportion charts. */
export const PROP_FOCUS_COLOR = '#2563eb'
export const PROP_FOCUS_STROKE = '#1d4ed8'
export const PROP_FOCUS_BG = '#eff6ff'
export const PROP_ALT_COLOR = '#9ca3af'
export const PROP_ALT_STROKE = '#6b7280'
export const PROP_ALT_BG = '#f3f4f6'
export const PROP_LABEL = '#111827'
export const PROP_LABEL_MUTED = '#374151'

export type ProportionBarLayout = {
  top: number
  height: number
  baselineY: number
}

/** Single unit-bar chart: proportion-width boxes with room for external labels. */
export type UnitProportionLayout = {
  legendY: number
  /** Space above the bar for the p̂ marker/label. */
  statY: number
  barTop: number
  barHeight: number
  /** First line of category / count labels under the bar. */
  labelY: number
}

const LEGEND_H = 16
const STAT_BAND = 20
const COUNT_LABEL_H = 34

/**
 * One visual: a tall bar band with labels above (p̂) and below (counts).
 */
export function unitProportionLayout(
  innerHeight: number,
): UnitProportionLayout {
  const topPad = LEGEND_H + 6
  const bottomPad = COUNT_LABEL_H
  const available = Math.max(40, innerHeight - topPad - bottomPad - STAT_BAND)
  const barHeight = Math.min(available, Math.max(56, available * 0.92))
  const barTop = topPad + STAT_BAND
  return {
    legendY: 12,
    statY: barTop - 8,
    barTop,
    barHeight,
    labelY: barTop + barHeight + 14,
  }
}

/**
 * Compact unit-bar row for two-cat groups.
 */
export function unitGroupRowLayout(
  rowTop: number,
  rowHeight: number,
  showLegend: boolean,
): UnitProportionLayout {
  const legendPad = showLegend ? 14 : 4
  const statBand = 16
  const countH = 28
  const barTop = rowTop + legendPad + statBand
  const barHeight = Math.max(
    28,
    rowHeight - legendPad - statBand - countH - 4,
  )
  return {
    legendY: rowTop + 10,
    statY: barTop - 6,
    barTop,
    barHeight,
    labelY: barTop + barHeight + 12,
  }
}

export function multiUnitGroupRows(
  innerHeight: number,
  nGroups: number,
): { top: number; height: number }[] {
  const gap = 10
  const available = Math.max(60, innerHeight - 4)
  const rowHeight = Math.max(
    72,
    (available - gap * Math.max(0, nGroups - 1)) / Math.max(1, nGroups),
  )
  const total = nGroups * rowHeight + gap * Math.max(0, nGroups - 1)
  let top = Math.max(0, (innerHeight - total) / 2)
  const rows: { top: number; height: number }[] = []
  for (let i = 0; i < nGroups; i++) {
    rows.push({ top, height: rowHeight })
    top += rowHeight + gap
  }
  return rows
}

/** @deprecated Prefer unitProportionLayout. */
export function singleProportionBarLayout(innerHeight: number): ProportionBarLayout {
  const layout = unitProportionLayout(innerHeight)
  return {
    top: layout.barTop,
    height: layout.barHeight,
    baselineY: layout.barTop + layout.barHeight / 2,
  }
}

/** @deprecated Prefer multiUnitGroupRows. */
export function multiProportionBarLayouts(
  innerHeight: number,
  nGroups: number,
): ProportionBarLayout[] {
  return multiUnitGroupRows(innerHeight, nGroups).map((row) => {
    const layout = unitGroupRowLayout(row.top, row.height, false)
    return {
      top: layout.barTop,
      height: layout.barHeight,
      baselineY: layout.barTop + layout.barHeight / 2,
    }
  })
}

/** @deprecated */
export function hybridProportionLayout(
  _innerWidth: number,
  innerHeight: number,
): UnitProportionLayout {
  return unitProportionLayout(innerHeight)
}

/** @deprecated */
export function hybridGroupRowLayout(
  _innerWidth: number,
  rowTop: number,
  rowHeight: number,
): UnitProportionLayout {
  return unitGroupRowLayout(rowTop, rowHeight, true)
}

/** @deprecated */
export function multiHybridGroupRows(
  innerHeight: number,
  nGroups: number,
): { top: number; height: number }[] {
  return multiUnitGroupRows(innerHeight, nGroups)
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

export function proportionChartDescription(
  focusLabel: string,
  altLabel: string,
  nFocus: number,
  nAlt: number,
  prop: number,
): { title: string; desc: string } {
  return {
    title: `Proportion of ${focusLabel}`,
    desc: `Population: ${nFocus} ${focusLabel}, ${nAlt} ${altLabel}. Proportion ${focusLabel} = ${formatProportion(prop)}.`,
  }
}
