import * as d3 from 'd3'
import {
  formatProportion,
  multiUnitGroupRows,
  proportionChartDescription,
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

export type UnitProportionOptions = {
  classPrefix?: string
  showStat?: boolean
  showLegend?: boolean
  statValue?: number
  groupLabel?: string
  categoryLabels?: [string, string]
  /** When set, use this layout instead of computing from full pane. */
  layout?: UnitProportionLayout
}

/** @deprecated Alias kept for callers. */
export type HybridProportionOptions = UnitProportionOptions

type DotPlacement = { x: number; y: number; r: number }

const MIN_CELL = 3
const MAX_CELL = 11
const MAX_DOTS = 500

export type UnitBarPack = {
  /** Bin / point pitch (width and height of one cell). */
  cell: number
  focusCols: number
  altCols: number
  /** Shared row count — both bars use this height. */
  rows: number
  focusWidth: number
  altWidth: number
  barHeight: number
  radius: number
  /** Unused strip on the right after quantizing to whole bins. */
  remainder: number
}

/**
 * Quantize bar widths to whole bins from the raw proportion, then grow a
 * shared row count until every point fits (L→R, T→B in each bar).
 *
 * Same height is natural when widths ∝ counts: both sides need ≈ n / totalCols
 * rows; we take the max so rounding never leaves unequal boxes.
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
  const showFocus = nFocus > 0
  const showAlt = nAlt > 0

  const tryCell = (cell: number): UnitBarPack | null => {
    const totalCols = Math.floor(plotWidth / cell)
    if (totalCols < (showFocus && showAlt ? 2 : 1)) return null

    let focusCols: number
    let altCols: number
    if (!showFocus) {
      focusCols = 0
      altCols = totalCols
    } else if (!showAlt) {
      focusCols = totalCols
      altCols = 0
    } else {
      focusCols = Math.round(prop * totalCols)
      focusCols = Math.max(1, Math.min(totalCols - 1, focusCols))
      altCols = totalCols - focusCols
    }

    const rowsFocus =
      focusCols > 0 ? Math.ceil(Math.min(nFocus, MAX_DOTS) / focusCols) : 0
    const rowsAlt =
      altCols > 0 ? Math.ceil(Math.min(nAlt, MAX_DOTS) / altCols) : 0
    const rows = Math.max(rowsFocus, rowsAlt, 1)
    if (rows * cell > maxHeight) return null

    return {
      cell,
      focusCols,
      altCols,
      rows,
      focusWidth: focusCols * cell,
      altWidth: altCols * cell,
      barHeight: rows * cell,
      radius: cell / 2,
      remainder: plotWidth - totalCols * cell,
    }
  }

  // Largest comfortable bin that fits the height budget.
  for (let cell = MAX_CELL; cell >= MIN_CELL - 1e-9; cell -= 0.25) {
    const pack = tryCell(cell)
    if (pack) return pack
  }
  return tryCell(MIN_CELL)
}

/**
 * Fill `count` points left→right, top→bottom into a `cols × rows` grid.
 */
function placeInBins(
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
  openRing: boolean,
) {
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i]!
    const circle = g
      .append('circle')
      .attr('class', `${classPrefix}-dot`)
      .attr('data-index', indices[i] ?? i)
      .attr('cx', p.x)
      .attr('cy', p.y)
      .attr('r', p.r)
      .attr('stroke', stroke)
      .attr('stroke-width', openRing ? 1.2 : 0.5)
    if (openRing) {
      circle.attr('fill', '#fff').attr('fill-opacity', 1)
    } else {
      circle.attr('fill', fill).attr('fill-opacity', 0.95)
    }
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
  } = options

  const g = d3.select(parent)
  clearUnitBar(g, classPrefix)

  const n = encoded.length
  if (n === 0 || innerWidth <= 0 || innerHeight <= 0) return

  const focusIndices: number[] = []
  const altIndices: number[] = []
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === 0) focusIndices.push(i)
    else altIndices.push(i)
  }

  const nFocus = focusIndices.length
  const nAlt = altIndices.length
  const prop = nFocus / n
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
      .attr('fill', PROP_FOCUS_COLOR)
      .attr('stroke', PROP_FOCUS_STROKE)
      .attr('stroke-width', 0.5)
    legend
      .append('text')
      .attr('x', 12)
      .attr('y', 0)
      .attr('dominant-baseline', 'central')
      .attr('font-size', 11)
      .attr('fill', PROP_LABEL)
      .text(focusLabel)

    const altX = Math.min(innerWidth * 0.42, 12 + focusLabel.length * 7 + 28)
    legend
      .append('circle')
      .attr('cx', altX)
      .attr('cy', 0)
      .attr('r', 4)
      .attr('fill', '#fff')
      .attr('stroke', PROP_ALT_STROKE)
      .attr('stroke-width', 1.2)
    legend
      .append('text')
      .attr('x', altX + 7)
      .attr('y', 0)
      .attr('dominant-baseline', 'central')
      .attr('font-size', 11)
      .attr('fill', PROP_LABEL)
      .text(altLabel)
  }

  const x0 = xScale(0)!
  const x1 = xScale(1)!
  const plotWidth = Math.max(0, x1 - x0)
  const maxBarH = Math.max(0, layout.barHeight)

  const pack = packUnitBars(plotWidth, maxBarH, nFocus, nAlt)
  if (!pack) return

  // Centre the quantized bar block in the axis span (leftover from floor).
  const blockW = pack.focusWidth + pack.altWidth
  const blockX = x0 + Math.max(0, (plotWidth - blockW) / 2)
  const focusX = blockX
  const focusW = pack.focusWidth
  const altX = blockX + pack.focusWidth
  const altW = pack.altWidth
  const barH = pack.barHeight
  const bandTop =
    layout.barTop + Math.max(0, (layout.barHeight - barH) / 2)
  const labelY = bandTop + barH + 14
  const statY = bandTop - 8
  // Visual split (= quantized width); p̂ label uses the true proportion.
  const splitX = focusX + focusW
  const trueProp = Number.isFinite(lineValue) ? lineValue : prop

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

  drawSegmentDots(
    g,
    placeInBins(focusX, bandTop, pack.focusCols, pack.rows, pack.cell, nFocus),
    focusIndices,
    PROP_FOCUS_COLOR,
    PROP_FOCUS_STROKE,
    classPrefix,
    false,
  )
  drawSegmentDots(
    g,
    placeInBins(altX, bandTop, pack.altCols, pack.rows, pack.cell, nAlt),
    altIndices,
    PROP_ALT_STROKE,
    PROP_ALT_STROKE,
    classPrefix,
    true,
  )

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

  if (showStat && Number.isFinite(trueProp)) {
    g.append('line')
      .attr('class', `${classPrefix}-stat-line`)
      .attr('x1', splitX)
      .attr('x2', splitX)
      .attr('y1', bandTop - 6)
      .attr('y2', bandTop + barH + 6)
      .attr('stroke', PROP_LABEL)
      .attr('stroke-width', 2)

    const label = `p̂ = ${formatProportion(trueProp)}`
    let labelX = splitX
    let anchor: 'start' | 'end' | 'middle' = 'middle'
    if (splitX < 48) {
      labelX = splitX + 6
      anchor = 'start'
    } else if (splitX > innerWidth - 48) {
      labelX = splitX - 6
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

/** Clear unit / legacy proportion marks. */
export function removeProportionBar(parent: SVGGElement, classPrefix = 'prop') {
  const g = d3.select(parent)
  clearUnitBar(g, classPrefix)
  g.selectAll('.prop-group').remove()
  g.selectAll(`[class*="${classPrefix}"]`).remove()
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
) {
  removeProportionBar(parent, 'prop')
  const g = d3.select(parent)
  g.selectAll('.prop-group').remove()

  const height = innerHeight ?? 200
  const rows = multiUnitGroupRows(height, groupLevels.length)

  for (let gi = 0; gi < groupLevels.length; gi++) {
    const groupEncoded: number[] = []
    for (let i = 0; i < encoded.length; i++) {
      if (populationGroup[i] === gi) groupEncoded.push(encoded[i]!)
    }
    const row = rows[gi]!
    const layout = unitGroupRowLayout(row.top, row.height, gi === 0)
    const subG = g.append('g').attr('class', 'prop-group')
    drawHybridProportionChart(
      subG.node()!,
      groupEncoded,
      innerWidth,
      row.height,
      xScale,
      {
        classPrefix: `prop-g${gi}`,
        showLegend: gi === 0,
        showStat,
        statValue: groupStats[gi],
        groupLabel: groupLevels[gi],
        categoryLabels,
        layout,
      },
    )
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
