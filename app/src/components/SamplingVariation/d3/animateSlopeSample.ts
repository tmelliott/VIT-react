import * as d3 from 'd3'
import { delay, type AnimSignal } from './animateSample'
import { type PaneLayout, PANE, toAbsolute } from './paneCoords'
import {
  SAMPLE_DOT_COLOR,
  SAMPLE_DOT_OPACITY,
  POP_DOT_STROKE,
  POP_DOT_STROKE_OPACITY,
  POP_DOT_STROKE_WIDTH,
  DIST_DOT_COLOR,
  DIST_DOT_OPACITY,
  DIST_BARCODE_VLINE_COLOR,
} from './paneStyle'
import { leastSquares } from './slopeMath'
import {
  appendDistSlopePanelLine,
  appendSampleSlopeFit,
  appendSampleSlopePanelLine,
  archiveDistSlopePanelLines,
  archiveSampleSlopeLines,
  clearDistSlopeContent,
  clearSampleSlopeHistory,
  clearSampleSlopeTransient,
  distSlopePanelEndpoints,
  drawSampleSlopeChrome,
  lineEndpointsOnPlot,
  sampleScatterLayer,
  type DistSlopeSplit,
  type SlopePaneSplit,
} from './slopeScatter'
import {
  appendDistDotElement,
  horizontalDistTarget,
  sortRepsByDistX,
  type DistLayout,
} from './distPhysics'
import type { SampleAnimationTiming, MValue } from '../types'

export type { AnimSignal }

const POINT_HIGHLIGHT_SLOW_COUNT = 5

/** Yield so DOM updates from the current step are painted before the next frame. */
function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

async function holdFastStepFrame(
  signal: AnimSignal,
  timingMs: number,
): Promise<void> {
  if (signal.aborted) return
  await waitForPaint()
  await delay(timingMs, signal)
}

function popScatterRoot(popGroup: SVGGElement): SVGGElement | null {
  return d3.select(popGroup).select<SVGGElement>('.pop-slope-scatter').node()
}

function popHighlightLayer(scatterRoot: SVGGElement): SVGGElement {
  const sel = d3.select(scatterRoot)
  let layer = sel.select<SVGGElement>('.pop-highlight-layer')
  if (layer.empty()) {
    // Prefer the plot group so highlights share the scatter clip/stacking context.
    const plot = sel.select<SVGGElement>('.pop-scatter-plot')
    const parent = plot.empty() ? sel : plot
    layer = parent.append('g').attr('class', 'pop-highlight-layer')
  }
  const node = layer.node()!
  node.parentNode?.appendChild(node)
  return node
}

function clearSlopeHighlights(popGroup: SVGGElement) {
  const scatter = popScatterRoot(popGroup)
  if (!scatter) return
  const root = d3.select(scatter)
  root.selectAll('.pop-highlight-layer').remove()
  // Restore hollow population dots after a sample highlight cycle.
  root
    .selectAll<SVGCircleElement, unknown>('.pop-scatter-dot')
    .attr('fill', 'none')
    .attr('stroke', POP_DOT_STROKE)
    .attr('stroke-width', POP_DOT_STROKE_WIDTH)
    .attr('stroke-opacity', POP_DOT_STROKE_OPACITY)
}

async function highlightSlopePoints(
  popGroup: SVGGElement,
  populationX: number[],
  populationY: number[],
  sampleIndices: number[],
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  radius: number,
  pointHighlightMs: number,
  pointHighlightFastMs: number,
  signal: AnimSignal,
): Promise<void> {
  const scatter = popScatterRoot(popGroup)
  if (!scatter) return
  const layer = popHighlightLayer(scatter)
  const popDots = d3
    .select(scatter)
    .selectAll<SVGCircleElement, unknown>('.pop-scatter-dot')
  const highlighted: number[] = []
  for (let i = 0; i < sampleIndices.length; i++) {
    const popIdx = sampleIndices[i]!
    if (signal.aborted) return
    highlighted.push(popIdx)

    // Fill the existing hollow population dot so sampling is obvious.
    popDots
      .filter(function () {
        return Number(this.getAttribute('data-pop-idx')) === popIdx
      })
      .attr('fill', SAMPLE_DOT_COLOR)
      .attr('fill-opacity', 1)
      .attr('stroke', SAMPLE_DOT_COLOR)
      .attr('stroke-opacity', 1)
      .raise()

    d3.select(layer)
      .selectAll<SVGCircleElement, number>('.highlight')
      .data(highlighted, (d) => d)
      .join('circle')
      .attr('class', 'highlight')
      .attr('cx', (idx) => xScale(populationX[idx]!)!)
      .attr('cy', (idx) => yScale(populationY[idx]!)!)
      .attr('r', radius)
      .attr('fill', SAMPLE_DOT_COLOR)
      .attr('fill-opacity', 1)
      .attr('stroke', 'none')
      .raise()
    const ms =
      i < POINT_HIGHLIGHT_SLOW_COUNT ? pointHighlightMs : pointHighlightFastMs
    await delay(ms, signal)
  }
}

function transitionPromise(
  selection: d3.Selection<SVGCircleElement, number, SVGGElement, unknown>,
  signal: AnimSignal,
  apply: (
    t: d3.Transition<SVGCircleElement, number, SVGGElement, unknown>,
  ) => d3.Transition<SVGCircleElement, number, SVGGElement, unknown>,
): Promise<void> {
  if (signal.aborted || selection.empty()) return Promise.resolve()
  return new Promise((resolve) => {
    const t = selection.transition()
    apply(t)
      .on('end', () => resolve())
      .on('interrupt', () => resolve())
  })
}

/**
 * Morph a line while preserving on-screen angle: lerp the left endpoint and
 * length (and angle only if start/end differ). Plain endpoint lerping rotates
 * the segment mid-flight even when start and end share the same slope.
 */
function transitionLinePreserveAngle(
  line: d3.Selection<SVGLineElement, unknown, null, undefined>,
  start: { x1: number; y1: number; x2: number; y2: number },
  end: { x1: number; y1: number; x2: number; y2: number },
  duration: number,
  signal: AnimSignal,
): Promise<void> {
  if (line.empty() || signal.aborted) return Promise.resolve()
  if (duration <= 0) {
    line
      .attr('x1', end.x1)
      .attr('y1', end.y1)
      .attr('x2', end.x2)
      .attr('y2', end.y2)
    return Promise.resolve()
  }

  const startDx = start.x2 - start.x1
  const startDy = start.y2 - start.y1
  const endDx = end.x2 - end.x1
  const endDy = end.y2 - end.y1
  const startLen = Math.hypot(startDx, startDy)
  const endLen = Math.hypot(endDx, endDy)
  const startAngle = Math.atan2(startDy, startDx)
  const endAngle = Math.atan2(endDy, endDx)

  line
    .attr('x1', start.x1)
    .attr('y1', start.y1)
    .attr('x2', start.x2)
    .attr('y2', start.y2)

  return new Promise((resolve) => {
    line
      .transition()
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .tween('preserve-angle', () => {
        const x1i = d3.interpolateNumber(start.x1, end.x1)
        const y1i = d3.interpolateNumber(start.y1, end.y1)
        const lenI = d3.interpolateNumber(startLen, endLen)
        const angI = d3.interpolateNumber(startAngle, endAngle)
        return (t) => {
          const x1 = x1i(t)
          const y1 = y1i(t)
          const len = lenI(t)
          const ang = angI(t)
          line
            .attr('x1', x1)
            .attr('y1', y1)
            .attr('x2', x1 + Math.cos(ang) * len)
            .attr('y2', y1 + Math.sin(ang) * len)
        }
      })
      .on('end', () => {
        line
          .attr('x1', end.x1)
          .attr('y1', end.y1)
          .attr('x2', end.x2)
          .attr('y2', end.y2)
        resolve()
      })
      .on('interrupt', () => resolve())
  })
}

function transitionCircleTo(
  circle: d3.Selection<SVGCircleElement, unknown, null, undefined>,
  endX: number,
  endY: number,
  duration: number,
  signal: AnimSignal,
): Promise<void> {
  if (circle.empty() || signal.aborted) return Promise.resolve()
  if (duration <= 0) {
    circle.attr('cx', endX).attr('cy', endY)
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    circle
      .transition()
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .attr('cx', endX)
      .attr('cy', endY)
      .on('end', () => resolve())
      .on('interrupt', () => resolve())
  })
}

export type SlopeSampleAnimContext = {
  popGroup: SVGGElement
  sampleGroup: SVGGElement
  distGroup: SVGGElement
  flyGroup: SVGGElement
  paneLayout: PaneLayout
  populationX: number[]
  populationY: number[]
  sampleIndices: number[]
  sampleStat: number
  popX: d3.ScaleLinear<number, number>
  popYScale: d3.ScaleLinear<number, number>
  sampleX: d3.ScaleLinear<number, number>
  sampleYScale: d3.ScaleLinear<number, number>
  distY: d3.ScaleLinear<number, number>
  distLayout: DistLayout
  xDomain: [number, number]
  yDomain: [number, number]
  panelYDomain: [number, number]
  distPanelYDomain: [number, number]
  split: SlopePaneSplit
  distSplit: DistSlopeSplit
  scatterPlotHeight: number
  scatterPlotLeft: number
  distBaselineX: number
  dotRadius: number
  signal: AnimSignal
  timingMs: number
  sampleTiming: SampleAnimationTiming
  m: MValue
  accumulateOnly: boolean
  includeDist: boolean
  replicateIndex: number
}

async function dropSlopeToDist(
  ctx: {
    sampleGroup: SVGGElement
    distGroup: SVGGElement
    flyGroup: SVGGElement
    paneLayout: PaneLayout
    slope: number
    intercept: number
    sampleStat: number
    sampleX: d3.ScaleLinear<number, number>
    sampleYScale: d3.ScaleLinear<number, number>
    distY: d3.ScaleLinear<number, number>
    distLayout: DistLayout
    xDomain: [number, number]
    yDomain: [number, number]
    distPanelYDomain: [number, number]
    split: SlopePaneSplit
    distSplit: DistSlopeSplit
    scatterPlotHeight: number
    scatterPlotLeft: number
    distBaselineX: number
    dotRadius: number
    signal: AnimSignal
    sampleTiming: SampleAnimationTiming
    animate: boolean
    replicateIndex: number
  },
): Promise<void> {
  const {
    distGroup,
    flyGroup,
    paneLayout,
    slope,
    intercept,
    sampleStat,
    sampleX,
    sampleYScale,
    distY,
    distLayout,
    xDomain,
    yDomain,
    distPanelYDomain,
    split,
    distSplit,
    scatterPlotHeight,
    scatterPlotLeft,
    distBaselineX,
    dotRadius,
    signal,
    sampleTiming,
    animate,
    replicateIndex,
  } = ctx

  const target = horizontalDistTarget(
    distLayout,
    replicateIndex,
    distY,
    sampleStat,
    distBaselineX,
  )
  if (!target) return

  archiveDistSlopePanelLines(distGroup)

  const p3Ends = distSlopePanelEndpoints(
    slope,
    distSplit,
    scatterPlotHeight,
    distPanelYDomain,
  )
  const endAbs = {
    x1: toAbsolute(paneLayout, PANE.DIST, p3Ends.x0, p3Ends.y0).x,
    y1: toAbsolute(paneLayout, PANE.DIST, p3Ends.x0, p3Ends.y0).y,
    x2: toAbsolute(paneLayout, PANE.DIST, p3Ends.x1, p3Ends.y1).x,
    y2: toAbsolute(paneLayout, PANE.DIST, p3Ends.x1, p3Ends.y1).y,
  }
  const distDotAbs = toAbsolute(paneLayout, PANE.DIST, target.x, target.y)

  if (!animate) {
    appendDistSlopePanelLine(distGroup, {
      slope,
      distSplit,
      plotHeight: scatterPlotHeight,
      panelYDomain: distPanelYDomain,
      current: true,
    })
    appendDistDotElement(
      distGroup,
      replicateIndex,
      sampleStat,
      target.x,
      target.y,
      dotRadius,
    )
    return
  }

  await delay(sampleTiming.distPreSlidePauseMs, signal)
  if (signal.aborted) return

  // Start from the P2A LS line (real intercept); morph to P3A unit-run (0 mid).
  const p2Ends = lineEndpointsOnPlot(slope, intercept, xDomain, yDomain)
  const startAbs = p2Ends
    ? {
        x1: toAbsolute(
          paneLayout,
          PANE.SAMPLE,
          scatterPlotLeft + sampleX(p2Ends.x0)!,
          sampleYScale(p2Ends.y0)!,
        ).x,
        y1: toAbsolute(
          paneLayout,
          PANE.SAMPLE,
          scatterPlotLeft + sampleX(p2Ends.x0)!,
          sampleYScale(p2Ends.y0)!,
        ).y,
        x2: toAbsolute(
          paneLayout,
          PANE.SAMPLE,
          scatterPlotLeft + sampleX(p2Ends.x1)!,
          sampleYScale(p2Ends.y1)!,
        ).x,
        y2: toAbsolute(
          paneLayout,
          PANE.SAMPLE,
          scatterPlotLeft + sampleX(p2Ends.x1)!,
          sampleYScale(p2Ends.y1)!,
        ).y,
      }
    : endAbs

  const flySel = d3.select(flyGroup)
  flySel.selectAll('.slope-line-fly, .slope-endpoint-fly').remove()

  const flyLine = flySel
    .append('line')
    .attr('class', 'slope-line-fly')
    .attr('x1', startAbs.x1)
    .attr('y1', startAbs.y1)
    .attr('x2', startAbs.x2)
    .attr('y2', startAbs.y2)
    .attr('stroke', DIST_BARCODE_VLINE_COLOR)
    .attr('stroke-width', 2)
    .attr('stroke-linecap', 'round')

  await transitionLinePreserveAngle(
    flyLine,
    startAbs,
    endAbs,
    sampleTiming.distArrowDropMs,
    signal,
  )
  if (signal.aborted) return

  appendDistSlopePanelLine(distGroup, {
    slope,
    distSplit,
    plotHeight: scatterPlotHeight,
    panelYDomain: distPanelYDomain,
    current: true,
  })

  // Point at the right endpoint of the unit-run line, then slide horizontally into P3B.
  const endpoint = flySel
    .append('circle')
    .attr('class', 'slope-endpoint-fly')
    .attr('cx', endAbs.x2)
    .attr('cy', endAbs.y2)
    .attr('r', dotRadius - 1)
    .attr('fill', DIST_DOT_COLOR)
    .attr('fill-opacity', DIST_DOT_OPACITY)
    .attr('stroke', 'none')

  await delay(sampleTiming.distPostArrowPauseMs * 0.5, signal)
  if (signal.aborted) return

  await transitionCircleTo(
    endpoint,
    distDotAbs.x,
    distDotAbs.y,
    sampleTiming.distArrowDropMs,
    signal,
  )
  if (signal.aborted) return

  appendDistDotElement(
    distGroup,
    replicateIndex,
    sampleStat,
    target.x,
    target.y,
    dotRadius,
  )
  flySel.selectAll('.slope-line-fly, .slope-endpoint-fly').remove()
}

export async function animateOneSlopeSample(
  ctx: SlopeSampleAnimContext,
): Promise<void> {
  const {
    popGroup,
    sampleGroup,
    distGroup,
    flyGroup,
    paneLayout,
    populationX,
    populationY,
    sampleIndices,
    popX,
    popYScale,
    sampleX,
    sampleYScale,
    distY,
    distLayout,
    xDomain,
    yDomain,
    panelYDomain,
    distPanelYDomain,
    split,
    distSplit,
    scatterPlotHeight,
    scatterPlotLeft,
    distBaselineX,
    dotRadius,
    signal,
    timingMs,
    sampleTiming,
    m,
    accumulateOnly,
    includeDist,
    replicateIndex,
  } = ctx

  const showSamplingAnimation = m < 20 && !includeDist
  const fullDistAnimation = includeDist && m < 20
  const fastStepHold = m === 20 && !showSamplingAnimation
  const radius = dotRadius

  // Ensure P2 chrome exists.
  drawSampleSlopeChrome(sampleGroup, {
    split,
    plotHeight: scatterPlotHeight,
    xDomain,
    yDomain,
    slope: ctx.sampleStat,
    panelYDomain,
  })

  archiveSampleSlopeLines(sampleGroup)
  clearSlopeHighlights(popGroup)
  d3.select(flyGroup).selectAll('.fly-dot, .slope-line-fly, .slope-endpoint-fly').remove()

  const sampleXs = sampleIndices.map((i) => populationX[i]!)
  const sampleYs = sampleIndices.map((i) => populationY[i]!)
  const fit = leastSquares(sampleXs, sampleYs)
  const slope = Number.isFinite(fit.slope) ? fit.slope : ctx.sampleStat
  const intercept = Number.isFinite(fit.intercept) ? fit.intercept : 0

  if (accumulateOnly) {
    // Instant: dots + fit + history already archived.
    const layer = sampleScatterLayer(sampleGroup)
    layer
      .selectAll<SVGCircleElement, number>('.sample-dot')
      .data(sampleIndices, (d) => d)
      .join('circle')
      .attr('class', 'sample-dot')
      .attr('cx', (_, j) => sampleX(sampleXs[j]!)!)
      .attr('cy', (_, j) => sampleYScale(sampleYs[j]!)!)
      .attr('r', radius)
      .attr('fill', SAMPLE_DOT_COLOR)
      .attr('fill-opacity', SAMPLE_DOT_OPACITY)
      .attr('stroke', 'none')

    appendSampleSlopeFit(sampleGroup, {
      slope,
      intercept,
      xDomain,
      yDomain,
      xScale: sampleX,
      yScale: sampleYScale,
      split,
      plotHeight: scatterPlotHeight,
      panelYDomain,
      showDerivation: false,
      current: true,
    })
    if (includeDist) {
      await dropSlopeToDist({
        sampleGroup,
        distGroup,
        flyGroup,
        paneLayout,
        slope,
        intercept,
        sampleStat: ctx.sampleStat,
        sampleX,
        sampleYScale,
        distY,
        distLayout,
        xDomain,
        yDomain,
        distPanelYDomain,
        split,
        distSplit,
        scatterPlotHeight,
        scatterPlotLeft,
        distBaselineX,
        dotRadius,
        signal,
        sampleTiming,
        animate: false,
        replicateIndex,
      })
    }
    await delay(timingMs, signal)
    return
  }

  if (showSamplingAnimation) {
    await highlightSlopePoints(
      popGroup,
      populationX,
      populationY,
      sampleIndices,
      popX,
      popYScale,
      radius,
      sampleTiming.pointHighlightMs,
      sampleTiming.pointHighlightFastMs,
      signal,
    )
    if (signal.aborted) return

    await delay(sampleTiming.sampleCompletePauseMs, signal)
    if (signal.aborted) return

    const flyers = d3
      .select(flyGroup)
      .selectAll<SVGCircleElement, number>('.fly-dot')
      .data(sampleIndices, (d) => d)
      .join('circle')
      .attr('class', 'fly-dot')
      .attr('r', radius)
      .attr('fill', SAMPLE_DOT_COLOR)
      .attr('fill-opacity', SAMPLE_DOT_OPACITY)
      .attr('cx', (popIdx) => {
        const localX = scatterPlotLeft + popX(populationX[popIdx]!)!
        const localY = popYScale(populationY[popIdx]!)!
        return toAbsolute(paneLayout, PANE.DATA, localX, localY).x
      })
      .attr('cy', (popIdx) => {
        const localX = scatterPlotLeft + popX(populationX[popIdx]!)!
        const localY = popYScale(populationY[popIdx]!)!
        return toAbsolute(paneLayout, PANE.DATA, localX, localY).y
      })

    await transitionPromise(flyers, signal, (t) =>
      t
        .duration(sampleTiming.slideToSampleMs)
        .attr('cx', (_, i) => {
          const localX = scatterPlotLeft + sampleX(sampleXs[i]!)!
          const localY = sampleYScale(sampleYs[i]!)!
          return toAbsolute(paneLayout, PANE.SAMPLE, localX, localY).x
        })
        .attr('cy', (_, i) => {
          const localX = scatterPlotLeft + sampleX(sampleXs[i]!)!
          const localY = sampleYScale(sampleYs[i]!)!
          return toAbsolute(paneLayout, PANE.SAMPLE, localX, localY).y
        }),
    )
    if (signal.aborted) return

    d3.select(flyGroup).selectAll('.fly-dot').remove()
    clearSlopeHighlights(popGroup)
  }

  // Land dots in P2A.
  const layer = sampleScatterLayer(sampleGroup)
  layer
    .selectAll<SVGCircleElement, number>('.sample-dot')
    .data(sampleIndices, (d) => d)
    .join('circle')
    .attr('class', 'sample-dot')
    .attr('cx', (_, j) => sampleX(sampleXs[j]!)!)
    .attr('cy', (_, j) => sampleYScale(sampleYs[j]!)!)
    .attr('r', radius)
    .attr('fill', SAMPLE_DOT_COLOR)
    .attr('fill-opacity', SAMPLE_DOT_OPACITY)
    .attr('stroke', 'none')

  if (signal.aborted) return

  // LS line + rise/run on P2A, then the slope line on P2B.
  appendSampleSlopeFit(sampleGroup, {
    slope,
    intercept,
    xDomain,
    yDomain,
    xScale: sampleX,
    yScale: sampleYScale,
    split,
    plotHeight: scatterPlotHeight,
    panelYDomain,
    showDerivation: showSamplingAnimation,
    current: true,
    includePanelLine: !showSamplingAnimation,
  })

  if (showSamplingAnimation) {
    await delay(sampleTiming.statDisplayPauseMs * 0.35, signal)
    if (signal.aborted) return
    appendSampleSlopePanelLine(sampleGroup, {
      slope,
      intercept,
      xDomain,
      yDomain,
      split,
      plotHeight: scatterPlotHeight,
      panelYDomain,
      current: true,
      showFormula: true,
    })
    await delay(sampleTiming.statDisplayPauseMs, signal)
  }

  if (includeDist) {
    await dropSlopeToDist({
      sampleGroup,
      distGroup,
      flyGroup,
      paneLayout,
      slope,
      intercept,
      sampleStat: ctx.sampleStat,
      sampleX,
      sampleYScale,
      distY,
      distLayout,
      xDomain,
      yDomain,
      distPanelYDomain,
      split,
      distSplit,
      scatterPlotHeight,
      scatterPlotLeft,
      distBaselineX,
      dotRadius,
      signal,
      sampleTiming,
      animate: fullDistAnimation,
      replicateIndex,
    })
    if (fastStepHold) {
      await holdFastStepFrame(signal, timingMs)
    }
  } else if (fastStepHold) {
    await holdFastStepFrame(signal, timingMs)
  } else {
    // Sampling mode (M=1/5): hold so Go pacing stays readable.
    await delay(showSamplingAnimation ? timingMs : timingMs * 0.2, signal)
  }
}

export type SlopeSampleBatchContext = {
  popGroup: SVGGElement
  sampleGroup: SVGGElement
  distGroup: SVGGElement
  flyGroup: SVGGElement
  populationX: number[]
  populationY: number[]
  popX: d3.ScaleLinear<number, number>
  sampleX: d3.ScaleLinear<number, number>
  sampleYScale: d3.ScaleLinear<number, number>
  distY: d3.ScaleLinear<number, number>
  distLayout: DistLayout
  xDomain: [number, number]
  yDomain: [number, number]
  panelYDomain: [number, number]
  distPanelYDomain: [number, number]
  split: SlopePaneSplit
  distSplit: DistSlopeSplit
  scatterPlotHeight: number
  distBaselineX: number
  dotRadius: number
  signal: AnimSignal
  timingMs: number
  includeDist: boolean
  reps: Array<{
    replicateIndex: number
    sampleStat: number
    sampleIndices: number[]
  }>
  resetSample: boolean
}

export async function animateSlopeSampleBatch(
  ctx: SlopeSampleBatchContext,
): Promise<void> {
  const {
    sampleGroup,
    distGroup,
    populationX,
    populationY,
    sampleX,
    sampleYScale,
    distY,
    distLayout,
    xDomain,
    yDomain,
    panelYDomain,
    distPanelYDomain,
    split,
    distSplit,
    scatterPlotHeight,
    distBaselineX,
    dotRadius,
    signal,
    timingMs,
    includeDist,
    reps,
    resetSample,
  } = ctx

  if (resetSample) {
    clearSampleSlopeHistory(sampleGroup)
    if (includeDist) clearDistSlopeContent(distGroup)
  }

  drawSampleSlopeChrome(sampleGroup, {
    split,
    plotHeight: scatterPlotHeight,
    xDomain,
    yDomain,
    slope: reps[reps.length - 1]?.sampleStat ?? 0,
    panelYDomain,
  })

  for (let r = 0; r < reps.length; r++) {
    if (signal.aborted) return
    const rep = reps[r]!
    const isLast = r === reps.length - 1
    archiveSampleSlopeLines(sampleGroup)

    const sampleXs = rep.sampleIndices.map((i) => populationX[i]!)
    const sampleYs = rep.sampleIndices.map((i) => populationY[i]!)
    const fit = leastSquares(sampleXs, sampleYs)
    const slope = Number.isFinite(fit.slope) ? fit.slope : rep.sampleStat
    const intercept = Number.isFinite(fit.intercept) ? fit.intercept : 0

    if (isLast) {
      const layer = sampleScatterLayer(sampleGroup)
      layer
        .selectAll<SVGCircleElement, number>('.sample-dot')
        .data(rep.sampleIndices, (d) => d)
        .join('circle')
        .attr('class', 'sample-dot')
        .attr('cx', (_, j) => sampleX(sampleXs[j]!)!)
        .attr('cy', (_, j) => sampleYScale(sampleYs[j]!)!)
        .attr('r', dotRadius)
        .attr('fill', SAMPLE_DOT_COLOR)
        .attr('fill-opacity', SAMPLE_DOT_OPACITY)
        .attr('stroke', 'none')
    }

    appendSampleSlopeFit(sampleGroup, {
      slope,
      intercept,
      xDomain,
      yDomain,
      xScale: sampleX,
      yScale: sampleYScale,
      split,
      plotHeight: scatterPlotHeight,
      panelYDomain,
      showDerivation: false,
      current: isLast,
    })

    if (includeDist) {
      archiveDistSlopePanelLines(distGroup)
      appendDistSlopePanelLine(distGroup, {
        slope,
        distSplit,
        plotHeight: scatterPlotHeight,
        panelYDomain: distPanelYDomain,
        current: isLast,
      })
    }
  }

  if (includeDist) {
    const ordered = sortRepsByDistX(reps, distLayout)
    for (const rep of ordered) {
      if (signal.aborted) return
      const target = horizontalDistTarget(
        distLayout,
        rep.replicateIndex,
        distY,
        rep.sampleStat,
        distBaselineX,
      )
      if (!target) continue
      appendDistDotElement(
        distGroup,
        rep.replicateIndex,
        rep.sampleStat,
        target.x,
        target.y,
        dotRadius,
      )
    }
  }

  await delay(timingMs, signal)
}

export function clearSlopeAnimationLayers(
  popGroup: SVGGElement,
  sampleGroup: SVGGElement,
  flyGroup: SVGGElement,
  clearHistory: boolean,
  distGroup?: SVGGElement,
) {
  clearSlopeHighlights(popGroup)
  d3.select(flyGroup)
    .selectAll('.fly-dot, .slope-line-fly, .slope-endpoint-fly')
    .remove()
  if (clearHistory) {
    clearSampleSlopeHistory(sampleGroup)
    if (distGroup) clearDistSlopeContent(distGroup)
  } else {
    clearSampleSlopeTransient(sampleGroup)
  }
}
