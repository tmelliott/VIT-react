import type { ScaleLinear } from 'd3'
import * as d3 from 'd3'
import { DIST_DOT_COLOR, DIST_DOT_OPACITY } from './paneStyle'

export type DistDotPosition = { x: number; y: number }
export type DistLayout = Map<number, DistDotPosition>

function fitStackToBand(
  ys: Map<number, number>,
  floorY: number,
  plotBoundY: number,
  r: number,
): void {
  if (ys.size === 0) return
  let top = Infinity
  for (const y of ys.values()) {
    top = Math.min(top, y - r)
  }
  const pileHeight = floorY + r - top
  const available = floorY + r - (plotBoundY + r)
  if (pileHeight <= available || pileHeight <= 0 || available <= 0) return
  const scale = available / pileHeight
  for (const [key, y] of ys) {
    ys.set(key, floorY - (floorY - y) * scale)
  }
}

function fitStackToBandHorizontal(
  xs: Map<number, number>,
  floorX: number,
  plotBoundX: number,
  r: number,
): void {
  if (xs.size === 0) return
  let right = -Infinity
  for (const x of xs.values()) {
    right = Math.max(right, x + r)
  }
  const pileWidth = right - (floorX - r)
  const available = plotBoundX - r - (floorX - r)
  if (pileWidth <= available || pileWidth <= 0 || available <= 0) return
  const scale = available / pileWidth
  for (const [key, x] of xs) {
    xs.set(key, floorX + (x - floorX) * scale)
  }
}

/**
 * Bin-stack y-positions upward from a floor row (mini dot plot / axis pile).
 * Items are processed in order so earlier entries sit closer to the floor.
 */
export function stackDotYsByBin(
  items: Array<{ key: number; x: number }>,
  floorY: number,
  dotRadius: number,
  xRange: [number, number],
  plotBoundY: number,
): Map<number, number> {
  const r = dotRadius - 1
  const dotSize = r * 2
  const [rangeMin, rangeMax] = xRange
  const span = Math.abs(rangeMax - rangeMin)
  const nBins = Math.max(1, Math.ceil(span / dotSize))
  const stackCounts = new Map<number, number>()
  const ys = new Map<number, number>()

  for (const { key, x } of items) {
    if (!Number.isFinite(x)) continue
    const binIdx = Math.max(
      0,
      Math.min(nBins - 1, Math.floor((x - rangeMin) / dotSize)),
    )
    const stack = (stackCounts.get(binIdx) ?? 0) + 1
    stackCounts.set(binIdx, stack)
    ys.set(key, floorY - (stack - 1) * dotSize)
  }

  fitStackToBand(ys, floorY, plotBoundY, r)
  return ys
}

/**
 * Bin-stack x-positions rightward from a left-hand axis (horizontal dot plot).
 * Exact mirror of {@link stackDotYsByBin}: bin by the value-axis pixel, keep
 * that axis continuous, stack along the other axis.
 */
export function stackDotXsByBin(
  items: Array<{ key: number; y: number }>,
  floorX: number,
  dotRadius: number,
  yRange: [number, number],
  plotBoundX: number,
): Map<number, number> {
  const r = dotRadius - 1
  const dotSize = r * 2
  // Normalise inverted ranges (e.g. distY.range() === [height, 0]).
  const rangeMin = Math.min(yRange[0], yRange[1])
  const rangeMax = Math.max(yRange[0], yRange[1])
  const span = Math.abs(rangeMax - rangeMin)
  const nBins = Math.max(1, Math.ceil(span / dotSize))
  const stackCounts = new Map<number, number>()
  const xs = new Map<number, number>()

  for (const { key, y } of items) {
    if (!Number.isFinite(y)) continue
    const binIdx = Math.max(
      0,
      Math.min(nBins - 1, Math.floor((y - rangeMin) / dotSize)),
    )
    const stack = (stackCounts.get(binIdx) ?? 0) + 1
    stackCounts.set(binIdx, stack)
    xs.set(key, floorX + (stack - 1) * dotSize)
  }

  fitStackToBandHorizontal(xs, floorX, plotBoundX, r)
  return xs
}

/**
 * Bin-stack y-positions in replicate order (matches legacy heap_dist_y).
 * Replicate i gets the stack slot for its bin among reps 0..i, so animating
 * in order never shows a dot above empty space.
 */
export function precomputeDistLayout(
  stats: number[],
  distX: ScaleLinear<number, number>,
  distBaselineY: number,
  dotRadius: number,
): DistLayout {
  const r = dotRadius - 1
  const plotTopY = dotRadius
  const items: Array<{ key: number; x: number }> = []

  for (let i = 0; i < stats.length; i++) {
    const stat = stats[i]!
    if (!Number.isFinite(stat)) continue
    const x = distX(stat)
    if (x == null || !Number.isFinite(x)) continue
    items.push({ key: i, x })
  }

  const ys = stackDotYsByBin(
    items,
    distBaselineY,
    dotRadius,
    distX.range() as [number, number],
    plotTopY,
  )
  const layout: DistLayout = new Map()
  for (const { key, x } of items) {
    const y = ys.get(key)
    if (y != null) layout.set(key, { x, y })
  }
  return layout
}

/**
 * Horizontal sampling-distribution layout — same algorithm as
 * {@link precomputeDistLayout}, rotated: y keeps the real slope pixel, x stacks
 * by y-bin from the left-hand axis.
 */
export function precomputeHorizontalDistLayout(
  stats: number[],
  distY: ScaleLinear<number, number>,
  distBaselineX: number,
  dotRadius: number,
  plotBoundX: number,
): DistLayout {
  const items: Array<{ key: number; y: number }> = []

  for (let i = 0; i < stats.length; i++) {
    const stat = stats[i]!
    if (!Number.isFinite(stat)) continue
    const y = distY(stat)
    if (y == null || !Number.isFinite(y)) continue
    items.push({ key: i, y })
  }

  const xs = stackDotXsByBin(
    items,
    distBaselineX,
    dotRadius,
    distY.range() as [number, number],
    plotBoundX,
  )
  const layout: DistLayout = new Map()
  for (const { key, y } of items) {
    const x = xs.get(key)
    if (x != null) layout.set(key, { x, y })
  }
  return layout
}

export function distTarget(
  layout: DistLayout,
  replicateIndex: number,
  distX: ScaleLinear<number, number>,
  sampleStat: number,
  distBaselineY: number,
): DistDotPosition | null {
  if (!Number.isFinite(sampleStat)) return null
  const cached = layout.get(replicateIndex)
  if (cached) return cached
  const x = distX(sampleStat)
  if (x == null || !Number.isFinite(x)) return null
  return { x, y: distBaselineY }
}

export function horizontalDistTarget(
  layout: DistLayout,
  replicateIndex: number,
  distY: ScaleLinear<number, number>,
  sampleStat: number,
  distBaselineX: number,
): DistDotPosition | null {
  if (!Number.isFinite(sampleStat)) return null
  const cached = layout.get(replicateIndex)
  if (cached) return cached
  const y = distY(sampleStat)
  if (y == null || !Number.isFinite(y)) return null
  return { x: distBaselineX, y }
}

export function appendDistDotElement(
  distGroup: SVGGElement,
  replicateIndex: number,
  sampleStat: number,
  x: number,
  y: number,
  dotRadius: number,
): void {
  if (!Number.isFinite(sampleStat) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return
  }
  const existing = d3
    .select(distGroup)
    .select<SVGCircleElement>(`.dist-dot[data-index="${replicateIndex}"]`)
  if (!existing.empty()) {
    existing.attr('cx', x).attr('cy', y)
    return
  }

  d3.select(distGroup)
    .append('circle')
    .attr('class', 'dist-dot')
    .attr('data-index', replicateIndex)
    .attr('data-stat', sampleStat)
    .attr('cx', x)
    .attr('cy', y)
    .attr('r', dotRadius - 1)
    .attr('fill', DIST_DOT_COLOR)
    .attr('fill-opacity', DIST_DOT_OPACITY)
}

/** Sort reps so lower (axis-near) dots are placed before higher ones in a batch. */
export function sortRepsByDistY<T extends { replicateIndex: number }>(
  reps: T[],
  layout: DistLayout,
): T[] {
  return [...reps].sort((a, b) => {
    const ya = layout.get(a.replicateIndex)?.y ?? 0
    const yb = layout.get(b.replicateIndex)?.y ?? 0
    return yb - ya
  })
}

/** Sort reps so axis-near (left) dots are placed before farther ones in a batch. */
export function sortRepsByDistX<T extends { replicateIndex: number }>(
  reps: T[],
  layout: DistLayout,
): T[] {
  return [...reps].sort((a, b) => {
    const xa = layout.get(a.replicateIndex)?.x ?? 0
    const xb = layout.get(b.replicateIndex)?.x ?? 0
    return xa - xb
  })
}
