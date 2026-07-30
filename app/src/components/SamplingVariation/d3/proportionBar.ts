import * as d3 from 'd3'
import {
  formatProportion,
  multiUnitGroupRows,
  proportionChartDescription,
  proportionFromEncoded,
  PROP_ALT_BG,
  PROP_ALT_STROKE,
  PROP_FOCUS_BG,
  PROP_FOCUS_COLOR,
  PROP_FOCUS_STROKE,
  PROP_LABEL,
  PROP_LABEL_MUTED,
  unitGroupRowLayout,
  unitProportionLayout,
  type UnitProportionLayout,
} from './proportionLayout'
import {
  groupColor,
  sampleAvgDevLabelZone,
  SAMPLE_BAND_ARROW_HEIGHT,
  twoGroupDiffZone,
  type GroupBand,
} from './groupLayout'
import {
  appendAverageDeviationLabel,
  appendPopulationDeviationMarkers,
  appendTwoGroupPopulationDiffDisplay,
} from './sampleStatSummary'
import { STAT_GAP, TRIANGLE_SIZE, TWO_GROUP_DIFF_ZONE_HEIGHT } from './statMarker'
import type { StatKind } from '../types'

export type UnitProportionOptions = {
  classPrefix?: string
  showStat?: boolean
  showLegend?: boolean
  statValue?: number
  groupLabel?: string
  categoryLabels?: [string, string]
  /** When set, use this layout instead of computing from full pane. */
  layout?: UnitProportionLayout
  /**
   * How unit dots are filled.
   * - `outline` — borders only (population / P1)
   * - `filled` — solid category colours (sample / P2)
   */
  dotStyle?: 'outline' | 'filled'
  /** Place the p̂ line at the box split or at an explicit proportion value. */
  statLineAt?: 'split' | 'value'
  /** When false, draw bars/labels/stat only (no dots) — used mid-animation. */
  showDots?: boolean
  /**
   * Parallel to `encoded`: global population / sample-row indices used for
   * `data-index` (needed so multi-group charts can highlight by pop index).
   */
  indexMap?: number[]
}

/** @deprecated Alias kept for callers. */
export type HybridProportionOptions = UnitProportionOptions

type DotPlacement = { x: number; y: number; r: number }

const MIN_CELL = 3
const MAX_CELL = 11
/** Smallest allowed diameter when squeezing into a narrow box. */
const MIN_SQUEEZE_CELL = 1.5
/** Below this width, use a single column of micro-dots. */
const TINY_WIDTH = 10
const MAX_DOTS = 500

/** Per-side (focus / alt) pack inside an exact-width proportion box. */
export type SidePack = {
  width: number
  cols: number
  rows: number
  /** Dot diameter / grid pitch. */
  cell: number
  radius: number
  /** Left inset so the cols×cell block is centred in the box. */
  padLeft: number
  /** True when diameter was reduced to fit a box narrower than the preferred cell. */
  squeezed: boolean
}

export type UnitBarPack = {
  focus: SidePack
  alt: SidePack
  /** Exact box widths (sum to plotWidth). */
  focusWidth: number
  altWidth: number
  barHeight: number
  /** Preferred diameter before per-side squeeze. */
  cell: number
  /** @deprecated Prefer pack.focus.cols / pack.alt.cols */
  focusCols: number
  /** @deprecated Prefer pack.alt.cols */
  altCols: number
  /** Max rows across sides (for callers that expect a shared row count). */
  rows: number
  radius: number
  /** Always 0 — boxes span the full plot width. */
  remainder: number
}

/**
 * Pack `count` dots into a box of exact `width`.
 *
 * cols = floor(width / cell); leftover width is centred as side padding.
 * If width < preferredCell, squeeze (½ / ¼ diameter, or a single micro column
 * when width < {@link TINY_WIDTH}).
 */
export function packSide(
  width: number,
  count: number,
  preferredCell: number,
  maxHeight: number,
): SidePack {
  const empty = (cell: number): SidePack => ({
    width: Math.max(0, width),
    cols: 0,
    rows: 0,
    cell,
    radius: cell / 2,
    padLeft: 0,
    squeezed: false,
  })

  if (count <= 0 || width <= 0 || maxHeight <= 0) {
    return empty(Math.max(MIN_SQUEEZE_CELL, preferredCell))
  }

  const n = Math.min(count, MAX_DOTS)
  let cell = preferredCell
  let squeezed = false
  let forceCols: number | null = null

  if (width < cell) {
    squeezed = true
    if (width < TINY_WIDTH) {
      // Single column of micro-dots.
      cell = Math.max(MIN_SQUEEZE_CELL, Math.min(width, preferredCell / 4))
      forceCols = 1
    } else {
      // Prefer two columns at half-width; fall back to quarter / one col.
      const half = width / 2
      const quarter = width / 4
      if (half >= MIN_SQUEEZE_CELL) {
        cell = half
        forceCols = 2
      } else if (quarter >= MIN_SQUEEZE_CELL) {
        cell = quarter
      } else {
        cell = Math.max(MIN_SQUEEZE_CELL, width)
        forceCols = 1
      }
    }
    cell = Math.min(cell, width)
  }

  let cols =
    forceCols != null
      ? forceCols
      : Math.max(1, Math.floor(width / cell))
  // Keep the grid inside the box if forceCols overshoots.
  if (cols * cell > width + 1e-9) {
    cell = width / cols
  }
  let rows = Math.ceil(n / cols)

  let guard = 0
  while (rows * cell > maxHeight + 1e-9 && cell > MIN_SQUEEZE_CELL && guard++ < 100) {
    cell = Math.max(MIN_SQUEEZE_CELL, cell - 0.25)
    squeezed = true
    if (forceCols != null) {
      cols = forceCols
      if (cols * cell > width + 1e-9) cell = width / cols
    } else {
      cols = Math.max(1, Math.floor(width / cell))
    }
    rows = Math.ceil(n / cols)
  }

  const maxRows = Math.max(1, Math.floor(maxHeight / Math.max(cell, 1e-6)))
  if (rows > maxRows) rows = maxRows

  const padLeft = Math.max(0, (width - cols * cell) / 2)
  return {
    width,
    cols,
    rows,
    cell,
    radius: cell / 2,
    padLeft,
    squeezed,
  }
}

/**
 * Exact proportional box widths; dots pack independently in each box
 * (shared preferred diameter, per-side squeeze / padding).
 */
export function packUnitBars(
  plotWidth: number,
  maxHeight: number,
  nFocus: number,
  nAlt: number,
): UnitBarPack | null {
  const n = nFocus + nAlt
  if (n <= 0 || plotWidth <= 0 || maxHeight <= 0) return null

  const prop = nFocus / n
  const focusWidth = plotWidth * prop
  const altWidth = plotWidth - focusWidth

  const build = (preferred: number): UnitBarPack => {
    const focus = packSide(focusWidth, nFocus, preferred, maxHeight)
    const alt = packSide(altWidth, nAlt, preferred, maxHeight)
    const contentH = Math.max(
      focus.cols > 0 ? focus.rows * focus.cell : 0,
      alt.cols > 0 ? alt.rows * alt.cell : 0,
      1,
    )
    return {
      focus,
      alt,
      focusWidth,
      altWidth,
      barHeight: Math.min(maxHeight, contentH),
      cell: preferred,
      focusCols: focus.cols,
      altCols: alt.cols,
      rows: Math.max(focus.rows, alt.rows, 1),
      radius: preferred / 2,
      remainder: 0,
    }
  }

  for (let preferred = MAX_CELL; preferred >= MIN_CELL - 1e-9; preferred -= 0.25) {
    const pack = build(preferred)
    const need = Math.max(
      pack.focus.cols > 0 ? pack.focus.rows * pack.focus.cell : 0,
      pack.alt.cols > 0 ? pack.alt.rows * pack.alt.cell : 0,
    )
    if (need <= maxHeight + 1e-6) return pack
  }
  return build(MIN_CELL)
}

/**
 * Place dots in a side pack: L→R, T→B, centred horizontally via padLeft and
 * vertically within `barHeight`.
 */
export function placeInSide(
  xStart: number,
  yTop: number,
  side: SidePack,
  count: number,
  barHeight: number,
): DotPlacement[] {
  if (side.cols <= 0 || count <= 0 || side.cell <= 0) return []
  const n = Math.min(count, MAX_DOTS, side.cols * side.rows)
  const r = side.radius
  const gridH = side.rows * side.cell
  const y0 = yTop + Math.max(0, (barHeight - gridH) / 2)
  const positions: DotPlacement[] = []
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / side.cols)
    const col = i % side.cols
    positions.push({
      x: xStart + side.padLeft + col * side.cell + r,
      y: y0 + row * side.cell + r,
      r,
    })
  }
  return positions
}

/**
 * Fill `count` points left→right, top→bottom into a `cols × rows` grid.
 * @deprecated Prefer {@link placeInSide} for proportion boxes.
 */
export function placeInBins(
  xStart: number,
  yTop: number,
  cols: number,
  rows: number,
  cell: number,
  count: number,
): DotPlacement[] {
  if (cols <= 0 || count <= 0) return []
  const n = Math.min(count, MAX_DOTS, cols * rows)
  const r = cell / 2
  const positions: DotPlacement[] = []
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    positions.push({
      x: xStart + col * cell + r,
      y: yTop + row * cell + r,
      r,
    })
  }
  return positions
}

export type UnitBarGeometry = {
  pack: UnitBarPack
  focusX: number
  altX: number
  focusW: number
  altW: number
  bandTop: number
  barH: number
  labelY: number
  statY: number
  splitX: number
  prop: number
  nFocus: number
  nAlt: number
  focusIndices: number[]
  altIndices: number[]
  /** data-index → placement inside the packed bars */
  placements: Map<number, DotPlacement & { isFocus: boolean }>
}

/** Shared packing / placement math used by the drawer and the sample animation. */
export function computeUnitBarGeometry(
  encoded: number[],
  innerWidth: number,
  innerHeight: number,
  xScale: d3.ScaleLinear<number, number>,
  layoutOpt?: UnitProportionLayout,
  indexMap?: number[],
): UnitBarGeometry | null {
  const n = encoded.length
  if (n === 0 || innerWidth <= 0 || innerHeight <= 0) return null

  const focusIndices: number[] = []
  const altIndices: number[] = []
  for (let i = 0; i < encoded.length; i++) {
    const dataIdx = indexMap?.[i] ?? i
    if (encoded[i] === 0) focusIndices.push(dataIdx)
    else altIndices.push(dataIdx)
  }

  const nFocus = focusIndices.length
  const nAlt = altIndices.length
  const prop = nFocus / n
  const layout = layoutOpt ?? unitProportionLayout(innerHeight)

  const x0 = xScale(0)!
  const x1 = xScale(1)!
  const plotWidth = Math.max(0, x1 - x0)
  const pack = packUnitBars(plotWidth, Math.max(0, layout.barHeight), nFocus, nAlt)
  if (!pack) return null

  // Boxes span the full [0, 1] axis exactly — split matches the count proportion.
  const focusX = x0
  const focusW = pack.focusWidth
  const altX = x0 + focusW
  const altW = pack.altWidth
  const barH = pack.barHeight
  const bandTop =
    layout.barTop + Math.max(0, (layout.barHeight - barH) / 2)

  const focusPlaces = placeInSide(focusX, bandTop, pack.focus, nFocus, barH)
  const altPlaces = placeInSide(altX, bandTop, pack.alt, nAlt, barH)

  const placements = new Map<number, DotPlacement & { isFocus: boolean }>()
  for (let i = 0; i < focusPlaces.length; i++) {
    const idx = focusIndices[i]!
    placements.set(idx, { ...focusPlaces[i]!, isFocus: true })
  }
  for (let i = 0; i < altPlaces.length; i++) {
    const idx = altIndices[i]!
    placements.set(idx, { ...altPlaces[i]!, isFocus: false })
  }

  return {
    pack,
    focusX,
    altX,
    focusW,
    altW,
    bandTop,
    barH,
    labelY: bandTop + barH + 14,
    statY: bandTop - 8,
    splitX: altX,
    prop,
    nFocus,
    nAlt,
    focusIndices,
    altIndices,
    placements,
  }
}

/**
 * Pack dots into a rectangle (legacy helper / tests).
 */
export function dotGridInRect(
  xStart: number,
  yTop: number,
  width: number,
  height: number,
  count: number,
  fixedRadius?: number,
): DotPlacement[] {
  if (count <= 0 || width <= 0 || height <= 0) return []
  const cell = fixedRadius != null ? fixedRadius * 2 : Math.min(MAX_CELL, width)
  const cols = Math.max(1, Math.floor(width / cell))
  const rows = Math.max(1, Math.ceil(count / cols))
  const fitCell = Math.min(cell, height / rows, width / cols)
  return placeInBins(xStart, yTop, cols, rows, fitCell, count)
}

function ensureAltHatch(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  patternId: string,
) {
  let defs = g.select<SVGDefsElement>('defs')
  if (defs.empty()) {
    defs = g.append('defs')
  }
  if (!defs.select(`#${patternId}`).empty()) return
  const pattern = defs
    .append('pattern')
    .attr('id', patternId)
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 6)
    .attr('height', 6)
  pattern
    .append('rect')
    .attr('width', 6)
    .attr('height', 6)
    .attr('fill', PROP_ALT_BG)
  pattern
    .append('path')
    .attr('d', 'M0,6 L6,0')
    .attr('stroke', PROP_ALT_STROKE)
    .attr('stroke-width', 1)
    .attr('stroke-opacity', 0.35)
}

function drawSegmentDots(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  placements: DotPlacement[],
  indices: number[],
  fill: string,
  stroke: string,
  classPrefix: string,
  style: 'outline' | 'filled',
  isFocus: boolean,
) {
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i]!
    const outlineStroke = p.r < 2.5 ? Math.max(0.4, p.r * 0.45) : 1.5
    const circle = g
      .append('circle')
      .attr('class', `${classPrefix}-dot`)
      .attr('data-index', indices[i] ?? i)
      .attr('data-focus', isFocus ? '1' : '0')
      .attr('cx', p.x)
      .attr('cy', p.y)
      .attr('r', p.r)
      .attr('stroke', stroke)
      .attr('stroke-width', style === 'outline' ? outlineStroke : 0.5)
    if (style === 'outline') {
      circle.attr('fill', 'none').attr('fill-opacity', 1)
    } else {
      circle.attr('fill', fill).attr('fill-opacity', 0.95)
    }
  }
}

/** Reset all unit dots in a proportion chart to outline-only. */
export function resetProportionDotsOutline(parent: SVGGElement) {
  d3.select(parent)
    .selectAll<SVGCircleElement, unknown>('circle[data-index]')
    .attr('fill', 'none')
    .attr('fill-opacity', 1)
    .attr('stroke-width', function () {
      const r = Number(this.getAttribute('r') ?? 4)
      return r < 2.5 ? Math.max(0.4, r * 0.45) : 1.5
    })
}

/** Fill sampled population dots in place (P1 highlight). */
export function fillProportionSampleDots(
  parent: SVGGElement,
  sampleIndices: number[],
  encoded: number[],
) {
  const g = d3.select(parent)
  for (const idx of sampleIndices) {
    const isFocus = encoded[idx] === 0
    g.select<SVGCircleElement>(`circle[data-index="${idx}"]`)
      .attr('fill', isFocus ? PROP_FOCUS_COLOR : PROP_ALT_STROKE)
      .attr('fill-opacity', 0.95)
      .attr('stroke', isFocus ? PROP_FOCUS_STROKE : PROP_ALT_STROKE)
      .attr('stroke-width', 0.5)
      .raise()
  }
}

/** Read current local (cx, cy, r) for a proportion dot by data-index. */
export function readProportionDotPosition(
  parent: SVGGElement,
  index: number,
): DotPlacement | null {
  const node = d3
    .select(parent)
    .select<SVGCircleElement>(`circle[data-index="${index}"]`)
    .node()
  if (!node) return null
  return {
    x: Number(node.getAttribute('cx')),
    y: Number(node.getAttribute('cy')),
    r: Number(node.getAttribute('r')),
  }
}

function clearUnitBar(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  classPrefix: string,
) {
  g.selectAll(`[class^="${classPrefix}-"]`).remove()
  g.selectAll(`.${classPrefix}-dot`).remove()
  g.selectAll(`.${classPrefix}-bar`).remove()
  g.selectAll(`.${classPrefix}-stat-line`).remove()
  g.selectAll(`.${classPrefix}-stat-text`).remove()
  g.selectAll(`.${classPrefix}-count`).remove()
  g.selectAll(`.${classPrefix}-group-label`).remove()
  g.selectAll(`.${classPrefix}-cat-label`).remove()
  g.selectAll(`.${classPrefix}-legend`).remove()
  g.selectAll(`.${classPrefix}-col-bg`).remove()
  g.selectAll(`.${classPrefix}-col-label`).remove()
  g.selectAll(`.${classPrefix}-strip`).remove()
  g.selectAll(`.${classPrefix}-a11y`).remove()
  g.selectAll('title').remove()
  g.selectAll('desc').remove()
}

function placeSegmentLabel(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  classPrefix: string,
  x: number,
  width: number,
  labelY: number,
  label: string,
  count: number,
  innerWidth: number,
) {
  const cx = x + width / 2
  let anchor: 'start' | 'middle' | 'end' = 'middle'
  let tx = cx
  if (width < 56) {
    // Narrow segment: keep text readable without centering into the neighbour.
    if (cx < innerWidth * 0.35) {
      anchor = 'start'
      tx = Math.max(2, x)
    } else if (cx > innerWidth * 0.65) {
      anchor = 'end'
      tx = Math.min(innerWidth - 2, x + width)
    }
  }

  g.append('text')
    .attr('class', `${classPrefix}-col-label`)
    .attr('x', tx)
    .attr('y', labelY)
    .attr('text-anchor', anchor)
    .attr('font-size', 12)
    .attr('font-weight', 700)
    .attr('fill', PROP_LABEL)
    .text(label)
  g.append('text')
    .attr('class', `${classPrefix}-count`)
    .attr('x', tx)
    .attr('y', labelY + 14)
    .attr('text-anchor', anchor)
    .attr('font-size', 12)
    .attr('fill', PROP_LABEL_MUTED)
    .text(`n = ${count}`)
}

/**
 * Single visual: two adjacent boxes sized by proportion, with unit dots
 * packed in horizontal rows inside. Labels and p̂ sit outside the boxes.
 */
export function drawHybridProportionChart(
  parent: SVGGElement,
  encoded: number[],
  innerWidth: number,
  innerHeight: number,
  xScale: d3.ScaleLinear<number, number>,
  options: UnitProportionOptions = {},
) {
  const {
    classPrefix = 'prop',
    showStat = true,
    showLegend = true,
    statValue,
    groupLabel,
    categoryLabels = ['Focus', 'Other'],
    layout: layoutOpt,
    dotStyle = 'outline',
    statLineAt = 'split',
    showDots = true,
    indexMap,
  } = options

  const g = d3.select(parent)
  clearUnitBar(g, classPrefix)

  const n = encoded.length
  if (n === 0 || innerWidth <= 0 || innerHeight <= 0) return

  const geom = computeUnitBarGeometry(
    encoded,
    innerWidth,
    innerHeight,
    xScale,
    layoutOpt,
    indexMap,
  )
  if (!geom) return

  const {
    pack,
    focusX,
    altX,
    focusW,
    altW,
    bandTop,
    barH,
    labelY,
    statY,
    splitX,
    prop,
    nFocus,
    nAlt,
    focusIndices,
    altIndices,
  } = geom

  const lineValue = statValue ?? prop
  const focusLabel = categoryLabels[0] ?? 'Focus'
  const altLabel = categoryLabels[1] ?? 'Other'
  const layout = layoutOpt ?? unitProportionLayout(innerHeight)
  const hatchId = `${classPrefix}-alt-hatch`
  ensureAltHatch(g, hatchId)

  const a11y = proportionChartDescription(
    focusLabel,
    altLabel,
    nFocus,
    nAlt,
    Number.isFinite(lineValue) ? lineValue : prop,
  )
  g.attr('role', 'img').attr('aria-label', a11y.desc)
  g.append('title').attr('class', `${classPrefix}-a11y`).text(a11y.title)
  g.append('desc').attr('class', `${classPrefix}-a11y`).text(a11y.desc)

  if (groupLabel) {
    g.append('text')
      .attr('class', `${classPrefix}-group-label`)
      .attr('x', innerWidth)
      .attr('y', layout.legendY)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'central')
      .attr('font-size', 11)
      .attr('font-weight', 700)
      .attr('fill', PROP_LABEL_MUTED)
      .text(groupLabel)
  }

  if (showLegend) {
    const legend = g
      .append('g')
      .attr('class', `${classPrefix}-legend`)
      .attr('transform', `translate(0, ${layout.legendY})`)

    legend
      .append('circle')
      .attr('cx', 5)
      .attr('cy', 0)
      .attr('r', 4)
      .attr('fill', 'none')
      .attr('stroke', PROP_FOCUS_STROKE)
      .attr('stroke-width', 1.5)
    legend
      .append('text')
      .attr('x', 12)
      .attr('y', 0)
      .attr('dominant-baseline', 'central')
      .attr('font-size', 11)
      .attr('fill', PROP_LABEL)
      .text(focusLabel)

    const altLegendX = Math.min(innerWidth * 0.42, 12 + focusLabel.length * 7 + 28)
    legend
      .append('circle')
      .attr('cx', altLegendX)
      .attr('cy', 0)
      .attr('r', 4)
      .attr('fill', 'none')
      .attr('stroke', PROP_ALT_STROKE)
      .attr('stroke-width', 1.5)
    legend
      .append('text')
      .attr('x', altLegendX + 7)
      .attr('y', 0)
      .attr('dominant-baseline', 'central')
      .attr('font-size', 11)
      .attr('fill', PROP_LABEL)
      .text(altLabel)
  }

  if (focusW > 0) {
    g.append('rect')
      .attr('class', `${classPrefix}-bar`)
      .attr('x', focusX)
      .attr('y', bandTop)
      .attr('width', focusW)
      .attr('height', barH)
      .attr('rx', 2)
      .attr('fill', PROP_FOCUS_BG)
      .attr('stroke', PROP_FOCUS_STROKE)
      .attr('stroke-width', 1.25)
  }
  if (altW > 0) {
    g.append('rect')
      .attr('class', `${classPrefix}-bar`)
      .attr('x', altX)
      .attr('y', bandTop)
      .attr('width', altW)
      .attr('height', barH)
      .attr('rx', 2)
      .attr('fill', `url(#${hatchId})`)
      .attr('stroke', PROP_ALT_STROKE)
      .attr('stroke-width', 1.25)
  }

  if (showDots) {
    drawSegmentDots(
      g,
      placeInSide(focusX, bandTop, pack.focus, nFocus, barH),
      focusIndices,
      PROP_FOCUS_COLOR,
      PROP_FOCUS_STROKE,
      classPrefix,
      dotStyle,
      true,
    )
    drawSegmentDots(
      g,
      placeInSide(altX, bandTop, pack.alt, nAlt, barH),
      altIndices,
      PROP_ALT_STROKE,
      PROP_ALT_STROKE,
      classPrefix,
      dotStyle,
      false,
    )
  }

  placeSegmentLabel(
    g,
    classPrefix,
    focusX,
    focusW,
    labelY,
    focusLabel,
    nFocus,
    innerWidth,
  )
  placeSegmentLabel(
    g,
    classPrefix,
    altX,
    altW,
    labelY,
    altLabel,
    nAlt,
    innerWidth,
  )

  const trueProp = Number.isFinite(lineValue) ? lineValue : prop
  if (showStat && Number.isFinite(trueProp)) {
    const lineX = statLineAt === 'value' ? xScale(trueProp)! : splitX
    g.append('line')
      .attr('class', `${classPrefix}-stat-line`)
      .attr('x1', lineX)
      .attr('x2', lineX)
      .attr('y1', bandTop - 6)
      .attr('y2', bandTop + barH + 6)
      .attr('stroke', PROP_LABEL)
      .attr('stroke-width', 2)

    const label = `p̂ = ${formatProportion(trueProp)}`
    let labelX = lineX
    let anchor: 'start' | 'end' | 'middle' = 'middle'
    if (lineX < 48) {
      labelX = lineX + 6
      anchor = 'start'
    } else if (lineX > innerWidth - 48) {
      labelX = lineX - 6
      anchor = 'end'
    }
    g.append('text')
      .attr('class', `${classPrefix}-stat-text`)
      .attr('x', labelX)
      .attr('y', statY)
      .attr('text-anchor', anchor)
      .attr('font-size', 12)
      .attr('font-weight', 700)
      .attr('fill', PROP_LABEL)
      .text(label)
  }
}

/** Clear unit / legacy proportion marks (including two-group diff overlays). */
export function removeProportionBar(parent: SVGGElement, classPrefix = 'prop') {
  const g = d3.select(parent)
  clearUnitBar(g, classPrefix)
  g.selectAll('.prop-group').remove()
  g.selectAll(`[class*="${classPrefix}"]`).remove()
  // two_cat k=2 population summary — lives on the pane root, not under prop-*
  g.selectAll(
    '.pop-stat-drop-line, .pop-stat-drop, .pop-diff-arrow, .pop-diff-label, .pop-avg-dev-label, .pop-grand-mean, .pop-dev-arrow',
  ).remove()
}

/** Build GroupBand geometry aligned with multi-group proportion rows (for diff UI). */
export function proportionGroupBands(
  innerHeight: number,
  groupLevels: string[],
  bottomReserve = 0,
): GroupBand[] {
  const rows = multiUnitGroupRows(innerHeight, groupLevels.length, bottomReserve)
  return groupLevels.map((label, index) => {
    const row = rows[index]!
    const layout = unitGroupRowLayout(row.top, row.height, index === 0)
    return {
      index,
      label,
      top: row.top,
      height: row.height,
      dotAreaHeight: row.height,
      baselineY: layout.barTop + layout.barHeight,
      statZoneTop: layout.statY - STAT_GAP - TRIANGLE_SIZE,
      statZoneHeight: STAT_GAP + TRIANGLE_SIZE + 8,
      boxTop: row.top + row.height,
      boxAreaHeight: 0,
      color: groupColor(index),
    }
  })
}

/**
 * K≥3 population / shared layout: unit chart per row + deviation-arrow strip,
 * with average-deviation label zone at the bottom.
 */
export function proportionAvgDevBands(
  innerHeight: number,
  groupLevels: string[],
): GroupBand[] {
  const labelZone = sampleAvgDevLabelZone(innerHeight)
  const rows = multiUnitGroupRows(labelZone.top, groupLevels.length, 0)
  return groupLevels.map((label, index) => {
    const row = rows[index]!
    const arrowH = Math.min(
      SAMPLE_BAND_ARROW_HEIGHT,
      Math.max(14, Math.floor(row.height * 0.28)),
    )
    const dotAreaHeight = Math.max(28, row.height - arrowH)
    return {
      index,
      label,
      top: row.top,
      height: row.height,
      dotAreaHeight,
      baselineY: row.top + dotAreaHeight,
      statZoneTop: row.top + dotAreaHeight,
      statZoneHeight: row.height - dotAreaHeight,
      boxTop: row.top + row.height,
      boxAreaHeight: 0,
      color: groupColor(index),
    }
  })
}

export function drawMultiGroupProportionBars(
  parent: SVGGElement,
  encoded: number[],
  populationGroup: number[],
  groupLevels: string[],
  _barLayouts: unknown,
  xScale: d3.ScaleLinear<number, number>,
  innerWidth: number,
  groupStats: number[],
  categoryLabels: [string, string],
  showStat = true,
  innerHeight?: number,
  options: {
    /** Population difference / ratio arrow under the group rows (k=2). */
    showDiffSummary?: boolean
    /** Average-deviation arrows + label (k≥3). */
    showAvgDevSummary?: boolean
    /** Overall focus proportion (defaults to pool proportion of `encoded`). */
    grandProp?: number
    statKind?: StatKind
    dotStyle?: 'outline' | 'filled'
  } = {},
) {
  removeProportionBar(parent, 'prop')
  const g = d3.select(parent)

  const height = innerHeight ?? 200
  const nGroups = groupLevels.length
  const showDiff =
    options.showDiffSummary === true &&
    showStat &&
    nGroups === 2 &&
    groupStats.length >= 2
  const showAvgDev =
    options.showAvgDevSummary === true &&
    showStat &&
    nGroups >= 3 &&
    groupStats.length >= 3

  const bands = showAvgDev
    ? proportionAvgDevBands(height, groupLevels)
    : proportionGroupBands(
        height,
        groupLevels,
        showDiff ? TWO_GROUP_DIFF_ZONE_HEIGHT : 0,
      )

  for (let gi = 0; gi < nGroups; gi++) {
    const groupEncoded: number[] = []
    const indexMap: number[] = []
    for (let i = 0; i < encoded.length; i++) {
      if (populationGroup[i] === gi) {
        groupEncoded.push(encoded[i]!)
        indexMap.push(i)
      }
    }
    const band = bands[gi]
    if (!band) continue
    const chartH = showAvgDev ? band.dotAreaHeight : band.height
    const layout = unitGroupRowLayout(band.top, chartH, gi === 0)
    const subG = g.append('g').attr('class', 'prop-group')
    drawHybridProportionChart(
      subG.node()!,
      groupEncoded,
      innerWidth,
      chartH,
      xScale,
      {
        classPrefix: `prop-g${gi}`,
        showLegend: gi === 0,
        showStat,
        statValue: groupStats[gi],
        groupLabel: groupLevels[gi],
        categoryLabels,
        layout,
        indexMap,
        dotStyle: options.dotStyle ?? 'outline',
      },
    )
  }

  if (showDiff) {
    appendTwoGroupPopulationDiffDisplay(
      parent,
      xScale,
      groupStats,
      bands,
      twoGroupDiffZone(height),
      'mean',
      (options.statKind === 'ratio' ? 'ratio' : 'difference') as StatKind,
      'p̂',
    )
  } else if (showAvgDev) {
    const grand =
      options.grandProp != null && Number.isFinite(options.grandProp)
        ? options.grandProp
        : proportionFromEncoded(encoded, 0)
    if (Number.isFinite(grand)) {
      const labelZone = sampleAvgDevLabelZone(height)
      g.append('line')
        .attr('class', 'pop-grand-mean')
        .attr('x1', xScale(grand)!)
        .attr('x2', xScale(grand)!)
        .attr('y1', 0)
        .attr('y2', labelZone.top)
        .attr('stroke', '#111827')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '5,3')

      appendPopulationDeviationMarkers(
        parent,
        xScale,
        groupStats,
        grand,
        bands,
      )
      appendAverageDeviationLabel(
        parent,
        innerWidth,
        labelZone,
        groupStats,
        grand,
      )
    }
  }
}

/** @deprecated Use drawHybridProportionChart */
export function drawProportionBar(
  parent: SVGGElement,
  encoded: number[],
  _layout: { top: number; height: number },
  xScale: d3.ScaleLinear<number, number>,
  innerWidth: number,
  options: {
    classPrefix?: string
    showLabels?: boolean
    showStatLine?: boolean
    showCounts?: boolean
    statValue?: number
    groupLabel?: string
    categoryLabels?: [string, string]
  } = {},
) {
  const innerHeight = Math.max(120, _layout.top + _layout.height + 40)
  drawHybridProportionChart(parent, encoded, innerWidth, innerHeight, xScale, {
    classPrefix: options.classPrefix,
    showStat: options.showStatLine,
    showLegend: options.showLabels !== false,
    statValue: options.statValue,
    groupLabel: options.groupLabel,
    categoryLabels: options.categoryLabels,
  })
}
