import * as d3 from 'd3'
import {
  appendDistDotElement,
  distTarget,
  sortRepsByDistY,
  type DistLayout,
} from './distPhysics'
import { heapYValues } from './heapLayout'
import { type PaneLayout, toAbsolute, toLocal } from './paneCoords'

export const PANE = { DATA: 0, SAMPLE: 1, DIST: 2 } as const
const PREVIOUS_STAT_OPACITY = 0.2

export type AnimSignal = {
  aborted: boolean
  paused: boolean
  waitIfPaused: () => Promise<void>
  abort: () => void
  pause: () => void
  resume: () => void
}

export function createAnimSignal(): AnimSignal {
  let pauseResolve: (() => void) | null = null
  const signal: AnimSignal = {
    aborted: false,
    paused: false,
    waitIfPaused: () => {
      if (!signal.paused || signal.aborted) return Promise.resolve()
      return new Promise<void>((resolve) => {
        pauseResolve = resolve
      })
    },
    abort: () => {
      signal.aborted = true
      signal.paused = false
      pauseResolve?.()
      pauseResolve = null
    },
    pause: () => {
      signal.paused = true
    },
    resume: () => {
      signal.paused = false
      pauseResolve?.()
      pauseResolve = null
    },
  }
  return signal
}

export function delay(ms: number, signal: AnimSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    const start = performance.now()
    const tick = (now: number) => {
      if (signal.aborted) {
        resolve()
        return
      }
      if (signal.paused) {
        signal.waitIfPaused().then(() => tick(performance.now()))
        return
      }
      if (now - start >= ms) {
        resolve()
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

function transitionPromise(
  selection: d3.Selection<SVGCircleElement, number, SVGGElement, unknown>,
  signal: AnimSignal,
  apply: (
    t: d3.Transition<SVGCircleElement, number, SVGGElement, unknown>,
  ) => d3.Transition<SVGCircleElement, number, SVGGElement, unknown>,
): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    const t = apply(selection.transition())
    t.on('end', () => resolve())
  })
}

async function fadePreviousStatLines(
  sampleGroup: SVGGElement,
  signal: AnimSignal,
  timingMs: number,
): Promise<void> {
  const existing = d3
    .select(sampleGroup)
    .selectAll<SVGLineElement, unknown>('.sample-stat-line')
  if (existing.empty()) return

  const duration = timingMs > 0 ? Math.min(300, timingMs * 0.3) : 0
  if (duration <= 0 || signal.aborted) {
    existing.attr('stroke-opacity', PREVIOUS_STAT_OPACITY)
    return
  }

  await new Promise<void>((resolve) => {
    existing
      .transition()
      .duration(duration)
      .attr('stroke-opacity', PREVIOUS_STAT_OPACITY)
      .on('end', () => resolve())
  })
}

function appendSampleStatLine(
  sampleGroup: SVGGElement,
  sampleX: d3.ScaleLinear<number, number>,
  sampleStat: number,
  boxTop: number,
  boxAreaHeight: number,
  dotRadius: number,
  replicateIndex: number,
) {
  const y1 = boxTop + dotRadius
  const y2 = boxTop + boxAreaHeight - dotRadius
  d3.select(sampleGroup)
    .append('line')
    .attr('class', 'sample-stat-line')
    .attr('data-index', replicateIndex)
    .attr('x1', sampleX(sampleStat)!)
    .attr('x2', sampleX(sampleStat)!)
    .attr('y1', y1)
    .attr('y2', y2)
    .attr('stroke', '#111')
    .attr('stroke-width', 2)
    .attr('stroke-opacity', 1)
}

function drawSampleDots(
  sampleGroup: SVGGElement,
  sampleIndices: number[],
  population: number[],
  sampleX: d3.ScaleLinear<number, number>,
  baselineY: number,
  dotRadius: number,
) {
  const sampleValues = sampleIndices.map((i) => population[i])
  const sampleY = heapYValues(sampleValues, sampleX, baselineY, dotRadius)
  d3.select(sampleGroup)
    .selectAll<SVGCircleElement, number>('.sample-dot')
    .data(sampleIndices, (d) => d)
    .join('circle')
    .attr('class', 'sample-dot')
    .attr('cx', (_, j) => sampleX(sampleValues[j])!)
    .attr('cy', (_, j) => sampleY[j]!)
    .attr('r', dotRadius)
    .attr('fill', '#2563eb')
    .attr('fill-opacity', 0.7)
}

export type SampleBatchRep = {
  replicateIndex: number
  sampleStat: number
}

export type SampleBatchAnimContext = {
  sampleGroup: SVGGElement
  distGroup: SVGGElement
  population: number[]
  showcaseSampleIndices: number[]
  sampleX: d3.ScaleLinear<number, number>
  distX: d3.ScaleLinear<number, number>
  distLayout: DistLayout
  paneLayout: PaneLayout
  baselineY: number
  distBaselineY: number
  dotRadius: number
  boxTop: number
  boxAreaHeight: number
  signal: AnimSignal
  timingMs: number
  includeDist: boolean
  reps: SampleBatchRep[]
}

export async function animateSampleBatch(
  ctx: SampleBatchAnimContext,
): Promise<void> {
  const {
    sampleGroup,
    distGroup,
    population,
    showcaseSampleIndices,
    sampleX,
    distX,
    distLayout,
    paneLayout,
    baselineY,
    distBaselineY,
    dotRadius,
    boxTop,
    boxAreaHeight,
    signal,
    timingMs,
    includeDist,
    reps,
  } = ctx

  if (signal.aborted || reps.length === 0) return

  drawSampleDots(
    sampleGroup,
    showcaseSampleIndices,
    population,
    sampleX,
    baselineY,
    dotRadius,
  )

  d3.select(sampleGroup)
    .selectAll<SVGLineElement, unknown>('.sample-stat-line')
    .attr('stroke-opacity', PREVIOUS_STAT_OPACITY)

  for (const rep of reps) {
    appendSampleStatLine(
      sampleGroup,
      sampleX,
      rep.sampleStat,
      boxTop,
      boxAreaHeight,
      dotRadius,
      rep.replicateIndex,
    )
  }

  if (includeDist) {
    for (const rep of sortRepsByDistY(reps, distLayout)) {
      const target = distTarget(
        distLayout,
        rep.replicateIndex,
        distX,
        rep.sampleStat,
        distBaselineY,
      )
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

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await delay(timingMs, signal)
}

export type SampleAnimContext = {
  popGroup: SVGGElement
  sampleGroup: SVGGElement
  distGroup: SVGGElement
  flyGroup: SVGGElement
  paneLayout: PaneLayout
  population: number[]
  popY: number[]
  sampleIndices: number[]
  sampleStat: number
  popX: d3.ScaleLinear<number, number>
  sampleX: d3.ScaleLinear<number, number>
  distX: d3.ScaleLinear<number, number>
  distLayout: DistLayout
  baselineY: number
  distBaselineY: number
  dotRadius: number
  boxTop: number
  boxAreaHeight: number
  signal: AnimSignal
  timingMs: number
  fullAnimation: boolean
  accumulateOnly: boolean
  includeDist: boolean
  replicateIndex: number
}

export async function animateOneSample(ctx: SampleAnimContext): Promise<void> {
  const {
    popGroup,
    sampleGroup,
    distGroup,
    flyGroup,
    paneLayout,
    population,
    popY,
    sampleIndices,
    sampleStat,
    popX,
    sampleX,
    distX,
    distLayout,
    baselineY,
    distBaselineY,
    dotRadius,
    boxTop,
    boxAreaHeight,
    signal,
    timingMs,
    fullAnimation,
    accumulateOnly,
    includeDist,
    replicateIndex,
  } = ctx

  if (signal.aborted) return

  const radius = dotRadius
  const sampleValues = sampleIndices.map((i) => population[i])
  const sampleY = heapYValues(sampleValues, sampleX, baselineY, radius)

  d3.select(sampleGroup).selectAll('.sample-dot').remove()
  d3.select(flyGroup).selectAll('.fly-dot').remove()

  if (accumulateOnly) {
    d3.select(sampleGroup)
      .selectAll<SVGLineElement, unknown>('.sample-stat-line')
      .attr('stroke-opacity', PREVIOUS_STAT_OPACITY)
    if (signal.aborted) return

    appendSampleStatLine(
      sampleGroup,
      sampleX,
      sampleStat,
      boxTop,
      boxAreaHeight,
      dotRadius,
      replicateIndex,
    )

    if (includeDist) {
      const target = distTarget(
        distLayout,
        replicateIndex,
        distX,
        sampleStat,
        distBaselineY,
      )
      appendDistDotElement(
        distGroup,
        replicateIndex,
        sampleStat,
        target.x,
        target.y,
        dotRadius,
      )
    }

    await delay(timingMs, signal)
    return
  }

  if (fullAnimation) {
    // Phase 1: highlight selected points in P1
    const highlight = d3
      .select(popGroup)
      .selectAll<SVGCircleElement, number>('.highlight')
      .data(sampleIndices, (d) => d)
      .join('circle')
      .attr('class', 'highlight')
      .attr('cx', (popIdx) => popX(population[popIdx])!)
      .attr('cy', (popIdx) => popY[popIdx]!)
      .attr('r', radius)
      .attr('fill', '#f97316')
      .attr('stroke', '#c2410c')
      .attr('stroke-width', 1.5)
      .attr('fill-opacity', 1)

    d3.select(popGroup)
      .selectAll<SVGCircleElement, number>('.pop-dot')
      .attr('fill-opacity', (d, i) =>
        sampleIndices.includes(i) ? 0.25 : 0.55,
      )

    await delay(timingMs * 0.3, signal)
    if (signal.aborted) return

    // Phase 2: fly from P1 → P2 in root SVG coordinates
    const flyers = d3
      .select(flyGroup)
      .selectAll<SVGCircleElement, number>('.fly-dot')
      .data(sampleIndices, (d) => d)
      .join('circle')
      .attr('class', 'fly-dot')
      .attr('r', radius)
      .attr('fill', '#2563eb')
      .attr('fill-opacity', 0.9)
      .attr('cx', (popIdx) => {
        const localX = popX(population[popIdx])!
        const localY = popY[popIdx]!
        return toAbsolute(paneLayout, PANE.DATA, localX, localY).x
      })
      .attr('cy', (popIdx) => {
        const localX = popX(population[popIdx])!
        const localY = popY[popIdx]!
        return toAbsolute(paneLayout, PANE.DATA, localX, localY).y
      })

    highlight.remove()
    d3.select(popGroup)
      .selectAll<SVGCircleElement, number>('.pop-dot')
      .attr('fill-opacity', 0.55)

    await transitionPromise(flyers, signal, (t) =>
      t.duration(timingMs * 0.5).attr('cx', (_, i) => {
        const localX = sampleX(sampleValues[i])!
        const localY = sampleY[i]!
        return toAbsolute(paneLayout, PANE.SAMPLE, localX, localY).x
      }).attr('cy', (_, i) => {
        const localX = sampleX(sampleValues[i])!
        const localY = sampleY[i]!
        return toAbsolute(paneLayout, PANE.SAMPLE, localX, localY).y
      }),
    )

    if (signal.aborted) return

    // Phase 3: settle into P2 local layer
    d3.select(flyGroup).selectAll('.fly-dot').remove()
    d3.select(sampleGroup)
      .selectAll<SVGCircleElement, number>('.sample-dot')
      .data(sampleIndices, (d) => d)
      .join('circle')
      .attr('class', 'sample-dot')
      .attr('cx', (_, j) => sampleX(sampleValues[j])!)
      .attr('cy', (_, j) => sampleY[j]!)
      .attr('r', radius)
      .attr('fill', '#2563eb')
      .attr('fill-opacity', 0.7)
  } else {
    drawSampleDots(
      sampleGroup,
      sampleIndices,
      population,
      sampleX,
      baselineY,
      radius,
    )
  }

  if (signal.aborted) return

  await fadePreviousStatLines(sampleGroup, signal, timingMs)
  if (signal.aborted) return

  appendSampleStatLine(
    sampleGroup,
    sampleX,
    sampleStat,
    boxTop,
    boxAreaHeight,
    dotRadius,
    replicateIndex,
  )

  if (!includeDist) {
    await delay(timingMs * 0.2, signal)
    return
  }

  await animateDistDrop({
    sampleGroup,
    distGroup,
    flyGroup,
    paneLayout,
    sampleStat,
    sampleX,
    distX,
    distLayout,
    distBaselineY,
    dotRadius,
    boxTop,
    boxAreaHeight,
    replicateIndex,
    timingMs,
    signal,
    fullAnimation,
  })
}

export type DistAnimContext = {
  sampleGroup: SVGGElement
  distGroup: SVGGElement
  flyGroup: SVGGElement
  paneLayout: PaneLayout
  sampleStat: number
  sampleX: d3.ScaleLinear<number, number>
  distX: d3.ScaleLinear<number, number>
  distLayout: DistLayout
  distBaselineY: number
  dotRadius: number
  boxTop: number
  boxAreaHeight: number
  replicateIndex: number
  timingMs: number
  signal: AnimSignal
  fullAnimation: boolean
}

export async function animateDistDrop(ctx: DistAnimContext): Promise<void> {
  const {
    sampleGroup,
    distGroup,
    flyGroup,
    paneLayout,
    sampleStat,
    sampleX,
    distX,
    distLayout,
    distBaselineY,
    dotRadius,
    boxTop,
    boxAreaHeight,
    replicateIndex,
    timingMs,
    signal,
    fullAnimation,
  } = ctx

  if (signal.aborted) return

  const target = distTarget(
    distLayout,
    replicateIndex,
    distX,
    sampleStat,
    distBaselineY,
  )
  const sampleLocalX = sampleX(sampleStat)!
  const statLineY = boxTop + boxAreaHeight / 2

  const startAbs = toAbsolute(paneLayout, PANE.SAMPLE, sampleLocalX, statLineY)
  const endAbs = toAbsolute(paneLayout, PANE.DIST, target.x, target.y)

  if (fullAnimation && timingMs > 0) {
    const marker = d3
      .select(flyGroup)
      .append('circle')
      .attr('class', 'dist-marker')
      .attr('cx', startAbs.x)
      .attr('cy', startAbs.y)
      .attr('r', dotRadius)
      .attr('fill', '#dc2626')
      .attr('fill-opacity', 0.95)

    await new Promise<void>((resolve) => {
      marker
        .transition()
        .duration(timingMs * 0.5)
        .attr('cx', endAbs.x)
        .attr('cy', endAbs.y)
        .on('end', () => {
          marker.remove()
          resolve()
        })
    })
  }

  if (signal.aborted) return

  appendDistDotElement(
    distGroup,
    replicateIndex,
    sampleStat,
    target.x,
    target.y,
    dotRadius,
  )

  await delay(timingMs * 0.1, signal)
}

export function clearFlyLayer(flyGroup: SVGGElement) {
  d3.select(flyGroup).selectAll('.fly-dot, .dist-marker').remove()
}

export function clearSampleTransient(sampleGroup: SVGGElement) {
  d3.select(sampleGroup).selectAll('.sample-dot').remove()
  d3.select(sampleGroup).selectAll('.dist-marker').remove()
}

export function clearHighlights(popGroup: SVGGElement) {
  d3.select(popGroup).selectAll('.highlight').remove()
  d3.select(popGroup)
    .selectAll<SVGCircleElement, number>('.pop-dot')
    .attr('fill-opacity', 0.55)
}

export function clearAllAnimationLayers(
  popGroup: SVGGElement,
  sampleGroup: SVGGElement,
  distGroup: SVGGElement,
  flyGroup: SVGGElement,
  keepStatLines = false,
) {
  clearHighlights(popGroup)
  clearFlyLayer(flyGroup)
  d3.select(sampleGroup).selectAll('.sample-dot').remove()
  if (!keepStatLines) {
    d3.select(sampleGroup).selectAll('.sample-stat-line').remove()
  }
  d3.select(distGroup).selectAll('.dist-dot').remove()
}
