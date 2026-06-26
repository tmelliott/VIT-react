import * as d3 from 'd3'
import type { BoxplotHighlight } from '../statistics'
import {
  DIST_BARCODE_BLUE,
  DIST_BARCODE_BLUE_OPACITY,
  IQR_STACK_LINE_HEIGHT,
} from './paneStyle'
import { STAT_MARKER_RED } from './statMarker'

export type FiveNum = {
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

const BOX_STROKE = '#374151'
const BOX_STROKE_WIDTH = 1.5
const HIGHLIGHT_WIDTH = 2.5
const IQR_ARROW_SIZE = 5

export function fiveNumSummary(values: number[]): FiveNum | null {
  const clean = values.filter((v) => Number.isFinite(v))
  if (clean.length === 0) return null
  const sorted = [...clean].sort((a, b) => a - b)
  return {
    min: sorted[0]!,
    q1: d3.quantileSorted(sorted, 0.25)!,
    median: d3.quantileSorted(sorted, 0.5)!,
    q3: d3.quantileSorted(sorted, 0.75)!,
    max: sorted[sorted.length - 1]!,
  }
}

type BoxplotCoords = {
  midY: number
  topY: number
  bottomY: number
  xMin: number
  xQ1: number
  xMed: number
  xQ3: number
  xMax: number
}

function boxplotCoords(
  summary: FiveNum,
  xScale: d3.ScaleLinear<number, number>,
  y: number,
  height: number,
): BoxplotCoords {
  return {
    midY: y + height / 2,
    topY: y,
    bottomY: y + height,
    xMin: xScale(summary.min)!,
    xQ1: xScale(summary.q1)!,
    xMed: xScale(summary.median)!,
    xQ3: xScale(summary.q3)!,
    xMax: xScale(summary.max)!,
  }
}

function appendLine(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  strokeWidth: number,
  className?: string,
) {
  const line = parent
    .append('line')
    .attr('x1', x1)
    .attr('y1', y1)
    .attr('x2', x2)
    .attr('y2', y2)
    .attr('stroke', stroke)
    .attr('stroke-width', strokeWidth)
    .attr('stroke-linecap', 'round')
  if (className) line.attr('class', className)
}

function appendArrowHead(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  tipX: number,
  tipY: number,
  direction: 'left' | 'right',
  className = 'boxplot-highlight-arrow',
) {
  const half = IQR_ARROW_SIZE * 0.65
  const baseOffset = IQR_ARROW_SIZE
  const d =
    direction === 'left'
      ? `M${tipX},${tipY} L${tipX + baseOffset},${tipY - half} L${tipX + baseOffset},${tipY + half} Z`
      : `M${tipX},${tipY} L${tipX - baseOffset},${tipY - half} L${tipX - baseOffset},${tipY + half} Z`
  parent
    .append('path')
    .attr('class', className)
    .attr('d', d)
    .attr('fill', STAT_MARKER_RED)
}

function drawBoxBody(
  box: d3.Selection<SVGGElement, unknown, null, undefined>,
  coords: BoxplotCoords,
) {
  const { midY, topY, bottomY, xMin, xQ1, xMed, xQ3, xMax } = coords
  appendLine(box, xMin, midY, xQ1, midY, BOX_STROKE, BOX_STROKE_WIDTH)
  appendLine(box, xQ1, topY, xQ1, bottomY, BOX_STROKE, BOX_STROKE_WIDTH)
  appendLine(box, xMed, topY, xMed, bottomY, BOX_STROKE, BOX_STROKE_WIDTH)
  appendLine(box, xQ3, topY, xQ3, bottomY, BOX_STROKE, BOX_STROKE_WIDTH)
  appendLine(box, xQ3, midY, xMax, midY, BOX_STROKE, BOX_STROKE_WIDTH)
  appendLine(box, xQ1, topY, xQ3, topY, BOX_STROKE, BOX_STROKE_WIDTH)
  appendLine(box, xQ1, bottomY, xQ3, bottomY, BOX_STROKE, BOX_STROKE_WIDTH)
}

function drawBoxplotHighlight(
  box: d3.Selection<SVGGElement, unknown, null, undefined>,
  coords: BoxplotCoords,
  highlight: BoxplotHighlight,
) {
  const { topY, bottomY, xQ1, xMed, xQ3 } = coords
  if (highlight === 'median') {
    appendLine(
      box,
      xMed,
      topY,
      xMed,
      bottomY,
      STAT_MARKER_RED,
      HIGHLIGHT_WIDTH,
      'boxplot-highlight',
    )
  } else if (highlight === 'lq') {
    appendLine(
      box,
      xQ1,
      topY,
      xQ1,
      bottomY,
      STAT_MARKER_RED,
      HIGHLIGHT_WIDTH,
      'boxplot-highlight',
    )
  } else if (highlight === 'uq') {
    appendLine(
      box,
      xQ3,
      topY,
      xQ3,
      bottomY,
      STAT_MARKER_RED,
      HIGHLIGHT_WIDTH,
      'boxplot-highlight',
    )
  } else {
    appendLine(
      box,
      xQ1,
      topY,
      xQ3,
      topY,
      STAT_MARKER_RED,
      HIGHLIGHT_WIDTH,
      'boxplot-highlight',
    )
    appendArrowHead(box, xQ1, topY, 'left')
    appendArrowHead(box, xQ3, topY, 'right')
  }
}

export type HorizontalBoxplotOptions = {
  highlight?: BoxplotHighlight
  /** Draw only the highlighted edge (for stored P2 replicates). */
  highlightOnly?: boolean
  opacity?: number
  replicateIndex?: number
}

/** Horizontal boxplot matching VITonline makeBoxplot. */
export function drawHorizontalBoxplot(
  parent: SVGGElement,
  values: number[],
  xScale: d3.ScaleLinear<number, number>,
  y: number,
  height: number,
  className = 'boxplot',
  options: HorizontalBoxplotOptions = {},
): FiveNum | null {
  const summary = fiveNumSummary(values)
  const sel = d3.select(parent)
  if (options.replicateIndex == null) {
    sel.selectAll(`.${className}`).remove()
  }
  if (!summary) return null

  const coords = boxplotCoords(summary, xScale, y, height)
  const box = sel.append('g').attr('class', className)
  if (options.replicateIndex != null) {
    box.attr('data-index', options.replicateIndex)
  }
  if (options.opacity != null) {
    box.attr('opacity', options.opacity)
  }

  if (!options.highlightOnly) {
    drawBoxBody(box, coords)
  }
  if (options.highlight) {
    drawBoxplotHighlight(box, coords, options.highlight)
  }

  return summary
}

/** X position for a boxplot-highlight statistic label above the boxplot. */
export function boxplotHighlightLabelX(
  summary: FiveNum,
  highlight: BoxplotHighlight,
  xScale: d3.ScaleLinear<number, number>,
): number {
  if (highlight === 'median') return xScale(summary.median)!
  if (highlight === 'lq') return xScale(summary.q1)!
  if (highlight === 'uq') return xScale(summary.q3)!
  return xScale((summary.q1 + summary.q3) / 2)!
}

/** @deprecated Use boxplotHighlightLabelX */
export function quartileLabelX(
  summary: FiveNum,
  highlight: BoxplotHighlight,
  xScale: d3.ScaleLinear<number, number>,
): number {
  return boxplotHighlightLabelX(summary, highlight, xScale)
}

export function removeBoxplot(parent: SVGGElement, className = 'boxplot') {
  d3.select(parent).selectAll(`.${className}`).remove()
}

function ensureIqrStackGroup(parent: SVGGElement): d3.Selection<SVGGElement, unknown, null, undefined> {
  const sel = d3.select(parent)
  if (sel.select('.sample-iqr-stack').empty()) {
    sel.insert('g', ':first-child').attr('class', 'sample-iqr-stack')
  }
  return sel.select<SVGGElement>('.sample-iqr-stack')
}

export function maxIqrStackLines(boxHeight: number): number {
  return Math.max(1, Math.floor(boxHeight / IQR_STACK_LINE_HEIGHT))
}

/** Push a new blue IQR span onto the stack at the box top; older lines shift down. */
export function pushIqrLineToStack(
  parent: SVGGElement,
  xQ1: number,
  xQ3: number,
  boxY: number,
  boxHeight: number,
  replicateIndex?: number,
) {
  if (!Number.isFinite(xQ1) || !Number.isFinite(xQ3)) return
  const stackBottom = boxY + boxHeight
  const stack = ensureIqrStackGroup(parent)

  stack.selectAll<SVGLineElement, unknown>('.sample-iqr-stack-line').each(function () {
    const line = d3.select(this)
    const nextY = Number(line.attr('y1')) + IQR_STACK_LINE_HEIGHT
    if (nextY >= stackBottom) {
      line.remove()
    } else {
      line.attr('y1', nextY).attr('y2', nextY)
    }
  })

  stack
    .append('line')
    .attr('class', 'sample-iqr-stack-line')
    .attr('data-index', replicateIndex ?? '')
    .attr('x1', Math.min(xQ1, xQ3))
    .attr('x2', Math.max(xQ1, xQ3))
    .attr('y1', boxY)
    .attr('y2', boxY)
    .attr('stroke', DIST_BARCODE_BLUE)
    .attr('stroke-width', IQR_STACK_LINE_HEIGHT)
    .attr('stroke-opacity', DIST_BARCODE_BLUE_OPACITY)
    .attr('stroke-linecap', 'butt')

  const lines = stack.selectAll<SVGLineElement, unknown>('.sample-iqr-stack-line').nodes()
  const maxLines = maxIqrStackLines(boxHeight)
  if (lines.length > maxLines) {
    lines
      .sort(
        (a, b) =>
          Number(d3.select(b).attr('y1')) - Number(d3.select(a).attr('y1')),
      )
      .slice(maxLines)
      .forEach((node) => d3.select(node).remove())
  }
}

export function iqrSpanPixels(
  values: number[],
  xScale: d3.ScaleLinear<number, number>,
): { xQ1: number; xQ3: number } | null {
  const summary = fiveNumSummary(values)
  if (!summary) return null
  const xQ1 = xScale(summary.q1)!
  const xQ3 = xScale(summary.q3)!
  if (!Number.isFinite(xQ1) || !Number.isFinite(xQ3)) return null
  return { xQ1, xQ3 }
}

/** Move the current red IQR arrow into the blue stack before the next replicate. */
export function archiveSampleIqrToStack(
  parent: SVGGElement,
  boxY: number,
  boxHeight: number,
) {
  const sel = d3.select(parent)
  const highlight = sel.select('.sample-boxplot line.boxplot-highlight')
  if (highlight.empty()) {
    sel.selectAll('.sample-boxplot').remove()
    return
  }
  const xQ1 = Number(highlight.attr('x1'))
  const xQ3 = Number(highlight.attr('x2'))
  sel.selectAll('.sample-boxplot').remove()
  if (!Number.isFinite(xQ1) || !Number.isFinite(xQ3)) return
  pushIqrLineToStack(parent, xQ1, xQ3, boxY, boxHeight)
}

export function clearSampleIqrStack(parent: SVGGElement) {
  d3.select(parent).selectAll('.sample-iqr-stack').remove()
}
