import * as d3 from 'd3'
import { DOT_RADIUS } from './heapLayout'
import {
  DIST_BARCODE_BLUE,
  POP_DOT_FILL,
  POP_DOT_FILL_OPACITY,
  POP_DOT_STROKE,
  POP_DOT_STROKE_OPACITY,
  POP_DOT_STROKE_WIDTH,
  PREVIOUS_STAT_OPACITY,
} from './paneStyle'
import { drawHorizontalArrow, drawVerticalArrow } from './drawArrow'
import { drawHorizontalDistTwoGroupReferenceLines } from './referenceLine'
import {
  formatSlopeNumber,
  slopeDerivationTriangle,
  type SlopeTriangle,
} from './slopeMath'

/** Fraction of the Data pane width reserved for the slope panel (P1B). */
export const SLOPE_PANEL_FRACTION = 0.32
const PANEL_GAP = 12
/** Shared y-axis label gutter for P1A / P2A / P3A (keeps plot boxes aligned). */
export const SCATTER_Y_AXIS_WIDTH = 36
/** Left margin inside P1B/P2B so y-tick labels sit beside the plot box. */
export const SLOPE_PANEL_Y_AXIS_WIDTH = 28
/** Space inside the clipped plot for the scatter x-axis tick labels. */
export const SCATTER_X_AXIS_HEIGHT = 22
const SLOPE_LINE_COLOR = '#111827'
const DERIV_ARROW_COLOR = '#dc2626'
const ZERO_LINE_COLOR = '#9ca3af'

export type SlopePaneSplit = {
  scatterWidth: number
  slopePanelLeft: number
  slopePanelWidth: number
  scatterPlotLeft: number
  scatterPlotWidth: number
}

/** P3: unit-run panel (P3A) on the left; horizontal slope heap (P3B) on the right. */
export type DistSlopeSplit = {
  panelLeft: number
  panelWidth: number
  /** Plot origin inside the panel (after y-axis). */
  panelPlotLeft: number
  panelPlotWidth: number
  heapLeft: number
  heapWidth: number
  /** Left edge of the heap plot (after y-axis) — dots grow right from here. */
  heapPlotLeft: number
  heapPlotWidth: number
}

export function slopePaneSplit(innerWidth: number): SlopePaneSplit {
  const slopePanelWidth = Math.max(100, Math.floor(innerWidth * SLOPE_PANEL_FRACTION))
  const scatterWidth = Math.max(80, innerWidth - slopePanelWidth - PANEL_GAP)
  const scatterPlotLeft = SCATTER_Y_AXIS_WIDTH
  const scatterPlotWidth = Math.max(40, scatterWidth - scatterPlotLeft)
  return {
    scatterWidth,
    slopePanelLeft: scatterWidth + PANEL_GAP,
    slopePanelWidth,
    scatterPlotLeft,
    scatterPlotWidth,
  }
}

/**
 * P3 layout: P3A (unit-run) on the left with the *narrow* B-panel width,
 * P3B (horizontal heap) on the right with the *wide* A-panel width.
 * Order matches P1/P2 (A then B); widths are swapped vs those panes.
 */
export function distSlopeSplit(innerWidth: number): DistSlopeSplit {
  const split = slopePaneSplit(innerWidth)
  // Narrow P3A (B-column width) → larger aspect-matched y-span; wide P3B for dots.
  const panelWidth = split.slopePanelWidth
  const panelPlotLeft = SCATTER_Y_AXIS_WIDTH
  const panelPlotWidth = Math.max(40, panelWidth - panelPlotLeft)
  const heapLeft = panelWidth + PANEL_GAP
  const heapWidth = Math.max(80, innerWidth - heapLeft)
  const heapPlotLeft = SLOPE_PANEL_Y_AXIS_WIDTH
  const heapPlotWidth = Math.max(40, heapWidth - heapPlotLeft)
  return {
    panelLeft: 0,
    panelWidth,
    panelPlotLeft,
    panelPlotWidth,
    heapLeft,
    heapWidth,
    heapPlotLeft,
    heapPlotWidth,
  }
}

export function lineEndpointsOnPlot(
  slope: number,
  intercept: number,
  xDomain: [number, number],
  yDomain: [number, number],
): { x0: number; y0: number; x1: number; y1: number } | null {
  if (!Number.isFinite(slope) || !Number.isFinite(intercept)) return null
  // Clip line to the rectangle [xDomain] × [yDomain].
  const candidates: { x: number; y: number }[] = []
  for (const x of xDomain) {
    const y = slope * x + intercept
    if (y >= yDomain[0] && y <= yDomain[1]) candidates.push({ x, y })
  }
  if (Math.abs(slope) > 1e-12) {
    for (const y of yDomain) {
      const x = (y - intercept) / slope
      if (x >= xDomain[0] && x <= xDomain[1]) candidates.push({ x, y })
    }
  }
  // Deduplicate near-duplicates.
  const uniq: { x: number; y: number }[] = []
  for (const p of candidates) {
    if (uniq.some((q) => Math.abs(q.x - p.x) < 1e-9 && Math.abs(q.y - p.y) < 1e-9)) {
      continue
    }
    uniq.push(p)
  }
  if (uniq.length < 2) {
    // Fall back to domain ends even if slightly out of y (caller clips visually).
    return {
      x0: xDomain[0],
      y0: slope * xDomain[0] + intercept,
      x1: xDomain[1],
      y1: slope * xDomain[1] + intercept,
    }
  }
  uniq.sort((a, b) => a.x - b.x || a.y - b.y)
  const a = uniq[0]!
  const b = uniq[uniq.length - 1]!
  return { x0: a.x, y0: a.y, x1: b.x, y1: b.y }
}

function drawScatterAxes(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  plotWidth: number,
  plotHeight: number,
) {
  const xAxis = d3.axisBottom(xScale).ticks(5).tickSizeOuter(0)
  const yAxis = d3.axisLeft(yScale).ticks(5).tickSizeOuter(0)

  const xG = g
    .append('g')
    .attr('class', 'pop-scatter-x-axis')
    .attr('transform', `translate(0, ${plotHeight})`)
    .call(xAxis)
  xG.selectAll('text').attr('fill', '#4b5563').attr('font-size', 10)
  xG.selectAll('line').attr('stroke', '#9ca3af')
  xG.select('.domain').attr('stroke', '#9ca3af')

  const yG = g.append('g').attr('class', 'pop-scatter-y-axis').call(yAxis)
  yG.selectAll('text').attr('fill', '#4b5563').attr('font-size', 10)
  yG.selectAll('line').attr('stroke', '#9ca3af')
  yG.select('.domain').attr('stroke', '#9ca3af')

  // Keep axis labels from colliding with the slope panel.
  void plotWidth
}

function drawDerivationArrows(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  triangle: SlopeTriangle,
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  classPrefix = 'pop',
) {
  const x0 = xScale(triangle.x0)!
  const y0 = yScale(triangle.y0)!
  const x1 = xScale(triangle.x1)!
  const y1 = yScale(triangle.y1)!

  // Rise (Δy) then run (Δx): corner at (x0, y1) — triangle sits above the slope line.
  drawVerticalArrow(g, x0, y0, y1, DERIV_ARROW_COLOR, 1).attr(
    'class',
    `${classPrefix}-dy-arrow`,
  )
  drawHorizontalArrow(g, x0, x1, y1, DERIV_ARROW_COLOR, 1).attr(
    'class',
    `${classPrefix}-dx-arrow`,
  )

  const midX = (x0 + x1) / 2
  const midY = (y0 + y1) / 2
  // Δx label sits above the horizontal run (screen-above for both slope signs).
  const dxLabelY = y1 + (triangle.dy >= 0 ? -6 : 14)
  g.append('text')
    .attr('class', `${classPrefix}-dx-label`)
    .attr('x', midX)
    .attr('y', dxLabelY)
    .attr('text-anchor', 'middle')
    .attr('fill', DERIV_ARROW_COLOR)
    .attr('font-size', 11)
    .attr('font-weight', 600)
    .text(formatSlopeNumber(triangle.dx))

  g.append('text')
    .attr('class', `${classPrefix}-dy-label`)
    .attr('x', x0 - 8)
    .attr('y', midY)
    .attr('text-anchor', 'end')
    .attr('dominant-baseline', 'middle')
    .attr('fill', DERIV_ARROW_COLOR)
    .attr('font-size', 11)
    .attr('font-weight', 600)
    .text(formatSlopeNumber(triangle.dy))
}

/** P1A: scatter + LS line + pedagogical Δy/Δx arrows. */
export function drawPopulationSlopeScatter(
  parent: SVGGElement,
  options: {
    x: number[]
    y: number[]
    slope: number
    intercept: number
    xDomain: [number, number]
    yDomain: [number, number]
    plotWidth: number
    plotHeight: number
    showDerivation?: boolean
    /** Outline dots for show; same outlines under blur in fuzz mode. */
    filled?: boolean
  },
) {
  const g = d3.select(parent)
  g.selectAll('*').remove()

  const {
    x,
    y,
    slope,
    intercept,
    xDomain,
    yDomain,
    plotWidth,
    plotHeight,
    showDerivation = true,
    filled = false,
  } = options

  const xScale = d3.scaleLinear().domain(xDomain).range([0, plotWidth])
  const yScale = d3.scaleLinear().domain(yDomain).range([plotHeight, 0])

  drawScatterAxes(g, xScale, yScale, plotWidth, plotHeight)

  const plotG = g.append('g').attr('class', 'pop-scatter-plot')

  const ends = lineEndpointsOnPlot(slope, intercept, xDomain, yDomain)
  if (ends) {
    plotG
      .append('line')
      .attr('class', 'pop-slope-line')
      .attr('x1', xScale(ends.x0)!)
      .attr('y1', yScale(ends.y0)!)
      .attr('x2', xScale(ends.x1)!)
      .attr('y2', yScale(ends.y1)!)
      .attr('stroke', SLOPE_LINE_COLOR)
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round')
  }

  const n = Math.min(x.length, y.length)
  const dots = plotG.append('g').attr('class', 'pop-scatter-dots')
  for (let i = 0; i < n; i++) {
    const xi = x[i]!
    const yi = y[i]!
    if (!Number.isFinite(xi) || !Number.isFinite(yi)) continue
    dots
      .append('circle')
      .attr('class', 'pop-scatter-dot')
      .attr('data-pop-idx', i)
      .attr('cx', xScale(xi)!)
      .attr('cy', yScale(yi)!)
      .attr('r', DOT_RADIUS)
      .attr('fill', filled ? POP_DOT_FILL : 'none')
      .attr('fill-opacity', filled ? POP_DOT_FILL_OPACITY : 1)
      .attr('stroke', POP_DOT_STROKE)
      .attr('stroke-width', POP_DOT_STROKE_WIDTH)
      .attr('stroke-opacity', POP_DOT_STROKE_OPACITY)
  }

  if (showDerivation) {
    const triangle = slopeDerivationTriangle(slope, intercept, xDomain, yDomain)
    if (triangle) {
      const derivG = plotG.append('g').attr('class', 'pop-slope-deriv')
      drawDerivationArrows(derivG, triangle, xScale, yScale)
    }
  }

  return { xScale, yScale }
}

/**
 * Symmetric panel y-domain from slope values: [-M, M] where
 * M = max(|slopes|). Falls back to [-1, 1] if empty / all ~0.
 * Used for P1B/P2B (fit every sample slope).
 */
export function slopePanelYDomain(slopes: Iterable<number>): [number, number] {
  let m = 0
  for (const s of slopes) {
    if (Number.isFinite(s)) m = Math.max(m, Math.abs(s))
  }
  if (!(m > 0)) m = 1
  return [-m, m]
}

/**
 * P3A/P3B y-domain matched to the P2A scatter so a given mathematical slope
 * keeps the same on-screen angle. Always centred on 0; slopes outside clip.
 *
 * Base span is (ySpan / xSpan) for unit-run Δx = 1. When P3A is narrower than
 * P2A, scale the span by (referencePlotWidth / panelPlotWidth) so the angle
 * is preserved and the y-domain grows (more slopes fit).
 */
export function distPanelYDomain(
  xDomain: [number, number],
  yDomain: [number, number],
  options?: {
    referencePlotWidth?: number
    panelPlotWidth?: number
  },
): [number, number] {
  const xSpan = Math.abs(xDomain[1] - xDomain[0])
  const ySpan = Math.abs(yDomain[1] - yDomain[0])
  if (!(xSpan > 0) || !(ySpan > 0)) return [-1, 1]
  let half = ySpan / xSpan / 2
  const refW = options?.referencePlotWidth
  const panelW = options?.panelPlotWidth
  if (
    refW != null &&
    panelW != null &&
    refW > 0 &&
    panelW > 0 &&
    Number.isFinite(refW) &&
    Number.isFinite(panelW)
  ) {
    half *= refW / panelW
  }
  if (!(half > 0) || !Number.isFinite(half)) return [-1, 1]
  return [-half, half]
}

/** P1B: slope reference chart filling the panel; axes; formula inside. */
export function drawPopulationSlopePanel(
  parent: SVGGElement,
  options: {
    slope: number
    triangle: SlopeTriangle | null
    panelWidth: number
    panelHeight: number
    /** Symmetric y-domain, typically [-M, M] from slope magnitudes. */
    panelYDomain: [number, number]
    /** Population slope line + equation (needs sample-based y-scale). */
    showLine?: boolean
  },
) {
  const g = d3.select(parent)
  g.selectAll('*').remove()

  const {
    slope,
    triangle,
    panelWidth,
    panelHeight,
    panelYDomain: yDom,
    showLine = true,
  } = options
  const plotLeft = SLOPE_PANEL_Y_AXIS_WIDTH
  const plotWidth = Math.max(40, panelWidth - plotLeft)
  const plotHeight = Math.max(40, panelHeight)

  const dyLabel = triangle ? formatSlopeNumber(triangle.dy) : formatSlopeNumber(slope)
  const dxLabel = triangle ? formatSlopeNumber(triangle.dx) : '1'
  const slopeLabel = formatSlopeNumber(slope)

  // x ∈ [0, 1]; y is slope units with 0 centred.
  const xDomain: [number, number] = [0, 1]

  const plotG = g
    .append('g')
    .attr('class', 'pop-slope-ref-plot')
    .attr('transform', `translate(${plotLeft}, 0)`)

  const xScale = d3.scaleLinear().domain(xDomain).range([0, plotWidth])
  const yScale = d3.scaleLinear().domain(yDom).range([plotHeight, 0])

  const clipId = `slope-ref-clip-${Math.round(plotWidth)}-${Math.round(plotHeight)}`
  plotG
    .append('defs')
    .append('clipPath')
    .attr('id', clipId)
    .append('rect')
    .attr('width', plotWidth)
    .attr('height', plotHeight)

  // Fill the plot box (same height as P1A; bottom axis lines up).
  plotG
    .append('rect')
    .attr('class', 'pop-slope-ref-frame')
    .attr('width', plotWidth)
    .attr('height', plotHeight)
    .attr('fill', '#f9fafb')
    .attr('stroke', '#d1d5db')
    .attr('stroke-width', 1)

  const xAxis = d3.axisBottom(xScale).ticks(4).tickSizeOuter(0)
  const yAxis = d3.axisLeft(yScale).ticks(4).tickSizeOuter(0)

  const xG = plotG
    .append('g')
    .attr('class', 'pop-slope-ref-x-axis')
    .attr('transform', `translate(0, ${plotHeight})`)
    .call(xAxis)
  xG.selectAll('text').attr('fill', '#4b5563').attr('font-size', 10)
  xG.selectAll('line').attr('stroke', '#9ca3af')
  xG.select('.domain').attr('stroke', '#9ca3af')

  const yG = plotG.append('g').attr('class', 'pop-slope-ref-y-axis').call(yAxis)
  yG.selectAll('text').attr('fill', '#4b5563').attr('font-size', 10)
  yG.selectAll('line').attr('stroke', '#9ca3af')
  yG.select('.domain').attr('stroke', '#9ca3af')

  if (!showLine) return

  const inner = plotG.append('g').attr('clip-path', `url(#${clipId})`)

  const yAt1 = slope * 1
  const x0 = xScale(0)!
  const y0 = yScale(0)!
  const x1 = xScale(1)!
  const y1 = yScale(yAt1)!

  inner
    .append('line')
    .attr('class', 'pop-slope-ref-line')
    .attr('x1', x0)
    .attr('y1', y0)
    .attr('x2', x1)
    .attr('y2', y1)
    .attr('stroke', SLOPE_LINE_COLOR)
    .attr('stroke-width', 2)
    .attr('stroke-linecap', 'round')

  appendSlopeFormula(inner, {
    className: 'pop-slope-formula',
    midX: (x0 + x1) / 2,
    anchorY: Math.min((y0 + y1) / 2, y0, y1) - 8,
    dyLabel,
    dxLabel,
    slopeLabel,
  })
}

function appendSlopeFormula(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  options: {
    className: string
    midX: number
    anchorY: number
    dyLabel: string
    dxLabel: string
    slopeLabel: string
  },
) {
  const { className, midX, anchorY, dyLabel, dxLabel, slopeLabel } = options
  const formula = parent
    .append('text')
    .attr('class', className)
    .attr('x', midX)
    .attr('y', Math.max(16, anchorY - 28))
    .attr('text-anchor', 'middle')
    .attr('fill', '#111827')
    .attr('font-size', 11)
    .attr('font-weight', 600)

  formula
    .append('tspan')
    .attr('x', midX)
    .attr('dy', 0)
    .text('slope = Δy / Δx')
  formula
    .append('tspan')
    .attr('x', midX)
    .attr('dy', 14)
    .text(`= ${dyLabel} / ${dxLabel}`)
  formula
    .append('tspan')
    .attr('x', midX)
    .attr('dy', 14)
    .attr('fill', DERIV_ARROW_COLOR)
    .text(`= ${slopeLabel}`)
}

export function clearSlopePopulation(parent: SVGGElement) {
  d3.select(parent).selectAll('*').remove()
}

/** Empty P2A scatter axes + P2B reference frame (same layout as P1). */
export function drawSampleSlopeChrome(
  sampleGroup: SVGGElement,
  options: {
    split: SlopePaneSplit
    plotHeight: number
    xDomain: [number, number]
    yDomain: [number, number]
    slope: number
    panelYDomain: [number, number]
  },
) {
  const root = d3.select(sampleGroup)
  // Keep historical slope lines; rebuild chrome shells.
  root.selectAll('.sample-slope-scatter-chrome, .sample-slope-panel-chrome').remove()

  const { split, plotHeight, xDomain, yDomain, slope, panelYDomain } = options

  const scatterG = root
    .append('g')
    .attr('class', 'sample-slope-scatter-chrome')
    .attr('transform', `translate(${split.scatterPlotLeft}, 0)`)

  const xScale = d3.scaleLinear().domain(xDomain).range([0, split.scatterPlotWidth])
  const yScale = d3.scaleLinear().domain(yDomain).range([plotHeight, 0])
  drawScatterAxes(scatterG, xScale, yScale, split.scatterPlotWidth, plotHeight)

  // Layer for dots / current line / previous lines (above axes).
  if (root.select('.sample-slope-scatter-layer').empty()) {
    root
      .append('g')
      .attr('class', 'sample-slope-scatter-layer')
      .attr('transform', `translate(${split.scatterPlotLeft}, 0)`)
  } else {
    root
      .select('.sample-slope-scatter-layer')
      .attr('transform', `translate(${split.scatterPlotLeft}, 0)`)
  }

  const panelG = root
    .append('g')
    .attr('class', 'sample-slope-panel-chrome')
    .attr('transform', `translate(${split.slopePanelLeft}, 0)`)

  // Draw empty panel frame (axes only, no formula / no line).
  drawPopulationSlopePanel(panelG.node()!, {
    slope,
    triangle: null,
    panelWidth: split.slopePanelWidth,
    panelHeight: plotHeight,
    panelYDomain,
  })
  // Remove formula and line from chrome — trails live in a sibling layer.
  panelG.selectAll('.pop-slope-formula, .pop-slope-ref-line').remove()

  if (root.select('.sample-slope-panel-layer').empty()) {
    root
      .append('g')
      .attr('class', 'sample-slope-panel-layer')
      .attr('transform', `translate(${split.slopePanelLeft}, 0)`)
  } else {
    root
      .select('.sample-slope-panel-layer')
      .attr('transform', `translate(${split.slopePanelLeft}, 0)`)
  }

  // Chrome is re-appended above existing layers; raise layers so P2A/P2B
  // slope lines (and dots) stay visible above the panel frame fill.
  root.select('.sample-slope-scatter-layer').raise()
  root.select('.sample-slope-panel-layer').raise()

  return { xScale, yScale }
}

export function sampleScatterLayer(
  sampleGroup: SVGGElement,
): d3.Selection<SVGGElement, unknown, null, undefined> {
  return d3.select(sampleGroup).select<SVGGElement>('.sample-slope-scatter-layer')
}

export function samplePanelLayer(
  sampleGroup: SVGGElement,
): d3.Selection<SVGGElement, unknown, null, undefined> {
  return d3.select(sampleGroup).select<SVGGElement>('.sample-slope-panel-layer')
}

/** Fade current sample slope lines to previous-history style. */
export function archiveSampleSlopeLines(sampleGroup: SVGGElement) {
  const sel = d3.select(sampleGroup)
  sel
    .selectAll('.sample-slope-line.current, .sample-slope-panel-line.current')
    .classed('current', false)
    .attr('stroke', DIST_BARCODE_BLUE)
    .attr('stroke-opacity', PREVIOUS_STAT_OPACITY)
  sel.selectAll('.sample-slope-deriv').remove()
  sel.selectAll('.sample-slope-formula').remove()
  sel.selectAll('.sample-dot').remove()
}

export function clearSampleSlopeTransient(sampleGroup: SVGGElement) {
  const sel = d3.select(sampleGroup)
  sel.selectAll('.sample-dot').remove()
  sel.selectAll('.sample-slope-deriv').remove()
  sel.selectAll('.sample-slope-formula').remove()
  sel.selectAll('.sample-slope-line.current').remove()
  sel.selectAll('.sample-slope-panel-line.current').remove()
}

export function clearSampleSlopeHistory(sampleGroup: SVGGElement) {
  const sel = d3.select(sampleGroup)
  sel.selectAll('.sample-dot').remove()
  sel.selectAll('.sample-slope-deriv').remove()
  sel.selectAll('.sample-slope-formula').remove()
  sel.selectAll('.sample-slope-line').remove()
  sel.selectAll('.sample-slope-panel-line').remove()
}

export function appendSampleSlopeFit(
  sampleGroup: SVGGElement,
  options: {
    slope: number
    intercept: number
    xDomain: [number, number]
    yDomain: [number, number]
    xScale: d3.ScaleLinear<number, number>
    yScale: d3.ScaleLinear<number, number>
    split: SlopePaneSplit
    plotHeight: number
    panelYDomain: [number, number]
    showDerivation: boolean
    current?: boolean
    /** When false, skip P2B unit-run line (draw later). Default true. */
    includePanelLine?: boolean
  },
) {
  const {
    slope,
    intercept,
    xDomain,
    yDomain,
    xScale,
    yScale,
    split,
    plotHeight,
    panelYDomain,
    showDerivation,
    current = true,
    includePanelLine = true,
  } = options

  const scatterLayer = sampleScatterLayer(sampleGroup)
  const ends = lineEndpointsOnPlot(slope, intercept, xDomain, yDomain)
  if (ends) {
    scatterLayer
      .append('line')
      .attr('class', current ? 'sample-slope-line current' : 'sample-slope-line')
      .attr('x1', xScale(ends.x0)!)
      .attr('y1', yScale(ends.y0)!)
      .attr('x2', xScale(ends.x1)!)
      .attr('y2', yScale(ends.y1)!)
      .attr('stroke', current ? SLOPE_LINE_COLOR : DIST_BARCODE_BLUE)
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round')
      .attr('stroke-opacity', current ? 1 : PREVIOUS_STAT_OPACITY)
  }

  if (showDerivation && current) {
    const triangle = slopeDerivationTriangle(slope, intercept, xDomain, yDomain)
    if (triangle) {
      const derivG = scatterLayer.append('g').attr('class', 'sample-slope-deriv')
      drawDerivationArrows(derivG, triangle, xScale, yScale, 'sample')
    }
  }

  if (includePanelLine) {
    appendSampleSlopePanelLine(sampleGroup, {
      slope,
      intercept,
      xDomain,
      yDomain,
      split,
      plotHeight,
      panelYDomain,
      current,
      showFormula: current,
    })
  }
}

/** P2B: unit-run slope line (statistic of interest) + optional current equation. */
export function appendSampleSlopePanelLine(
  sampleGroup: SVGGElement,
  options: {
    slope: number
    intercept?: number
    xDomain: [number, number]
    yDomain: [number, number]
    split: SlopePaneSplit
    plotHeight: number
    panelYDomain: [number, number]
    current?: boolean
    /** Show slope = Δy/Δx equation for the current sample. Default: current. */
    showFormula?: boolean
  },
) {
  const {
    slope,
    intercept = 0,
    xDomain,
    yDomain,
    split,
    plotHeight,
    panelYDomain,
    current = true,
    showFormula = current,
  } = options

  const panelLayer = samplePanelLayer(sampleGroup)
  // Only one current equation at a time.
  panelLayer.selectAll('.sample-slope-formula').remove()

  const plotLeft = SLOPE_PANEL_Y_AXIS_WIDTH
  const plotWidth = Math.max(40, split.slopePanelWidth - plotLeft)
  const panelX = d3.scaleLinear().domain([0, 1]).range([0, plotWidth])
  const panelY = d3.scaleLinear().domain(panelYDomain).range([plotHeight, 0])

  const x0 = panelX(0)!
  const y0 = panelY(0)!
  const x1 = panelX(1)!
  const y1 = panelY(slope)!

  panelLayer
    .append('line')
    .attr('class', current ? 'sample-slope-panel-line current' : 'sample-slope-panel-line')
    .attr('transform', `translate(${plotLeft}, 0)`)
    .attr('x1', x0)
    .attr('y1', y0)
    .attr('x2', x1)
    .attr('y2', y1)
    .attr('stroke', current ? SLOPE_LINE_COLOR : DIST_BARCODE_BLUE)
    .attr('stroke-width', 2)
    .attr('stroke-linecap', 'round')
    .attr('stroke-opacity', current ? 1 : PREVIOUS_STAT_OPACITY)

  if (showFormula && current) {
    const triangle = slopeDerivationTriangle(slope, intercept, xDomain, yDomain)
    const dyLabel = triangle
      ? formatSlopeNumber(triangle.dy)
      : formatSlopeNumber(slope)
    const dxLabel = triangle ? formatSlopeNumber(triangle.dx) : '1'
    const formulaG = panelLayer
      .append('g')
      .attr('class', 'sample-slope-formula')
      .attr('transform', `translate(${plotLeft}, 0)`)
    appendSlopeFormula(formulaG, {
      className: 'sample-slope-formula-text',
      midX: (x0 + x1) / 2,
      anchorY: Math.min((y0 + y1) / 2, y0, y1) - 8,
      dyLabel,
      dxLabel,
      slopeLabel: formatSlopeNumber(slope),
    })
  }
}

/** Local (pane) endpoints for the P3A unit-run line: (0,0) → (1, slope). */
export function distSlopePanelEndpoints(
  slope: number,
  distSplit: DistSlopeSplit,
  panelHeight: number,
  panelYDomain: [number, number],
): { x0: number; y0: number; x1: number; y1: number } {
  const panelX = d3
    .scaleLinear()
    .domain([0, 1])
    .range([0, distSplit.panelPlotWidth])
  const panelY = d3.scaleLinear().domain(panelYDomain).range([panelHeight, 0])
  const plotOriginX = distSplit.panelLeft + distSplit.panelPlotLeft
  return {
    x0: plotOriginX + panelX(0)!,
    y0: panelY(0)!,
    x1: plotOriginX + panelX(1)!,
    y1: panelY(slope)!,
  }
}

export function distSlopePanelLayer(
  distGroup: SVGGElement,
): d3.Selection<SVGGElement, unknown, null, undefined> {
  return d3.select(distGroup).select<SVGGElement>('.dist-slope-panel-layer')
}

/** Fade current P3A slope lines to previous-history style. */
export function archiveDistSlopePanelLines(distGroup: SVGGElement) {
  d3.select(distGroup)
    .selectAll('.dist-slope-panel-line.current')
    .classed('current', false)
    .attr('stroke', DIST_BARCODE_BLUE)
    .attr('stroke-opacity', PREVIOUS_STAT_OPACITY)
}

export function appendDistSlopePanelLine(
  distGroup: SVGGElement,
  options: {
    slope: number
    distSplit: DistSlopeSplit
    plotHeight: number
    panelYDomain: [number, number]
    current?: boolean
  },
) {
  const {
    slope,
    distSplit,
    plotHeight,
    panelYDomain,
    current = true,
  } = options

  const layer = distSlopePanelLayer(distGroup)
  if (layer.empty()) return

  const ends = distSlopePanelEndpoints(
    slope,
    distSplit,
    plotHeight,
    panelYDomain,
  )
  // Endpoints are pane-local; layer is translated to panelLeft — convert.
  const x0 = ends.x0 - distSplit.panelLeft
  const x1 = ends.x1 - distSplit.panelLeft

  layer
    .append('line')
    .attr('class', current ? 'dist-slope-panel-line current' : 'dist-slope-panel-line')
    .attr('x1', x0)
    .attr('y1', ends.y0)
    .attr('x2', x1)
    .attr('y2', ends.y1)
    .attr('stroke', current ? SLOPE_LINE_COLOR : DIST_BARCODE_BLUE)
    .attr('stroke-width', 2)
    .attr('stroke-linecap', 'round')
    .attr('stroke-opacity', current ? 1 : PREVIOUS_STAT_OPACITY)
}

/**
 * P3 chrome: P3A unit-run panel (A-panel footprint, white, y=0 dotted) +
 * P3B horizontal slope heap (dots grow right from a left y-axis).
 */
export function drawDistSlopeChrome(
  distGroup: SVGGElement,
  options: {
    distSplit: DistSlopeSplit
    plotHeight: number
    /** P3A/P3B y-domain (includes 0; may clip extreme slopes). */
    distPanelYDomain: [number, number]
    populationSlope: number
    showPopulationRef?: boolean
  },
) {
  const root = d3.select(distGroup)
  root
    .selectAll(
      '.dist-slope-panel-chrome, .dist-slope-heap-chrome, .dist-slope-heap-axis',
    )
    .remove()
  // Keep trail lines + dots; rebuild chrome shells only.
  removeDistReferenceFromHeap(distGroup)

  const {
    distSplit,
    plotHeight,
    distPanelYDomain: yDom,
    populationSlope,
    showPopulationRef = true,
  } = options

  const panelG = root
    .append('g')
    .attr('class', 'dist-slope-panel-chrome')
    .attr('transform', `translate(${distSplit.panelLeft}, 0)`)

  drawDistSlopePanelChrome(panelG.node()!, {
    plotLeft: distSplit.panelPlotLeft,
    plotWidth: distSplit.panelPlotWidth,
    plotHeight,
    panelYDomain: yDom,
  })

  const clipId = `dist-slope-panel-clip-${Math.round(distSplit.panelPlotWidth)}-${Math.round(plotHeight)}`
  if (root.select('.dist-slope-panel-layer').empty()) {
    const layer = root
      .append('g')
      .attr('class', 'dist-slope-panel-layer')
      .attr('transform', `translate(${distSplit.panelLeft}, 0)`)
    layer
      .append('defs')
      .append('clipPath')
      .attr('id', clipId)
      .append('rect')
      .attr('x', distSplit.panelPlotLeft)
      .attr('y', 0)
      .attr('width', distSplit.panelPlotWidth)
      .attr('height', plotHeight)
    layer.attr('clip-path', `url(#${clipId})`)
  } else {
    const layer = root.select('.dist-slope-panel-layer')
    layer.attr('transform', `translate(${distSplit.panelLeft}, 0)`)
    let defs = layer.select<SVGDefsElement>('defs')
    if (defs.empty()) defs = layer.insert('defs', ':first-child')
    let clip = defs.select<SVGClipPathElement>(`#${clipId}`)
    if (clip.empty()) {
      // Drop any previous clip ids so resize doesn't accumulate dead clipPaths.
      defs.selectAll('clipPath').remove()
      clip = defs.append('clipPath').attr('id', clipId)
      clip.append('rect')
    }
    clip
      .select('rect')
      .attr('x', distSplit.panelPlotLeft)
      .attr('y', 0)
      .attr('width', distSplit.panelPlotWidth)
      .attr('height', plotHeight)
    layer.attr('clip-path', `url(#${clipId})`)
  }

  const heapG = root
    .append('g')
    .attr('class', 'dist-slope-heap-chrome')
    .attr('transform', `translate(${distSplit.heapLeft}, 0)`)

  const plotLeft = distSplit.heapPlotLeft
  const plotWidth = distSplit.heapPlotWidth
  const yScale = d3.scaleLinear().domain(yDom).range([plotHeight, 0])

  const plotG = heapG
    .append('g')
    .attr('class', 'dist-slope-heap-plot')
    .attr('transform', `translate(${plotLeft}, 0)`)

  plotG
    .append('rect')
    .attr('class', 'dist-slope-heap-frame')
    .attr('width', plotWidth)
    .attr('height', plotHeight)
    .attr('fill', '#f9fafb')
    .attr('stroke', '#d1d5db')
    .attr('stroke-width', 1)

  const yAxis = d3.axisLeft(yScale).ticks(4).tickSizeOuter(0)
  const yG = plotG.append('g').attr('class', 'dist-slope-heap-y-axis').call(yAxis)
  yG.selectAll('text').attr('fill', '#4b5563').attr('font-size', 10)
  yG.selectAll('line').attr('stroke', '#9ca3af')
  yG.select('.domain').attr('stroke', '#9ca3af')

  // Solid y=0 + dashed population slope (same grammar as k=2 P3); draw inside
  // the heap plot so they sit above the frame fill, below dist dots.
  if (showPopulationRef) {
    drawHorizontalDistTwoGroupReferenceLines(
      plotG.node()!,
      yScale,
      populationSlope,
      0,
      plotWidth,
      0,
    )
  }

  root.select('.dist-slope-panel-layer').raise()
  root.selectAll('.dist-dot').raise()
}

/** P3A frame: same plot footprint as P1A/P2A, white fill, dotted y=0. */
function drawDistSlopePanelChrome(
  parent: SVGGElement,
  options: {
    plotLeft: number
    plotWidth: number
    plotHeight: number
    panelYDomain: [number, number]
  },
) {
  const g = d3.select(parent)
  g.selectAll('*').remove()

  const { plotLeft, plotWidth, plotHeight, panelYDomain: yDom } = options
  const plotG = g
    .append('g')
    .attr('class', 'dist-slope-ref-plot')
    .attr('transform', `translate(${plotLeft}, 0)`)

  const xScale = d3.scaleLinear().domain([0, 1]).range([0, plotWidth])
  const yScale = d3.scaleLinear().domain(yDom).range([plotHeight, 0])

  plotG
    .append('rect')
    .attr('class', 'dist-slope-ref-frame')
    .attr('width', plotWidth)
    .attr('height', plotHeight)
    .attr('fill', '#ffffff')
    .attr('stroke', '#d1d5db')
    .attr('stroke-width', 1)

  // Dotted baseline at y = 0 (intercept of every unit-run line).
  const y0 = yScale(0)
  if (y0 != null && Number.isFinite(y0)) {
    plotG
      .append('line')
      .attr('class', 'dist-slope-zero-line')
      .attr('x1', 0)
      .attr('x2', plotWidth)
      .attr('y1', y0)
      .attr('y2', y0)
      .attr('stroke', ZERO_LINE_COLOR)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3')
  }

  const xAxis = d3.axisBottom(xScale).ticks(4).tickSizeOuter(0)
  const yAxis = d3.axisLeft(yScale).ticks(4).tickSizeOuter(0)

  const xG = plotG
    .append('g')
    .attr('class', 'dist-slope-ref-x-axis')
    .attr('transform', `translate(0, ${plotHeight})`)
    .call(xAxis)
  xG.selectAll('text').attr('fill', '#4b5563').attr('font-size', 10)
  xG.selectAll('line').attr('stroke', '#9ca3af')
  xG.select('.domain').attr('stroke', '#9ca3af')

  const yG = plotG.append('g').attr('class', 'dist-slope-ref-y-axis').call(yAxis)
  yG.selectAll('text').attr('fill', '#4b5563').attr('font-size', 10)
  yG.selectAll('line').attr('stroke', '#9ca3af')
  yG.select('.domain').attr('stroke', '#9ca3af')
}

function removeDistReferenceFromHeap(distGroup: SVGGElement) {
  d3.select(distGroup)
    .selectAll(
      '.dist-pop-stat-line, .dist-pop-stat-line-halo, .dist-zero-line, .dist-zero-line-halo',
    )
    .remove()
}

export function clearDistSlopeContent(distGroup: SVGGElement) {
  const sel = d3.select(distGroup)
  sel.selectAll('.dist-dot').remove()
  sel.selectAll('.dist-slope-panel-line').remove()
}

export function clearDistSlopeAll(distGroup: SVGGElement) {
  d3.select(distGroup).selectAll('*').remove()
}
