import * as d3 from 'd3'

export const STAT_GAP = 6
export const TRIANGLE_SIZE = 8
export const STAT_LABEL_HEIGHT = 16
export const STAT_LABEL_GAP = 4

export const STAT_MARKER_RED = '#dc2626'

/** Space reserved above the x-axis for the two-group difference display. */
export const TWO_GROUP_DIFF_ZONE_HEIGHT = 36

/** P2 sample pane: vertical space under dotplot for mean marker + barcode lines. */
export const SAMPLE_MEAN_STRIP_HEIGHT = 42

export function statZoneHeight(showStatLabel: boolean): number {
  return (
    STAT_GAP +
    TRIANGLE_SIZE +
    (showStatLabel ? STAT_LABEL_GAP + STAT_LABEL_HEIGHT : 4)
  )
}

export function formatStatValue(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1000) return value.toFixed(0)
  if (abs >= 100) return value.toFixed(1)
  if (abs >= 10) return value.toFixed(2)
  return value.toFixed(3)
}

export function statSymbol(statistic: 'mean' | 'median'): string {
  return statistic === 'median' ? 'x\u0303' : 'x\u0304'
}

export function statLabelText(
  value: number,
  statistic: 'mean' | 'median' = 'mean',
): string {
  return `${statSymbol(statistic)} = ${formatStatValue(value)}`
}

export function removeStatMarkers(parent: SVGGElement, prefix = 'pop-stat') {
  const sel = d3.select(parent)
  sel.selectAll(`.${prefix}-triangle`).remove()
  sel.selectAll(`.${prefix}-label`).remove()
  sel.selectAll(`.${prefix}-line`).remove()
}

/** Up-pointing triangle with tip at (x, tipY). */
export function appendUpTriangle(
  parent: SVGGElement,
  x: number,
  tipY: number,
  size: number,
  color: string,
  className: string,
) {
  const halfBase = size * 0.65
  const baseY = tipY + size
  d3.select(parent)
    .append('path')
    .attr('class', className)
    .attr(
      'd',
      `M${x},${tipY} L${x - halfBase},${baseY} L${x + halfBase},${baseY} Z`,
    )
    .attr('fill', color)
}

export function appendStatMarker(
  parent: SVGGElement,
  x: number,
  statZoneTop: number,
  value: number,
  options: {
    color?: string
    showLabel?: boolean
    statistic?: 'mean' | 'median'
    classPrefix?: string
  } = {},
) {
  const {
    color = STAT_MARKER_RED,
    showLabel = false,
    statistic = 'mean',
    classPrefix = 'pop-stat',
  } = options
  const tipY = statZoneTop + STAT_GAP
  appendUpTriangle(parent, x, tipY, TRIANGLE_SIZE, color, `${classPrefix}-triangle`)

  if (showLabel) {
    d3.select(parent)
      .append('text')
      .attr('class', `${classPrefix}-label text-sm fill-gray-700`)
      .attr('x', x)
      .attr('y', tipY + TRIANGLE_SIZE + STAT_LABEL_GAP + STAT_LABEL_HEIGHT - 3)
      .attr('text-anchor', 'middle')
      .text(statLabelText(value, statistic))
  }
}
