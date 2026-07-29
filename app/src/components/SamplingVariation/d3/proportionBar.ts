import * as d3 from 'd3'
import {
  formatProportion,
  PROP_ALT_COLOR,
  PROP_ALT_STROKE,
  PROP_FOCUS_COLOR,
  PROP_FOCUS_STROKE,
  type ProportionBarLayout,
} from './proportionLayout'

export type ProportionBarOptions = {
  classPrefix?: string
  showLabels?: boolean
  showStatLine?: boolean
  /** Show white count labels centred in each segment (VITonline style). */
  showCounts?: boolean
  statValue?: number
  groupLabel?: string
  categoryLabels?: [string, string]
}

type DotPlacement = { x: number; y: number; r: number }

const MIN_R = 1.5
/** Cap so sparse segments (tiny N) don't become a few giant circles. */
const MAX_R = 5.5
/** Match VITonline: never draw more than this many circles per segment. */
const MAX_DOTS = 500

/**
 * Pack up to `count` dots as a dense grid that fills the rectangle.
 * Chooses rows/cols so circle diameter fits both axes, with radius capped.
 */
export function dotGridInRect(
  xStart: number,
  yTop: number,
  width: number,
  height: number,
  count: number,
): DotPlacement[] {
  if (count <= 0 || width <= 0 || height <= 0) return []

  const capacity =
    Math.max(0, Math.floor(width / (MIN_R * 2))) *
    Math.max(0, Math.floor(height / (MIN_R * 2)))
  const n = Math.min(count, MAX_DOTS, capacity)
  if (n <= 0) return []

  // Search for the row count that maximises radius (balanced fill).
  let bestCols = n
  let bestR = 0
  const maxRows = Math.min(n, Math.max(1, Math.floor(height / (MIN_R * 2))))
  for (let rows = 1; rows <= maxRows; rows++) {
    const cols = Math.ceil(n / rows)
    const r = Math.min(width / (cols * 2), height / (rows * 2), MAX_R)
    if (r > bestR) {
      bestR = r
      bestCols = cols
    }
  }

  const radius = bestR
  if (radius < MIN_R * 0.5) return []

  const cols = bestCols
  const rows = Math.ceil(n / cols)
  const gridHeight = rows * radius * 2
  const yMargin = (height - gridHeight) / 2
  const positions: DotPlacement[] = []

  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const dotsInRow =
      row === rows - 1 ? n - row * cols : cols
    const rowWidth = dotsInRow * radius * 2
    const xMargin = (width - rowWidth) / 2
    positions.push({
      x: xStart + xMargin + radius + col * radius * 2,
      y: yTop + yMargin + radius + row * radius * 2,
      r: radius,
    })
  }

  return positions
}

function drawSegmentDots(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  placements: DotPlacement[],
  indices: number[],
  fill: string,
  stroke: string,
  classPrefix: string,
) {
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i]!
    g.append('circle')
      .attr('class', `${classPrefix}-dot`)
      .attr('data-index', indices[i] ?? i)
      .attr('cx', p.x)
      .attr('cy', p.y)
      .attr('r', p.r)
      .attr('fill', fill)
      .attr('stroke', stroke)
      .attr('stroke-width', 0.4)
      .attr('fill-opacity', 0.92)
  }
}

export function drawProportionBar(
  parent: SVGGElement,
  encoded: number[],
  layout: ProportionBarLayout,
  xScale: d3.ScaleLinear<number, number>,
  innerWidth: number,
  options: ProportionBarOptions = {},
) {
  const {
    classPrefix = 'prop',
    showLabels = true,
    showStatLine = false,
    showCounts = true,
    statValue,
    groupLabel,
    categoryLabels = ['Focus', 'Other'],
  } = options

  const g = d3.select(parent)
  g.selectAll(`.${classPrefix}-bar`).remove()
  g.selectAll(`.${classPrefix}-dot`).remove()
  g.selectAll(`.${classPrefix}-stat-line`).remove()
  g.selectAll(`.${classPrefix}-stat-text`).remove()
  g.selectAll(`.${classPrefix}-count`).remove()
  g.selectAll(`.${classPrefix}-group-label`).remove()
  g.selectAll(`.${classPrefix}-cat-label`).remove()

  const n = encoded.length
  if (n === 0) return

  const focusIndices: number[] = []
  const altIndices: number[] = []
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === 0) focusIndices.push(i)
    else altIndices.push(i)
  }

  const nFocus = focusIndices.length
  const nAlt = altIndices.length
  const prop = nFocus / n

  const x0 = xScale(0)!
  const x1 = xScale(1)!
  const splitX = xScale(prop)!
  const { top, height } = layout

  if (groupLabel) {
    g.append('text')
      .attr('class', `${classPrefix}-group-label`)
      .attr('x', innerWidth - 2)
      .attr('y', top - 4)
      .attr('text-anchor', 'end')
      .attr('font-size', 10)
      .attr('fill', '#374151')
      .attr('font-weight', 600)
      .text(groupLabel)
  }

  if (showLabels) {
    g.append('text')
      .attr('class', `${classPrefix}-cat-label`)
      .attr('x', x0)
      .attr('y', top - 4)
      .attr('text-anchor', 'start')
      .attr('font-size', 10)
      .attr('font-weight', 600)
      .attr('fill', PROP_FOCUS_STROKE)
      .text(categoryLabels[0] ?? 'Focus')
    g.append('text')
      .attr('class', `${classPrefix}-cat-label`)
      .attr('x', x1)
      .attr('y', top - 4)
      .attr('text-anchor', 'end')
      .attr('font-size', 10)
      .attr('font-weight', 600)
      .attr('fill', PROP_ALT_STROKE)
      .text(categoryLabels[1] ?? 'Other')
  }

  const pad = 1.5
  const barInnerTop = top + pad
  const barInnerHeight = Math.max(1, height - pad * 2)

  if (nFocus > 0) {
    const leftWidth = Math.max(1, splitX - x0 - pad)
    g.append('rect')
      .attr('class', `${classPrefix}-bar ${classPrefix}-bar-focus`)
      .attr('x', x0)
      .attr('y', top)
      .attr('width', Math.max(0, splitX - x0))
      .attr('height', height)
      .attr('fill', PROP_FOCUS_COLOR)
      .attr('fill-opacity', 0.35)
      .attr('stroke', PROP_FOCUS_STROKE)
      .attr('stroke-width', 1)

    const leftDots = dotGridInRect(
      x0 + pad,
      barInnerTop,
      leftWidth,
      barInnerHeight,
      nFocus,
    )
    drawSegmentDots(
      g,
      leftDots,
      focusIndices,
      PROP_FOCUS_COLOR,
      PROP_FOCUS_STROKE,
      classPrefix,
    )

    if (showCounts) {
      g.append('text')
        .attr('class', `${classPrefix}-count`)
        .attr('x', x0 + (splitX - x0) / 2)
        .attr('y', top + height / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', Math.min(18, height * 0.35))
        .attr('font-weight', 700)
        .attr('fill', '#fff')
        .attr('fill-opacity', 0.85)
        .attr('pointer-events', 'none')
        .text(String(nFocus))
    }
  }

  if (nAlt > 0) {
    const rightWidth = Math.max(1, x1 - splitX - pad)
    g.append('rect')
      .attr('class', `${classPrefix}-bar ${classPrefix}-bar-alt`)
      .attr('x', splitX)
      .attr('y', top)
      .attr('width', Math.max(0, x1 - splitX))
      .attr('height', height)
      .attr('fill', PROP_ALT_COLOR)
      .attr('fill-opacity', 0.35)
      .attr('stroke', PROP_ALT_STROKE)
      .attr('stroke-width', 1)

    const rightDots = dotGridInRect(
      splitX + pad,
      barInnerTop,
      rightWidth,
      barInnerHeight,
      nAlt,
    )
    drawSegmentDots(
      g,
      rightDots,
      altIndices,
      PROP_ALT_COLOR,
      PROP_ALT_STROKE,
      classPrefix,
    )

    if (showCounts) {
      g.append('text')
        .attr('class', `${classPrefix}-count`)
        .attr('x', splitX + (x1 - splitX) / 2)
        .attr('y', top + height / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', Math.min(18, height * 0.35))
        .attr('font-weight', 700)
        .attr('fill', '#fff')
        .attr('fill-opacity', 0.85)
        .attr('pointer-events', 'none')
        .text(String(nAlt))
    }
  }

  const lineValue = statValue ?? prop
  if (showStatLine && Number.isFinite(lineValue)) {
    const lx = xScale(lineValue)!
    g.append('line')
      .attr('class', `${classPrefix}-stat-line`)
      .attr('x1', lx)
      .attr('x2', lx)
      .attr('y1', top - 10)
      .attr('y2', top + height + 4)
      .attr('stroke', '#111827')
      .attr('stroke-width', 2.5)

    g.append('text')
      .attr('class', `${classPrefix}-stat-text`)
      .attr('x', lx + 5)
      .attr('y', top - 12)
      .attr('font-size', 11)
      .attr('fill', '#111827')
      .attr('font-weight', 700)
      .text(`p̂ = ${formatProportion(lineValue)}`)
  }
}

export function removeProportionBar(parent: SVGGElement, classPrefix = 'prop') {
  const g = d3.select(parent)
  g.selectAll(`.${classPrefix}-bar`).remove()
  g.selectAll(`.${classPrefix}-dot`).remove()
  g.selectAll(`.${classPrefix}-stat-line`).remove()
  g.selectAll(`.${classPrefix}-stat-text`).remove()
  g.selectAll(`.${classPrefix}-count`).remove()
  g.selectAll(`.${classPrefix}-group-label`).remove()
  g.selectAll(`.${classPrefix}-cat-label`).remove()
}

export function drawMultiGroupProportionBars(
  parent: SVGGElement,
  encoded: number[],
  populationGroup: number[],
  groupLevels: string[],
  barLayouts: ProportionBarLayout[],
  xScale: d3.ScaleLinear<number, number>,
  innerWidth: number,
  groupStats: number[],
  categoryLabels: [string, string],
  showStatLines = true,
) {
  removeProportionBar(parent, 'prop')
  d3.select(parent).selectAll('.prop-group').remove()
  for (let gi = 0; gi < groupLevels.length; gi++) {
    const groupEncoded: number[] = []
    for (let i = 0; i < encoded.length; i++) {
      if (populationGroup[i] === gi) groupEncoded.push(encoded[i]!)
    }
    const subG = d3.select(parent).append('g').attr('class', 'prop-group')
    drawProportionBar(
      subG.node()!,
      groupEncoded,
      barLayouts[gi] ?? barLayouts[0]!,
      xScale,
      innerWidth,
      {
        classPrefix: `prop-g${gi}`,
        showLabels: gi === 0,
        showStatLine: showStatLines,
        showCounts: true,
        statValue: groupStats[gi],
        groupLabel: groupLevels[gi],
        categoryLabels,
      },
    )
  }
}
