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
  syncSampleBandLabels,
  groupColor,
  type GroupBand,
} from './groupLayout'
import { heapYValues } from './heapLayout'
import { distBaselineValue, usesBoxplotHighlight, type SamplingStatistic } from '../statistics'
import {
  drawHorizontalBoxplot,
  archiveSampleIqrToStack,
  clearSampleIqrStack,
  iqrSpanPixels,
  pushIqrLineToStack,
} from './boxplot'
import { animateDistArrowDrop, removeDistTransientOverlays } from './distArrowDrop'
import {
  appendSampleStatSummary,
  appendMultiGroupSampleStatMarkers,
  animateSampleDeviationSummary,
  animateTwoGroupSampleDiffSummary,
  appendTwoGroupBandSampleStat,
  sampleGrandStat,
  type StatKind,
} from './sampleStatSummary'
import { appendStatMarker } from './statMarker'
import { twoGroupDiffZone } from './groupLayout'
import {
  DIST_BARCODE_BLUE,
  DIST_BARCODE_BLUE_OPACITY,
  PREVIOUS_STAT_OPACITY,
  SAMPLE_DOT_COLOR,
  SAMPLE_DOT_OPACITY,
} from './paneStyle'
import { type PaneLayout, PANE, toAbsolute } from './paneCoords'
import type { SampleAnimationTiming, MValue } from '../types'

const INSTANT_TWO_GROUP_SUMMARY_TIMING = {
  twoGroupDropLineMs: 0,
  twoGroupPreArrowPauseMs: 0,
  twoGroupArrowMs: 0,
} as const satisfies Pick<
  SampleAnimationTiming,
  'twoGroupDropLineMs' | 'twoGroupPreArrowPauseMs' | 'twoGroupArrowMs'
>

function avgDevCenterStat(
  numCatMode: boolean,
  statKind: StatKind,
  nGroups: number,
  sampleIndices: number[],
  population: number[],
  statistic: SamplingStatistic,
  populationGrandStat: number,
): number {
  if (numCatMode && statKind === 'average_deviation' && nGroups >= 3) {
    return sampleGrandStat(sampleIndices, population, statistic)
  }
  return populationGrandStat
}

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

/** Yield so DOM updates from the current step are painted before the next frame. */
function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

async function holdFastStepFrame(signal: AnimSignal, timingMs: number): Promise<void> {
  if (signal.aborted) return
  await waitForPaint()
  await delay(timingMs, signal)
}

function transitionPromiseGeneric<T extends d3.BaseType>(
  selection: d3.Selection<T, unknown, SVGGElement, unknown>,
  signal: AnimSignal,
  apply: (
    t: d3.Transition<T, unknown, SVGGElement, unknown>,
  ) => d3.Transition<T, unknown, SVGGElement, unknown>,
): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    const t = apply(selection.transition())
    t.on('end', () => resolve())
  })
}

function transitionPromise(
  selection: d3.Selection<SVGCircleElement, number, SVGGElement, unknown>,
  signal: AnimSignal,
  apply: (
    t: d3.Transition<SVGCircleElement, number, SVGGElement, unknown>,
  ) => d3.Transition<SVGCircleElement, number, SVGGElement, unknown>,
): Promise<void> {
  return transitionPromiseGeneric(selection, signal, apply)
}

/** First N sample points use {@link SampleAnimationTiming.pointHighlightMs}. */
const POINT_HIGHLIGHT_SLOW_COUNT = 5

function groupColorForPopIndex(
  popIdx: number,
  populationGroup: number[],
  bands: GroupBand[],
): string {
  const gi = populationGroup[popIdx] ?? 0
  return bands.find((b) => b.index === gi)?.color ?? groupColor(gi)
}

function samplePointFill(
  popIdx: number,
  numCatMode: boolean,
  populationGroup: number[],
  bands: GroupBand[],
): string {
  if (numCatMode) {
    return groupColorForPopIndex(popIdx, populationGroup, bands)
  }
  return SAMPLE_DOT_COLOR
}

function popHighlightLayer(popGroup: SVGGElement): SVGGElement {
  const sel = d3.select(popGroup)
  let layer = sel.select<SVGGElement>('.pop-highlight-layer')
  if (layer.empty()) {
    layer = sel.append('g').attr('class', 'pop-highlight-layer')
  }
  const node = layer.node()!
  node.parentNode?.appendChild(node)
  return node
}

async function highlightSamplePointsOneByOne(
  popGroup: SVGGElement,
  population: number[],
  popX: d3.ScaleLinear<number, number>,
  popY: number[],
  sampleIndices: number[],
  radius: number,
  pointHighlightMs: number,
  pointHighlightFastMs: number,
  signal: AnimSignal,
  numCatMode: boolean,
  populationGroup: number[],
  groupBands: GroupBand[],
): Promise<void> {
  const layer = popHighlightLayer(popGroup)
  const highlighted: number[] = []
  for (let i = 0; i < sampleIndices.length; i++) {
    const popIdx = sampleIndices[i]!
    if (signal.aborted) return
    highlighted.push(popIdx)
    d3.select(layer)
      .selectAll<SVGCircleElement, number>('.highlight')
      .data(highlighted, (d) => d)
      .join('circle')
      .attr('class', 'highlight')
      .attr('cx', (idx) => popX(population[idx]!)!)
      .attr('cy', (idx) => popY[idx]!)
      .attr('r', radius)
      .attr('fill', (idx) =>
        samplePointFill(idx, numCatMode, populationGroup, groupBands),
      )
      .attr('fill-opacity', 1)
      .attr('stroke', 'none')
      .raise()
    const ms =
      i < POINT_HIGHLIGHT_SLOW_COUNT ? pointHighlightMs : pointHighlightFastMs
    await delay(ms, signal)
  }
}

function appendOneNumSampleStat(
  sampleGroup: SVGGElement,
  sampleX: d3.ScaleLinear<number, number>,
  sampleStat: number,
  sampleValues: number[],
  statistic: SamplingStatistic,
  statZoneTop: number,
  boxTop: number,
  boxAreaHeight: number,
  dotRadius: number,
  replicateIndex: number,
  current = true,
) {
  const x = sampleX(sampleStat)!
  const lineTop = statZoneTop + 6 + 8
  const lineBottom = boxTop + boxAreaHeight - dotRadius
  const verticalSpan = lineBottom - lineTop
  const midY = (lineTop + lineBottom) / 2
  const blueHalfHeight = verticalSpan / 4
  const blueTop = midY - blueHalfHeight
  const blueBottom = midY + blueHalfHeight
  const opacity = current ? DIST_BARCODE_BLUE_OPACITY : PREVIOUS_STAT_OPACITY
  const boxY = boxTop + dotRadius
  const boxHeight = boxAreaHeight - dotRadius * 2

  if (statistic === 'iqr') {
    if (current) {
      drawHorizontalBoxplot(
        sampleGroup,
        sampleValues,
        sampleX,
        boxY,
        boxHeight,
        'sample-boxplot',
        { highlight: 'iqr' },
      )
      d3.select(sampleGroup).select('.sample-iqr-stack').lower()
      d3.select(sampleGroup).select('.sample-boxplot').raise()
    } else {
      const span = iqrSpanPixels(sampleValues, sampleX)
      if (span) {
        pushIqrLineToStack(
          sampleGroup,
          span.xQ1,
          span.xQ3,
          boxY,
          boxHeight,
          replicateIndex,
        )
      }
    }
    return
  }

  if (usesBoxplotHighlight(statistic)) {
    if (current) {
      drawHorizontalBoxplot(
        sampleGroup,
        sampleValues,
        sampleX,
        boxY,
        boxHeight,
        'sample-boxplot',
        { highlight: statistic },
      )
    }
    d3.select(sampleGroup)
      .append('line')
      .attr('class', 'sample-stat-barcode-vline')
      .attr('data-index', replicateIndex)
      .attr('x1', x)
      .attr('x2', x)
      .attr('y1', blueTop)
      .attr('y2', blueBottom)
      .attr('stroke', DIST_BARCODE_BLUE)
      .attr('stroke-width', 3)
      .attr('stroke-linecap', 'round')
      .attr('opacity', opacity)
    return
  }

  d3.select(sampleGroup)
    .append('line')
    .attr('class', 'sample-stat-barcode-vline')
    .attr('data-index', replicateIndex)
    .attr('x1', x)
    .attr('x2', x)
    .attr('y1', blueTop)
    .attr('y2', blueBottom)
    .attr('stroke', DIST_BARCODE_BLUE)
    .attr('stroke-width', 3)
    .attr('stroke-linecap', 'round')
    .attr('opacity', opacity)

  if (current) {
    d3.select(sampleGroup)
      .append('line')
      .attr('class', 'sample-stat-line')
      .attr('data-index', replicateIndex)
      .attr('x1', x)
      .attr('x2', x)
      .attr('y1', lineTop)
      .attr('y2', lineBottom)
      .attr('stroke', '#111827')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 1)

    appendStatMarker(sampleGroup, x, statZoneTop, sampleStat, {
      showLabel: false,
      classPrefix: 'sample-stat',
      statistic: 'mean',
    })
  }
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
  nGroups: number,
  statistic: SamplingStatistic,
  current = true,
) {
  if (nGroups >= 3) {
    appendMultiGroupSampleStatMarkers(
      sampleGroup,
      sampleX,
      groupStats,
      bands,
      replicateIndex,
    )
    return
  }
  if (nGroups === 2) {
    for (const band of bands.slice(0, 2)) {
      const stat = groupStats[band.index]
      if (stat == null || !Number.isFinite(stat)) continue
      appendTwoGroupBandSampleStat(
        sampleGroup,
        sampleX,
        stat,
        band,
        statistic,
        replicateIndex,
        current,
      )
    }
    return
  }
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
  populationGrandStat: number,
  statistic: SamplingStatistic,
  statKind: StatKind,
  nGroups: number,
  replicateIndex: number,
  paneInnerHeight: number,
  showSummary: boolean,
  current = true,
) {
  appendGroupedSampleStatLines(
    sampleGroup,
    sampleX,
    groupStats,
    bands,
    replicateIndex,
    nGroups,
    statistic,
    current,
  )
  if (!showSummary) return
  appendSampleStatSummary(
    sampleGroup,
    sampleX,
    groupStats,
    bands,
    populationGrandStat,
    statistic,
    statKind,
    nGroups,
    replicateIndex,
    paneInnerHeight,
    twoGroupDiffZone(paneInnerHeight),
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
  dotFill = SAMPLE_DOT_COLOR,
  dotOpacity = SAMPLE_DOT_OPACITY,
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
        .attr('fill-opacity', dotOpacity)
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
    .attr('fill', dotFill)
    .attr('fill-opacity', dotOpacity)
}

export type SampleBatchRep = {
  replicateIndex: number
  sampleStat: number
  sampleIndices: number[]
}

function appendDistMark(
  distGroup: SVGGElement,
  replicateIndex: number,
  sampleStat: number,
  x: number,
  y: number,
  dotRadius: number,
) {
  appendDistDotElement(distGroup, replicateIndex, sampleStat, x, y, dotRadius)
}

export type SampleBatchAnimContext = {
  sampleGroup: SVGGElement
  distGroup: SVGGElement
  flyGroup: SVGGElement
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
  statZoneTop: number
  signal: AnimSignal
  timingMs: number
  includeDist: boolean
  reps: SampleBatchRep[]
  numCatMode: boolean
  groupBands: GroupBand[]
  nGroups: number
  statistic: SamplingStatistic
  statKind: StatKind
  paneInnerHeight: number
  populationGrandStat: number
  populationStat: number
  /** Clear P2/P3 layers before this batch (first batch of a run only). */
  resetPane: boolean
}

export async function animateSampleBatch(
  ctx: SampleBatchAnimContext,
): Promise<void> {
  const {
    sampleGroup,
    distGroup,
    flyGroup,
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
    statZoneTop,
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
    populationGrandStat,
    resetPane,
  } = ctx

  if (signal.aborted || reps.length === 0) return

  const boxY = boxTop + dotRadius
  const boxHeight = boxAreaHeight - dotRadius * 2
  const lastRep = reps[reps.length - 1]!
  const priorReps = reps.slice(0, -1)

  if (resetPane) {
    resetSamplePane(sampleGroup)
    if (includeDist) {
      d3.select(distGroup).selectAll('.dist-dot').remove()
      removeDistTransientOverlays(distGroup)
    }
  } else {
    clearSampleTransient(sampleGroup)
    archiveCurrentSampleStats(sampleGroup, { statistic, boxY, boxHeight })
  }
  clearFlyLayer(flyGroup)

  for (const rep of priorReps) {
    if (numCatMode) {
      const groupStats = sampleGroupStats(
        rep.sampleIndices,
        population,
        populationGroup,
        nGroups,
        statistic,
      )
      const deviationCenter = avgDevCenterStat(
        numCatMode,
        statKind,
        nGroups,
        rep.sampleIndices,
        population,
        statistic,
        populationGrandStat,
      )
      appendGroupedSampleStats(
        sampleGroup,
        sampleX,
        groupStats,
        groupBands,
        deviationCenter,
        statistic,
        statKind,
        nGroups,
        rep.replicateIndex,
        paneInnerHeight,
        false,
        false,
      )
    } else {
      appendOneNumSampleStat(
        sampleGroup,
        sampleX,
        rep.sampleStat,
        rep.sampleIndices.map((i) => population[i]!),
        statistic,
        statZoneTop,
        boxTop,
        boxAreaHeight,
        dotRadius,
        rep.replicateIndex,
        false,
      )
    }
  }

  if (numCatMode) {
    const groupStats = sampleGroupStats(
      lastRep.sampleIndices,
      population,
      populationGroup,
      nGroups,
      statistic,
    )
    const deviationCenter = avgDevCenterStat(
      numCatMode,
      statKind,
      nGroups,
      lastRep.sampleIndices,
      population,
      statistic,
      populationGrandStat,
    )
    appendGroupedSampleStats(
      sampleGroup,
      sampleX,
      groupStats,
      groupBands,
      deviationCenter,
      statistic,
      statKind,
      nGroups,
      lastRep.replicateIndex,
      paneInnerHeight,
      false,
      true,
    )
  } else {
    appendOneNumSampleStat(
      sampleGroup,
      sampleX,
      lastRep.sampleStat,
      lastRep.sampleIndices.map((i) => population[i]!),
      statistic,
      statZoneTop,
      boxTop,
      boxAreaHeight,
      dotRadius,
      lastRep.replicateIndex,
      true,
    )
  }

  drawSampleDots(
    sampleGroup,
    lastRep.sampleIndices,
    population,
    populationGroup,
    sampleX,
    baselineY,
    dotRadius,
    numCatMode,
    groupBands,
  )
  if (numCatMode) {
    syncSampleBandLabels(
      sampleGroup,
      groupBands,
      lastRep.sampleIndices,
      populationGroup,
    )
  }

  if (includeDist) {
    for (const rep of sortRepsByDistY(reps, distLayout)) {
      if (!Number.isFinite(rep.sampleStat)) continue
      const target = distTarget(
        distLayout,
        rep.replicateIndex,
        distX,
        rep.sampleStat,
        distBaselineY,
      )
      if (!target) continue
      appendDistMark(
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
  statZoneTop: number
  signal: AnimSignal
  timingMs: number
  sampleTiming: SampleAnimationTiming
  fullAnimation: boolean
  accumulateOnly: boolean
  includeDist: boolean
  replicateIndex: number
  numCatMode: boolean
  groupBands: GroupBand[]
  nGroups: number
  statistic: SamplingStatistic
  statKind: StatKind
  paneInnerHeight: number
  populationGrandStat: number
  populationStat: number
  m: MValue
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
    statZoneTop,
    signal,
    timingMs,
    sampleTiming,
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
    populationGrandStat,
    populationStat,
    m,
  } = ctx

  if (signal.aborted) return

  const boxY = boxTop + dotRadius
  const boxHeight = boxAreaHeight - dotRadius * 2

  clearSampleTransient(sampleGroup)
  archiveCurrentSampleStats(sampleGroup, { statistic, boxY, boxHeight })
  clearFlyLayer(flyGroup)

  const radius = dotRadius
  const showSamplingAnimation = m < 20 && !includeDist
  const fullDistAnimation = includeDist && m < 20
  const fastStepHold = m === 20 && !showSamplingAnimation
  const showP2CatSummary = numCatMode && nGroups >= 2 && !accumulateOnly
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

  const deviationCenter = avgDevCenterStat(
    numCatMode,
    statKind,
    nGroups,
    sampleIndices,
    population,
    statistic,
    populationGrandStat,
  )

  const appendStats = (showSummary: boolean) => {
    if (numCatMode) {
      appendGroupedSampleStats(
        sampleGroup,
        sampleX,
        groupStats,
        groupBands,
        deviationCenter,
        statistic,
        statKind,
        nGroups,
        replicateIndex,
        paneInnerHeight,
        showSummary,
      )
    } else {
      appendOneNumSampleStat(
        sampleGroup,
        sampleX,
        sampleStat,
        sampleValues,
        statistic,
        statZoneTop,
        boxTop,
        boxAreaHeight,
        dotRadius,
        replicateIndex,
      )
    }
  }

  const appendSampleMeans = () => {
    if (numCatMode) {
      appendGroupedSampleStatLines(
        sampleGroup,
        sampleX,
        groupStats,
        groupBands,
        replicateIndex,
        nGroups,
        statistic,
        true,
      )
    } else {
      appendOneNumSampleStat(
        sampleGroup,
        sampleX,
        sampleStat,
        sampleValues,
        statistic,
        statZoneTop,
        boxTop,
        boxAreaHeight,
        dotRadius,
        replicateIndex,
      )
    }
  }

  const animateCatSummary = async () => {
    const wait = (ms: number) => delay(ms, signal)
    const aborted = () => signal.aborted
    const diffZone = twoGroupDiffZone(paneInnerHeight)
    const [rangeMin, rangeMax] = sampleX.range()
    const innerWidth = Math.abs(rangeMax - rangeMin)

    if (statKind === 'difference' || statKind === 'ratio' || nGroups === 2) {
      await animateTwoGroupSampleDiffSummary(
        sampleGroup,
        sampleX,
        groupStats,
        groupBands,
        diffZone,
        statistic,
        statKind,
        replicateIndex,
        sampleTiming,
        wait,
        aborted,
      )
    } else if (statKind === 'average_deviation' && nGroups >= 3) {
      await animateSampleDeviationSummary(
        sampleGroup,
        sampleX,
        groupStats,
        deviationCenter,
        groupBands,
        replicateIndex,
        innerWidth,
        paneInnerHeight,
        sampleTiming,
        wait,
        aborted,
      )
    }
  }

  if (includeDist) {
    clearHighlights(popGroup)
  }

  if (accumulateOnly) {
    if (signal.aborted) return

    appendStats(!accumulateOnly)

    if (includeDist && Number.isFinite(sampleStat)) {
      const target = distTarget(
        distLayout,
        replicateIndex,
        distX,
        sampleStat,
        distBaselineY,
      )
      if (target) {
        appendDistMark(
          distGroup,
          replicateIndex,
          sampleStat,
          target.x,
          target.y,
          dotRadius,
        )
      }
    }

    await delay(timingMs, signal)
    return
  }

  if (showSamplingAnimation) {
    clearHighlights(popGroup)
    if (signal.aborted) return

    await highlightSamplePointsOneByOne(
      popGroup,
      population,
      popX,
      popY,
      sampleIndices,
      radius,
      sampleTiming.pointHighlightMs,
      sampleTiming.pointHighlightFastMs,
      signal,
      numCatMode,
      populationGroup,
      groupBands,
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
      .attr('fill', (popIdx) =>
        samplePointFill(popIdx, numCatMode, populationGroup, groupBands),
      )
      .attr('fill-opacity', SAMPLE_DOT_OPACITY)
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

    await transitionPromise(flyers, signal, (t) =>
      t.duration(sampleTiming.slideToSampleMs).attr('cx', (_, i) => {
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
      syncSampleBandLabels(
        sampleGroup,
        groupBands,
        sampleIndices,
        populationGroup,
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
        .attr('fill', SAMPLE_DOT_COLOR)
        .attr('fill-opacity', SAMPLE_DOT_OPACITY)
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
    if (numCatMode) {
      syncSampleBandLabels(
        sampleGroup,
        groupBands,
        sampleIndices,
        populationGroup,
      )
    }
  }

  if (signal.aborted) return

  if (showSamplingAnimation) {
    appendSampleMeans()
    await delay(sampleTiming.statDisplayPauseMs, signal)
    if (signal.aborted) return

    if (showP2CatSummary) {
      await animateCatSummary()
      if (signal.aborted) return
    }
  } else if (numCatMode) {
    appendGroupedSampleStatLines(
      sampleGroup,
      sampleX,
      groupStats,
      groupBands,
      replicateIndex,
      nGroups,
      statistic,
      true,
    )
    if (showP2CatSummary && (statKind === 'difference' || statKind === 'ratio' || nGroups === 2)) {
      await animateTwoGroupSampleDiffSummary(
        sampleGroup,
        sampleX,
        groupStats,
        groupBands,
        twoGroupDiffZone(paneInnerHeight),
        statistic,
        statKind,
        replicateIndex,
        INSTANT_TWO_GROUP_SUMMARY_TIMING,
        () => Promise.resolve(),
        () => signal.aborted,
      )
      if (signal.aborted) return
    } else if (showP2CatSummary) {
      appendSampleStatSummary(
        sampleGroup,
        sampleX,
        groupStats,
        groupBands,
        deviationCenter,
        statistic,
        statKind,
        nGroups,
        replicateIndex,
        paneInnerHeight,
        twoGroupDiffZone(paneInnerHeight),
      )
    }
  } else {
    appendOneNumSampleStat(
      sampleGroup,
      sampleX,
      sampleStat,
      sampleValues,
      statistic,
      statZoneTop,
      boxTop,
      boxAreaHeight,
      dotRadius,
      replicateIndex,
    )
  }

  if (!includeDist) {
    if (fastStepHold) {
      await holdFastStepFrame(signal, timingMs)
    } else if (!showSamplingAnimation) {
      await delay(timingMs * 0.2, signal)
    }
    return
  }

  if (!Number.isFinite(sampleStat)) {
    if (fastStepHold) {
      await holdFastStepFrame(signal, timingMs)
    } else if (!showSamplingAnimation) {
      await delay(timingMs * 0.2, signal)
    }
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
    fullAnimation: fullDistAnimation,
    sampleTiming,
    numCatMode,
    statKind,
    nGroups,
    groupStats,
    paneInnerHeight,
    groupBands,
    statistic,
    populationGrandStat: deviationCenter,
    populationStat,
    statZoneTop,
    m,
  })

  if (fastStepHold) {
    await holdFastStepFrame(signal, timingMs)
  }
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
  sampleTiming: SampleAnimationTiming
  numCatMode: boolean
  statKind: StatKind
  nGroups: number
  groupStats: number[]
  paneInnerHeight: number
  groupBands: GroupBand[]
  statistic: SamplingStatistic
  populationGrandStat: number
  populationStat: number
  statZoneTop: number
  m: MValue
}

export async function animateDistDrop(ctx: DistAnimContext): Promise<void> {
  if (ctx.signal.aborted) return
  await animateDistArrowDrop(ctx)
}

export function resetSamplePane(sampleGroup: SVGGElement): void {
  const sel = d3.select(sampleGroup)
  sel.selectAll('.sample-dot').remove()
  sel.selectAll('.sample-band-label').remove()
  sel.selectAll('.sample-stat-line').remove()
  sel.selectAll('.sample-stat-barcode-vline').remove()
  sel.selectAll('.sample-stat-summary').remove()
  sel.selectAll('.sample-stat-triangle').remove()
  sel.selectAll('.sample-stat-label').remove()
  sel.selectAll('.sample-boxplot').remove()
  clearSampleIqrStack(sampleGroup)
  sel.selectAll('.dist-marker').remove()
}

export function clearFlyLayer(flyGroup: SVGGElement) {
  d3.select(flyGroup).selectAll('.fly-dot, .dist-arrow-fly, .dist-line-fly').remove()
}

export function clearSampleTransient(sampleGroup: SVGGElement) {
  d3.select(sampleGroup).selectAll('.sample-dot').remove()
  d3.select(sampleGroup).selectAll('.sample-band-label').remove()
  d3.select(sampleGroup).selectAll('.dist-marker').remove()
}

/** Fade stored P2 stats and remove markers that belong only to the active replicate. */
export function archiveCurrentSampleStats(
  sampleGroup: SVGGElement,
  options?: { statistic?: SamplingStatistic; boxY?: number; boxHeight?: number },
) {
  const sel = d3.select(sampleGroup)
  sel
    .selectAll('.sample-stat-barcode-vline')
    .attr('opacity', PREVIOUS_STAT_OPACITY)
  if (
    options?.statistic === 'iqr' &&
    options.boxY != null &&
    options.boxHeight != null
  ) {
    archiveSampleIqrToStack(sampleGroup, options.boxY, options.boxHeight)
  } else {
    sel.selectAll('.sample-boxplot').remove()
  }
  sel
    .selectAll('.sample-stat-line[data-group]')
    .attr('stroke-opacity', PREVIOUS_STAT_OPACITY)
  sel.selectAll('.sample-stat-line:not([data-group])').remove()
  sel
    .selectAll('.sample-stat-vline')
    .attr('stroke-opacity', PREVIOUS_STAT_OPACITY)
  sel.selectAll('.sample-stat-summary').attr('opacity', PREVIOUS_STAT_OPACITY)
  sel.selectAll('.sample-stat-triangle').remove()
  sel.selectAll('.sample-stat-label').remove()
}

export function clearHighlights(popGroup: SVGGElement, _numCatMode = false) {
  d3.select(popGroup).select('.pop-highlight-layer').selectAll('.highlight').remove()
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
  if (keepStatLines) {
    d3.select(sampleGroup).selectAll('.sample-dot').remove()
    d3.select(sampleGroup).selectAll('.sample-band-label').remove()
  } else {
    resetSamplePane(sampleGroup)
  }
  d3.select(distGroup).selectAll('.dist-dot').remove()
  removeDistTransientOverlays(distGroup)
}
