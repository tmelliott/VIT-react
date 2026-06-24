import * as d3 from 'd3'
import {
  appendDistDotElement,
  distTarget,
  sortRepsByDistY,
  type DistLayout,
} from './distPhysics'
import {
  heapYForSampleInBand,
  sampleGroupStats,
  type GroupBand,
} from './groupLayout'
import { heapYValues } from './heapLayout'
import { animateDistArrowDrop } from './distArrowDrop'
import {
  appendSampleStatSummary,
  fadePreviousSampleSummaries,
  type StatKind,
} from './sampleStatSummary'
import { type PaneLayout, PANE, toAbsolute, toLocal } from './paneCoords'
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
  if (existing.empty()) {
    await fadePreviousSampleSummaries(sampleGroup, signal, timingMs)
    return
  }

  const duration = timingMs > 0 ? Math.min(300, timingMs * 0.3) : 0
  if (duration <= 0 || signal.aborted) {
    existing.attr('stroke-opacity', PREVIOUS_STAT_OPACITY)
    await fadePreviousSampleSummaries(sampleGroup, signal, timingMs)
    return
  }

  await new Promise<void>((resolve) => {
    existing
      .transition()
      .duration(duration)
      .attr('stroke-opacity', PREVIOUS_STAT_OPACITY)
      .on('end', () => resolve())
  })
  await fadePreviousSampleSummaries(sampleGroup, signal, timingMs)
}

function appendSampleStatLine(
  sampleGroup: SVGGElement,
  sampleX: d3.ScaleLinear<number, number>,
  sampleStat: number,
  boxTop: number,
  boxAreaHeight: number,
  dotRadius: number,
  replicateIndex: number,
  y1?: number,
  y2?: number,
  stroke = '#111',
) {
  const top = y1 ?? boxTop + dotRadius
  const bottom = y2 ?? boxTop + boxAreaHeight - dotRadius
  d3.select(sampleGroup)
    .append('line')
    .attr('class', 'sample-stat-line')
    .attr('data-index', replicateIndex)
    .attr('x1', sampleX(sampleStat)!)
    .attr('x2', sampleX(sampleStat)!)
    .attr('y1', top)
    .attr('y2', bottom)
    .attr('stroke', stroke)
    .attr('stroke-width', 2)
    .attr('stroke-opacity', 1)
}

function appendGroupedSampleStatLines(
  sampleGroup: SVGGElement,
  sampleX: d3.ScaleLinear<number, number>,
  groupStats: number[],
  bands: GroupBand[],
  replicateIndex: number,
) {
  for (const band of bands) {
    const stat = groupStats[band.index]
    if (stat == null || !Number.isFinite(stat)) continue
    appendSampleStatLine(
      sampleGroup,
      sampleX,
      stat,
      band.boxTop,
      band.boxAreaHeight,
      0,
      replicateIndex,
      band.top + 4,
      band.top + band.dotAreaHeight,
      band.color,
    )
  }
}

function appendGroupedSampleStats(
  sampleGroup: SVGGElement,
  sampleX: d3.ScaleLinear<number, number>,
  groupStats: number[],
  bands: GroupBand[],
  sampleIndices: number[],
  population: number[],
  statistic: 'mean' | 'median',
  statKind: StatKind,
  nGroups: number,
  replicateIndex: number,
  paneInnerHeight: number,
) {
  appendGroupedSampleStatLines(
    sampleGroup,
    sampleX,
    groupStats,
    bands,
    replicateIndex,
  )
  appendSampleStatSummary(
    sampleGroup,
    sampleX,
    groupStats,
    bands,
    sampleIndices,
    population,
    statistic,
    statKind,
    nGroups,
    replicateIndex,
    paneInnerHeight,
  )
}

function drawSampleDots(
  sampleGroup: SVGGElement,
  sampleIndices: number[],
  population: number[],
  populationGroup: number[],
  sampleX: d3.ScaleLinear<number, number>,
  baselineY: number,
  dotRadius: number,
  numCatMode: boolean,
  bands: GroupBand[],
) {
  if (numCatMode) {
    d3.select(sampleGroup).selectAll('.sample-dot').remove()
    for (const band of bands) {
      const indices: number[] = []
      const values: number[] = []
      for (const popIdx of sampleIndices) {
        if (populationGroup[popIdx] === band.index) {
          indices.push(popIdx)
          values.push(population[popIdx]!)
        }
      }
      if (values.length === 0) continue
      const sampleY = heapYForSampleInBand(values, sampleX, band, dotRadius)
      d3.select(sampleGroup)
        .selectAll<SVGCircleElement, number>(`.sample-dot-g${band.index}`)
        .data(indices, (d) => d)
        .join('circle')
        .attr('class', `sample-dot sample-dot-g${band.index}`)
        .attr('cx', (_, j) => sampleX(values[j]!)!)
        .attr('cy', (_, j) => sampleY[j]!)
        .attr('r', dotRadius)
        .attr('fill', band.color)
        .attr('fill-opacity', 0.75)
    }
    return
  }

  const sampleValues = sampleIndices.map((i) => population[i]!)
  const sampleY = heapYValues(sampleValues, sampleX, baselineY, dotRadius)
  d3.select(sampleGroup)
    .selectAll<SVGCircleElement, number>('.sample-dot')
    .data(sampleIndices, (d) => d)
    .join('circle')
    .attr('class', 'sample-dot')
    .attr('cx', (_, j) => sampleX(sampleValues[j]!)!)
    .attr('cy', (_, j) => sampleY[j]!)
    .attr('r', dotRadius)
    .attr('fill', '#2563eb')
    .attr('fill-opacity', 0.7)
}

export type SampleBatchRep = {
  replicateIndex: number
  sampleStat: number
  sampleIndices: number[]
}

export type SampleBatchAnimContext = {
  sampleGroup: SVGGElement
  distGroup: SVGGElement
  population: number[]
  populationGroup: number[]
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
  numCatMode: boolean
  groupBands: GroupBand[]
  nGroups: number
  statistic: 'mean' | 'median'
  statKind: StatKind
  paneInnerHeight: number
}

export async function animateSampleBatch(
  ctx: SampleBatchAnimContext,
): Promise<void> {
  const {
    sampleGroup,
    distGroup,
    population,
    populationGroup,
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
    numCatMode,
    groupBands,
    nGroups,
    statistic,
    statKind,
    paneInnerHeight,
  } = ctx

  if (signal.aborted || reps.length === 0) return

  drawSampleDots(
    sampleGroup,
    showcaseSampleIndices,
    population,
    populationGroup,
    sampleX,
    baselineY,
    dotRadius,
    numCatMode,
    groupBands,
  )

  d3.select(sampleGroup)
    .selectAll<SVGLineElement, unknown>('.sample-stat-line')
    .attr('stroke-opacity', PREVIOUS_STAT_OPACITY)
  await fadePreviousSampleSummaries(sampleGroup, signal, 0)

  for (const rep of reps) {
    if (numCatMode) {
      const groupStats = sampleGroupStats(
        rep.sampleIndices,
        population,
        populationGroup,
        nGroups,
        statistic,
      )
      appendGroupedSampleStats(
        sampleGroup,
        sampleX,
        groupStats,
        groupBands,
        rep.sampleIndices,
        population,
        statistic,
        statKind,
        nGroups,
        rep.replicateIndex,
        paneInnerHeight,
      )
    } else {
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
  populationGroup: number[]
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
  numCatMode: boolean
  groupBands: GroupBand[]
  nGroups: number
  statistic: 'mean' | 'median'
  statKind: StatKind
  paneInnerHeight: number
}

export async function animateOneSample(ctx: SampleAnimContext): Promise<void> {
  const {
    popGroup,
    sampleGroup,
    distGroup,
    flyGroup,
    paneLayout,
    population,
    populationGroup,
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
    numCatMode,
    groupBands,
    nGroups,
    statistic,
    statKind,
    paneInnerHeight,
  } = ctx

  if (signal.aborted) return

  const radius = dotRadius
  const sampleValues = sampleIndices.map((i) => population[i]!)
  const sampleY = numCatMode
    ? sampleIndices.map((popIdx) => {
        const g = populationGroup[popIdx] ?? 0
        const band = groupBands[g]
        if (!band) return baselineY
        const values = [population[popIdx]!]
        return heapYForSampleInBand(values, sampleX, band, radius)[0]!
      })
    : heapYValues(sampleValues, sampleX, baselineY, radius)

  const groupStats = numCatMode
    ? sampleGroupStats(
        sampleIndices,
        population,
        populationGroup,
        nGroups,
        statistic,
      )
    : []

  const appendStats = () => {
    if (numCatMode) {
      appendGroupedSampleStats(
        sampleGroup,
        sampleX,
        groupStats,
        groupBands,
        sampleIndices,
        population,
        statistic,
        statKind,
        nGroups,
        replicateIndex,
        paneInnerHeight,
      )
    } else {
      appendSampleStatLine(
        sampleGroup,
        sampleX,
        sampleStat,
        boxTop,
        boxAreaHeight,
        dotRadius,
        replicateIndex,
      )
    }
  }

  d3.select(sampleGroup)
    .selectAll(`.sample-stat-summary[data-index="${replicateIndex}"]`)
    .remove()
  d3.select(sampleGroup).selectAll('.sample-dot').remove()
  d3.select(flyGroup).selectAll('.fly-dot').remove()

  if (accumulateOnly) {
    d3.select(sampleGroup)
      .selectAll<SVGLineElement, unknown>('.sample-stat-line')
      .attr('stroke-opacity', PREVIOUS_STAT_OPACITY)
    await fadePreviousSampleSummaries(sampleGroup, signal, 0)
    if (signal.aborted) return

    appendStats()

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
    const highlight = d3
      .select(popGroup)
      .selectAll<SVGCircleElement, number>('.highlight')
      .data(sampleIndices, (d) => d)
      .join('circle')
      .attr('class', 'highlight')
      .attr('cx', (popIdx) => popX(population[popIdx]!)!)
      .attr('cy', (popIdx) => popY[popIdx]!)
      .attr('r', radius)
      .attr('fill', '#f97316')
      .attr('stroke', '#c2410c')
      .attr('stroke-width', 1.5)
      .attr('fill-opacity', 1)

    d3.select(popGroup)
      .selectAll<SVGCircleElement, number>('.pop-dot')
      .attr('fill-opacity', (_, i) =>
        sampleIndices.includes(i) ? 0.25 : numCatMode ? 0.35 : 0.55,
      )

    await delay(timingMs * 0.3, signal)
    if (signal.aborted) return

    const flyers = d3
      .select(flyGroup)
      .selectAll<SVGCircleElement, number>('.fly-dot')
      .data(sampleIndices, (d) => d)
      .join('circle')
      .attr('class', 'fly-dot')
      .attr('r', radius)
      .attr('fill', (popIdx) =>
        numCatMode
          ? groupBands[populationGroup[popIdx] ?? 0]?.color ?? '#2563eb'
          : '#2563eb',
      )
      .attr('fill-opacity', 0.9)
      .attr('cx', (popIdx) => {
        const localX = popX(population[popIdx]!)!
        const localY = popY[popIdx]!
        return toAbsolute(paneLayout, PANE.DATA, localX, localY).x
      })
      .attr('cy', (popIdx) => {
        const localX = popX(population[popIdx]!)!
        const localY = popY[popIdx]!
        return toAbsolute(paneLayout, PANE.DATA, localX, localY).y
      })

    highlight.remove()
    d3.select(popGroup)
      .selectAll<SVGCircleElement, number>('.pop-dot')
      .attr('fill-opacity', numCatMode ? 0.65 : 0.55)

    await transitionPromise(flyers, signal, (t) =>
      t.duration(timingMs * 0.5).attr('cx', (_, i) => {
        const localX = sampleX(sampleValues[i]!)!
        const localY = sampleY[i]!
        return toAbsolute(paneLayout, PANE.SAMPLE, localX, localY).x
      }).attr('cy', (_, i) => {
        const localX = sampleX(sampleValues[i]!)!
        const localY = sampleY[i]!
        return toAbsolute(paneLayout, PANE.SAMPLE, localX, localY).y
      }),
    )

    if (signal.aborted) return

    d3.select(flyGroup).selectAll('.fly-dot').remove()
    if (numCatMode) {
      drawSampleDots(
        sampleGroup,
        sampleIndices,
        population,
        populationGroup,
        sampleX,
        baselineY,
        radius,
        true,
        groupBands,
      )
    } else {
      d3.select(sampleGroup)
        .selectAll<SVGCircleElement, number>('.sample-dot')
        .data(sampleIndices, (d) => d)
        .join('circle')
        .attr('class', 'sample-dot')
        .attr('cx', (_, j) => sampleX(sampleValues[j]!)!)
        .attr('cy', (_, j) => sampleY[j]!)
        .attr('r', radius)
        .attr('fill', '#2563eb')
        .attr('fill-opacity', 0.7)
    }
  } else {
    drawSampleDots(
      sampleGroup,
      sampleIndices,
      population,
      populationGroup,
      sampleX,
      baselineY,
      radius,
      numCatMode,
      groupBands,
    )
  }

  if (signal.aborted) return

  await fadePreviousStatLines(sampleGroup, signal, timingMs)
  if (signal.aborted) return

  appendStats()

  if (!includeDist) {
    await delay(timingMs * 0.2, signal)
    return
  }

  await animateDistDrop({
    sampleGroup,
    distGroup,
    flyGroup,
    paneLayout,
    population,
    sampleStat,
    sampleIndices,
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
    numCatMode,
    statKind,
    nGroups,
    groupStats,
    paneInnerHeight,
    groupBands,
    statistic,
  })
}

export type DistAnimContext = {
  sampleGroup: SVGGElement
  distGroup: SVGGElement
  flyGroup: SVGGElement
  paneLayout: PaneLayout
  population: number[]
  sampleStat: number
  sampleIndices: number[]
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
  numCatMode: boolean
  statKind: StatKind
  nGroups: number
  groupStats: number[]
  paneInnerHeight: number
  groupBands: GroupBand[]
  statistic: 'mean' | 'median'
}

export async function animateDistDrop(ctx: DistAnimContext): Promise<void> {
  if (ctx.signal.aborted) return
  await animateDistArrowDrop(ctx)
}

export function clearFlyLayer(flyGroup: SVGGElement) {
  d3.select(flyGroup).selectAll('.fly-dot, .dist-arrow-fly, .dist-line-fly').remove()
}

export function clearSampleTransient(sampleGroup: SVGGElement) {
  d3.select(sampleGroup).selectAll('.sample-dot').remove()
  d3.select(sampleGroup).selectAll('.dist-marker').remove()
}

export function clearHighlights(popGroup: SVGGElement, numCatMode = false) {
  d3.select(popGroup).selectAll('.highlight').remove()
  d3.select(popGroup)
    .selectAll<SVGCircleElement, number>('.pop-dot')
    .attr('fill-opacity', numCatMode ? 0.65 : 0.55)
}

export function clearAllAnimationLayers(
  popGroup: SVGGElement,
  sampleGroup: SVGGElement,
  distGroup: SVGGElement,
  flyGroup: SVGGElement,
  keepStatLines = false,
  numCatMode = false,
) {
  clearHighlights(popGroup, numCatMode)
  clearFlyLayer(flyGroup)
  d3.select(sampleGroup).selectAll('.sample-dot').remove()
  if (!keepStatLines) {
    d3.select(sampleGroup).selectAll('.sample-stat-line').remove()
    d3.select(sampleGroup).selectAll('.sample-stat-summary').remove()
  }
  d3.select(distGroup).selectAll('.dist-dot').remove()
  d3.select(distGroup).selectAll('.dist-stat-arrow').remove()
}
