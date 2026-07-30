import * as d3 from 'd3'
import {
  computeUnitBarGeometry,
  drawHybridProportionChart,
  fillProportionSampleDots,
  readProportionDotPosition,
  removeProportionBar,
  resetProportionDotsOutline,
} from './proportionBar'
import {
  PROP_ALT_STROKE,
  PROP_FOCUS_COLOR,
  PROP_FOCUS_STROKE,
  proportionFromEncoded,
  proportionSampleLayout,
  unitGroupRowLayout,
} from './proportionLayout'
import {
  DIST_BARCODE_BLUE,
  DIST_BARCODE_BLUE_OPACITY,
  PREVIOUS_STAT_OPACITY,
} from './paneStyle'
import { DOT_RADIUS } from './heapLayout'
import { appendStatMarker, STAT_GAP, TRIANGLE_SIZE } from './statMarker'
import { type PaneLayout, PANE, toAbsolute } from './paneCoords'
import { paneRegions } from '../hooks/useSamplingScales'
import {
  appendDistDotElement,
  distTarget,
  sortRepsByDistY,
  type DistLayout,
} from './distPhysics'
import {
  archiveCurrentSampleStats,
  clearFlyLayer,
  delay,
  animateDistDrop,
  type AnimSignal,
} from './animateSample'
import {
  animateTwoGroupSampleDiffSummary,
  animateSampleDeviationSummary,
  appendMultiGroupSampleStatMarkers,
  appendTwoGroupBandSampleStat,
  type StatKind,
} from './sampleStatSummary'
import {
  twoGroupDiffZone,
  type GroupBand,
} from './groupLayout'
import { combineGroupProps } from '../statistics'
import type { SampleAnimationTiming, MValue } from '../types'

const PROP_DIFF_SYMBOL = 'p̂'

const INSTANT_TWO_GROUP_SUMMARY_TIMING = {
  twoGroupDropLineMs: 0,
  twoGroupPreArrowPauseMs: 0,
  twoGroupArrowMs: 0,
} as const satisfies Pick<
  SampleAnimationTiming,
  'twoGroupDropLineMs' | 'twoGroupPreArrowPauseMs' | 'twoGroupArrowMs'
>

const POINT_HIGHLIGHT_SLOW_COUNT = 5

/** Same blue barcode geometry as {@link appendOneNumSampleStat}. */
function proportionBarcodeYs(innerHeight: number): {
  chartLayout: ReturnType<typeof proportionSampleLayout>
  barcodeTop: number
  barcodeBottom: number
} {
  const regions = paneRegions(innerHeight)
  const lineTop = regions.statZoneTop + STAT_GAP + TRIANGLE_SIZE
  const lineBottom = regions.boxTop + regions.boxAreaHeight - DOT_RADIUS
  const verticalSpan = lineBottom - lineTop
  const midY = (lineTop + lineBottom) / 2
  const blueHalfHeight = verticalSpan / 4
  return {
    chartLayout: proportionSampleLayout(regions.dotAreaHeight),
    barcodeTop: midY - blueHalfHeight,
    barcodeBottom: midY + blueHalfHeight,
  }
}

export type ProportionSampleAnimContext = {
  popGroup: SVGGElement
  sampleGroup: SVGGElement
  distGroup: SVGGElement
  flyGroup: SVGGElement
  paneLayout: PaneLayout
  populationCategory: number[]
  sampleIndices: number[]
  sampleStat: number
  sampleX: d3.ScaleLinear<number, number>
  distX: d3.ScaleLinear<number, number>
  distLayout: DistLayout
  categoryLabels: [string, string]
  innerWidth: number
  innerHeight: number
  distBaselineY: number
  dotRadius: number
  boxTop: number
  boxAreaHeight: number
  statZoneTop: number
  populationStat: number
  signal: AnimSignal
  timingMs: number
  sampleTiming: SampleAnimationTiming
  includeDist: boolean
  replicateIndex: number
  m: MValue
}

export type ProportionBatchRep = {
  replicateIndex: number
  sampleStat: number
  sampleIndices: number[]
}

export type ProportionSampleBatchContext = {
  popGroup: SVGGElement
  sampleGroup: SVGGElement
  distGroup: SVGGElement
  flyGroup: SVGGElement
  populationCategory: number[]
  sampleX: d3.ScaleLinear<number, number>
  distX: d3.ScaleLinear<number, number>
  distLayout: DistLayout
  categoryLabels: [string, string]
  innerWidth: number
  innerHeight: number
  distBaselineY: number
  dotRadius: number
  signal: AnimSignal
  timingMs: number
  includeDist: boolean
  reps: ProportionBatchRep[]
  resetPane: boolean
  /** two_cat k=2 batch extras */
  populationGroup?: number[]
  groupLevels?: string[]
  groupBands?: GroupBand[]
  nGroups?: number
  statKind?: StatKind
}

export type TwoCatProportionSampleAnimContext = ProportionSampleAnimContext & {
  populationGroup: number[]
  groupLevels: string[]
  groupBands: GroupBand[]
  nGroups: number
  statKind: StatKind
  /** Overall population focus proportion (k≥3 average-deviation centre). */
  populationGrandProp: number
}

/** Per-group focus proportions for a sample. */
export function sampleGroupProportions(
  sampleIndices: number[],
  populationCategory: number[],
  populationGroup: number[],
  nGroups: number,
): number[] {
  const focus = new Array<number>(nGroups).fill(0)
  const total = new Array<number>(nGroups).fill(0)
  for (const i of sampleIndices) {
    const g = populationGroup[i]
    if (g == null || g < 0 || g >= nGroups) continue
    total[g]! += 1
    if (populationCategory[i] === 0) focus[g]! += 1
  }
  return total.map((t, g) => (t === 0 ? NaN : focus[g]! / t))
}

function sampleFill(isFocus: boolean): string {
  return isFocus ? PROP_FOCUS_COLOR : PROP_ALT_STROKE
}

function sampleStroke(isFocus: boolean): string {
  return isFocus ? PROP_FOCUS_STROKE : PROP_ALT_STROKE
}

async function highlightProportionSample(
  popGroup: SVGGElement,
  populationCategory: number[],
  sampleIndices: number[],
  pointHighlightMs: number,
  pointHighlightFastMs: number,
  signal: AnimSignal,
): Promise<void> {
  for (let i = 0; i < sampleIndices.length; i++) {
    if (signal.aborted) return
    fillProportionSampleDots(popGroup, [sampleIndices[i]!], populationCategory)
    const ms =
      i < POINT_HIGHLIGHT_SLOW_COUNT ? pointHighlightMs : pointHighlightFastMs
    await delay(ms, signal)
  }
}

/** Tall estimate tick in the barcode band under the sample chart. */
function appendProportionBarcode(
  sampleGroup: SVGGElement,
  sampleX: d3.ScaleLinear<number, number>,
  sampleStat: number,
  barcodeTop: number,
  barcodeBottom: number,
  replicateIndex: number,
  current = true,
) {
  if (!Number.isFinite(sampleStat)) return
  const x = sampleX(sampleStat)!
  const opacity = current ? DIST_BARCODE_BLUE_OPACITY : PREVIOUS_STAT_OPACITY

  d3.select(sampleGroup)
    .append('line')
    .attr('class', 'sample-stat-barcode-vline')
    .attr('data-index', replicateIndex)
    .attr('x1', x)
    .attr('x2', x)
    .attr('y1', barcodeTop)
    .attr('y2', barcodeBottom)
    .attr('stroke', DIST_BARCODE_BLUE)
    .attr('stroke-width', 3)
    .attr('stroke-linecap', 'round')
    .attr('opacity', opacity)
}

/** Black estimate line in the same strip as one-numeric (flies to P3). */
function appendProportionSampleStatLine(
  sampleGroup: SVGGElement,
  sampleX: d3.ScaleLinear<number, number>,
  sampleStat: number,
  innerHeight: number,
  replicateIndex: number,
) {
  if (!Number.isFinite(sampleStat)) return
  const regions = paneRegions(innerHeight)
  const x = sampleX(sampleStat)!
  const lineTop = regions.statZoneTop + STAT_GAP + TRIANGLE_SIZE
  const lineBottom = regions.boxTop + regions.boxAreaHeight - DOT_RADIUS

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

  appendStatMarker(sampleGroup, x, regions.statZoneTop, sampleStat, {
    showLabel: false,
    classPrefix: 'sample-stat',
    statistic: 'mean',
  })
}

function drawSampleProportionChart(
  sampleGroup: SVGGElement,
  sampleEncoded: number[],
  sampleX: d3.ScaleLinear<number, number>,
  innerWidth: number,
  innerHeight: number,
  categoryLabels: [string, string],
  sampleStat: number,
  replicateIndex: number,
) {
  const { chartLayout, barcodeTop, barcodeBottom } =
    proportionBarcodeYs(innerHeight)

  drawHybridProportionChart(
    sampleGroup,
    sampleEncoded,
    innerWidth,
    innerHeight,
    sampleX,
    {
      showLegend: true,
      showStat: true,
      statValue: sampleStat,
      categoryLabels,
      dotStyle: 'filled',
      // Unit-chart p̂ marker only — the flying estimate line lives in the box strip.
      statLineAt: 'value',
      layout: chartLayout,
    },
  )

  appendProportionBarcode(
    sampleGroup,
    sampleX,
    sampleStat,
    barcodeTop,
    barcodeBottom,
    replicateIndex,
    true,
  )
  appendProportionSampleStatLine(
    sampleGroup,
    sampleX,
    sampleStat,
    innerHeight,
    replicateIndex,
  )
  d3.select(sampleGroup).selectAll('.sample-stat-barcode-vline').raise()
  d3.select(sampleGroup).selectAll('.sample-stat-line').raise()
}

function clearSampleProportionDisplay(sampleGroup: SVGGElement) {
  removeProportionBar(sampleGroup, 'prop')
  d3.select(sampleGroup).selectAll('.prop-group').remove()
  // Active-replicate overlays only — archived barcodes / group lines stay
  // for the sampling history trail between iterations.
  d3.select(sampleGroup)
    .selectAll(
      [
        '.sample-stat-summary',
        '.sample-stat-triangle',
        '.sample-stat-label',
        '.sample-stat-line:not([data-group])',
        '.sample-stat-drop-line',
        '.sample-stat-drop',
        '.sample-stat-vline',
        '.sample-diff-label',
        '.sample-avg-dev-label',
        '.sample-grand-mean',
        '.sample-summary-arrow',
        '.sample-diff-arrow',
        '.sample-dev-arrow',
      ].join(', '),
    )
    .remove()
}

/** Draw per-group hybrid sample charts; k=2 also places mean-strip markers. */
function drawMultiGroupSampleProportionCharts(
  sampleGroup: SVGGElement,
  sampleIndices: number[],
  populationCategory: number[],
  populationGroup: number[],
  groupLevels: string[],
  groupBands: GroupBand[],
  groupProps: number[],
  sampleX: d3.ScaleLinear<number, number>,
  innerWidth: number,
  categoryLabels: [string, string],
  replicateIndex: number,
  current = true,
  withTwoGroupMarkers = false,
) {
  clearSampleProportionDisplay(sampleGroup)
  const root = d3.select(sampleGroup)

  for (const band of groupBands) {
    const indexMap: number[] = []
    const groupEncoded: number[] = []
    for (const popIdx of sampleIndices) {
      if (populationGroup[popIdx] === band.index) {
        indexMap.push(popIdx)
        groupEncoded.push(populationCategory[popIdx] ?? 1)
      }
    }
    const layout = unitGroupRowLayout(
      band.top,
      band.dotAreaHeight,
      band.index === 0,
    )
    const subG = root.append('g').attr('class', 'prop-group')
    drawHybridProportionChart(
      subG.node()!,
      groupEncoded,
      innerWidth,
      band.dotAreaHeight,
      sampleX,
      {
        classPrefix: `prop-g${band.index}`,
        showLegend: band.index === 0,
        showStat: true,
        statValue: groupProps[band.index],
        groupLabel: groupLevels[band.index] ?? band.label,
        categoryLabels,
        layout,
        indexMap,
        dotStyle: 'filled',
        statLineAt: 'value',
      },
    )
    if (withTwoGroupMarkers) {
      const prop = groupProps[band.index]
      if (prop != null && Number.isFinite(prop)) {
        appendTwoGroupBandSampleStat(
          sampleGroup,
          sampleX,
          prop,
          band,
          'mean',
          replicateIndex,
          current,
        )
      }
    }
  }
}

function twoCatGroupGeometries(
  sampleIndices: number[],
  populationCategory: number[],
  populationGroup: number[],
  groupBands: GroupBand[],
  sampleX: d3.ScaleLinear<number, number>,
  innerWidth: number,
): Map<number, { x: number; y: number; r: number }> {
  const out = new Map<number, { x: number; y: number; r: number }>()
  for (const band of groupBands) {
    const indexMap: number[] = []
    const groupEncoded: number[] = []
    for (const popIdx of sampleIndices) {
      if (populationGroup[popIdx] === band.index) {
        indexMap.push(popIdx)
        groupEncoded.push(populationCategory[popIdx] ?? 1)
      }
    }
    if (groupEncoded.length === 0) continue
    const layout = unitGroupRowLayout(
      band.top,
      band.dotAreaHeight,
      band.index === 0,
    )
    const geom = computeUnitBarGeometry(
      groupEncoded,
      innerWidth,
      band.dotAreaHeight,
      sampleX,
      layout,
      indexMap,
    )
    if (!geom) continue
    for (const [idx, place] of geom.placements) {
      out.set(idx, place)
    }
  }
  return out
}

function transitionCircles(
  selection: d3.Selection<SVGCircleElement, number, SVGGElement, unknown>,
  signal: AnimSignal,
  duration: number,
  apply: (
    t: d3.Transition<SVGCircleElement, number, SVGGElement, unknown>,
  ) => d3.Transition<SVGCircleElement, number, SVGGElement, unknown>,
): Promise<void> {
  if (signal.aborted || duration <= 0) return Promise.resolve()
  return new Promise((resolve) => {
    apply(selection.transition().duration(duration)).on('end', () => resolve())
  })
}

/**
 * M=1000-style chunk: pile faded barcodes for the batch, show one showcase sample.
 */
export async function animateProportionSampleBatch(
  ctx: ProportionSampleBatchContext,
): Promise<void> {
  const {
    popGroup,
    sampleGroup,
    distGroup,
    flyGroup,
    populationCategory,
    populationGroup = [],
    groupLevels = [],
    groupBands = [],
    nGroups = 1,
    sampleX,
    distX,
    distLayout,
    categoryLabels,
    innerWidth,
    innerHeight,
    distBaselineY,
    dotRadius,
    signal,
    timingMs,
    includeDist,
    reps,
    resetPane,
  } = ctx

  if (signal.aborted || reps.length === 0) return

  const lastRep = reps[reps.length - 1]!
  const priorReps = reps.slice(0, -1)
  const { barcodeTop, barcodeBottom } = proportionBarcodeYs(innerHeight)
  const twoCatK2 = nGroups === 2 && groupBands.length >= 2
  const twoCatK3 = nGroups >= 3 && groupBands.length >= 3

  if (resetPane) {
    clearSampleProportionDisplay(sampleGroup)
    d3.select(sampleGroup).selectAll('.sample-stat-barcode-vline').remove()
    d3.select(sampleGroup).selectAll('.sample-stat-line').remove()
    if (includeDist) {
      d3.select(distGroup).selectAll('.dist-dot').remove()
    }
  } else {
    archiveCurrentSampleStats(sampleGroup)
    clearSampleProportionDisplay(sampleGroup)
  }
  clearFlyLayer(flyGroup)
  resetProportionDotsOutline(popGroup)

  if (twoCatK2 || twoCatK3) {
    for (const rep of priorReps) {
      const props = sampleGroupProportions(
        rep.sampleIndices,
        populationCategory,
        populationGroup,
        nGroups,
      )
      if (twoCatK2) {
        for (const band of groupBands.slice(0, 2)) {
          const prop = props[band.index]
          if (prop == null || !Number.isFinite(prop)) continue
          appendTwoGroupBandSampleStat(
            sampleGroup,
            sampleX,
            prop,
            band,
            'mean',
            rep.replicateIndex,
            false,
          )
        }
      } else {
        appendMultiGroupSampleStatMarkers(
          sampleGroup,
          sampleX,
          props,
          groupBands,
          rep.replicateIndex,
        )
        d3.select(sampleGroup)
          .selectAll(`.sample-stat-line[data-index="${rep.replicateIndex}"]`)
          .attr('stroke-opacity', PREVIOUS_STAT_OPACITY)
      }
    }
    const lastProps = sampleGroupProportions(
      lastRep.sampleIndices,
      populationCategory,
      populationGroup,
      nGroups,
    )
    drawMultiGroupSampleProportionCharts(
      sampleGroup,
      lastRep.sampleIndices,
      populationCategory,
      populationGroup,
      groupLevels,
      groupBands,
      lastProps,
      sampleX,
      innerWidth,
      categoryLabels,
      lastRep.replicateIndex,
      true,
      twoCatK2,
    )
    if (twoCatK3) {
      appendMultiGroupSampleStatMarkers(
        sampleGroup,
        sampleX,
        lastProps,
        groupBands,
        lastRep.replicateIndex,
      )
    }
  } else {
    for (const rep of priorReps) {
      appendProportionBarcode(
        sampleGroup,
        sampleX,
        rep.sampleStat,
        barcodeTop,
        barcodeBottom,
        rep.replicateIndex,
        false,
      )
    }

    const sampleEncoded = lastRep.sampleIndices.map(
      (i) => populationCategory[i] ?? 1,
    )
    drawSampleProportionChart(
      sampleGroup,
      sampleEncoded,
      sampleX,
      innerWidth,
      innerHeight,
      categoryLabels,
      lastRep.sampleStat,
      lastRep.replicateIndex,
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

/**
 * one_cat sampling animation:
 * fill P1 outlines → fly to P2 (same local coords) → restack → box + p̂ + barcode.
 * Distribution mode: same P2→P3 vertical-line drop as one-numeric.
 */
export async function animateOneProportionSample(
  ctx: ProportionSampleAnimContext,
): Promise<void> {
  const {
    popGroup,
    sampleGroup,
    distGroup,
    flyGroup,
    paneLayout,
    populationCategory,
    sampleIndices,
    sampleStat,
    sampleX,
    distX,
    distLayout,
    categoryLabels,
    innerWidth,
    innerHeight,
    distBaselineY,
    dotRadius,
    boxTop,
    boxAreaHeight,
    statZoneTop,
    populationStat,
    signal,
    timingMs,
    sampleTiming,
    includeDist,
    replicateIndex,
    m,
  } = ctx

  if (signal.aborted) return

  archiveCurrentSampleStats(sampleGroup)
  clearSampleProportionDisplay(sampleGroup)
  clearFlyLayer(flyGroup)
  resetProportionDotsOutline(popGroup)

  const sampleEncoded = sampleIndices.map((i) => populationCategory[i] ?? 1)
  // Match one-numeric: skip P1 highlight choreography when building the distribution.
  const showSamplingAnimation = m < 20 && !includeDist
  const fullDistAnimation = includeDist && m < 20
  const { chartLayout } = proportionBarcodeYs(innerHeight)
  const sampleGeom = computeUnitBarGeometry(
    sampleEncoded,
    innerWidth,
    innerHeight,
    sampleX,
    chartLayout,
    sampleIndices,
  )

  const finishWithDist = async () => {
    if (!includeDist || !Number.isFinite(sampleStat)) {
      await delay(timingMs, signal)
      return
    }
    await animateDistDrop({
      sampleGroup,
      distGroup,
      flyGroup,
      paneLayout,
      population: [],
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
      numCatMode: false,
      statKind: '',
      nGroups: 1,
      groupStats: [],
      paneInnerHeight: innerHeight,
      groupBands: [],
      statistic: 'mean',
      populationGrandStat: 0,
      populationStat,
      statZoneTop,
      m,
    })
    // M=20: place one dot per iteration with a short hold (not one batch of 20).
    if (!fullDistAnimation) {
      await delay(timingMs, signal)
    }
  }

  if (!showSamplingAnimation) {
    if (signal.aborted) return
    drawSampleProportionChart(
      sampleGroup,
      sampleEncoded,
      sampleX,
      innerWidth,
      innerHeight,
      categoryLabels,
      sampleStat,
      replicateIndex,
    )
    await finishWithDist()
    return
  }

  await highlightProportionSample(
    popGroup,
    populationCategory,
    sampleIndices,
    sampleTiming.pointHighlightMs,
    sampleTiming.pointHighlightFastMs,
    signal,
  )
  if (signal.aborted) return

  await delay(sampleTiming.sampleCompletePauseMs, signal)
  if (signal.aborted) return

  // Phase 1: translate P1 → P2 keeping each point's local (x, y).
  const flyers = d3
    .select(flyGroup)
    .selectAll<SVGCircleElement, number>('.fly-dot')
    .data(sampleIndices, (d) => d)
    .join('circle')
    .attr('class', 'fly-dot')
    .attr('r', (popIdx) => readProportionDotPosition(popGroup, popIdx)?.r ?? 4)
    .attr('fill', (popIdx) => sampleFill(populationCategory[popIdx] === 0))
    .attr('fill-opacity', 0.95)
    .attr('stroke', (popIdx) => sampleStroke(populationCategory[popIdx] === 0))
    .attr('stroke-width', 0.5)
    .attr('cx', (popIdx) => {
      const p = readProportionDotPosition(popGroup, popIdx)
      if (!p) return 0
      return toAbsolute(paneLayout, PANE.DATA, p.x, p.y).x
    })
    .attr('cy', (popIdx) => {
      const p = readProportionDotPosition(popGroup, popIdx)
      if (!p) return 0
      return toAbsolute(paneLayout, PANE.DATA, p.x, p.y).y
    })

  await transitionCircles(flyers, signal, sampleTiming.slideToSampleMs, (t) =>
    t
      .attr('cx', (popIdx) => {
        const p = readProportionDotPosition(popGroup, popIdx)
        if (!p) return 0
        return toAbsolute(paneLayout, PANE.SAMPLE, p.x, p.y).x
      })
      .attr('cy', (popIdx) => {
        const p = readProportionDotPosition(popGroup, popIdx)
        if (!p) return 0
        return toAbsolute(paneLayout, PANE.SAMPLE, p.x, p.y).y
      }),
  )
  if (signal.aborted) return

  // Phase 2: restack into neat rows/cols with the same packing algorithm.
  if (sampleGeom) {
    await transitionCircles(flyers, signal, sampleTiming.restackSampleMs, (t) =>
      t
        .attr('cx', (popIdx) => {
          const place = sampleGeom.placements.get(popIdx)
          if (!place) return toAbsolute(paneLayout, PANE.SAMPLE, 0, 0).x
          return toAbsolute(paneLayout, PANE.SAMPLE, place.x, place.y).x
        })
        .attr('cy', (popIdx) => {
          const place = sampleGeom.placements.get(popIdx)
          if (!place) return toAbsolute(paneLayout, PANE.SAMPLE, 0, 0).y
          return toAbsolute(paneLayout, PANE.SAMPLE, place.x, place.y).y
        })
        .attr('r', (popIdx) => {
          const place = sampleGeom.placements.get(popIdx)
          return place?.r ?? 4
        }),
    )
  }
  if (signal.aborted) return

  d3.select(flyGroup).selectAll('.fly-dot').remove()

  drawSampleProportionChart(
    sampleGroup,
    sampleEncoded,
    sampleX,
    innerWidth,
    innerHeight,
    categoryLabels,
    sampleStat,
    replicateIndex,
  )

  await delay(sampleTiming.statDisplayPauseMs, signal)
  if (signal.aborted) return

  if (includeDist) {
    await finishWithDist()
  }
}

/**
 * two_cat sampling animation (k=2 difference, or k≥3 average deviation):
 * fill P1 → fly → restack per group → hybrid charts + summary → P3 drop.
 */
export async function animateTwoCatProportionSample(
  ctx: TwoCatProportionSampleAnimContext,
): Promise<void> {
  const {
    popGroup,
    sampleGroup,
    distGroup,
    flyGroup,
    paneLayout,
    populationCategory,
    populationGroup,
    groupLevels,
    groupBands,
    nGroups,
    statKind,
    populationGrandProp,
    sampleIndices,
    sampleStat,
    sampleX,
    distX,
    distLayout,
    categoryLabels,
    innerWidth,
    innerHeight,
    distBaselineY,
    dotRadius,
    boxTop,
    boxAreaHeight,
    statZoneTop,
    populationStat,
    signal,
    timingMs,
    sampleTiming,
    includeDist,
    replicateIndex,
    m,
  } = ctx

  if (signal.aborted || nGroups < 2 || groupBands.length < 2) return

  const isAvgDev = nGroups >= 3
  archiveCurrentSampleStats(sampleGroup)
  clearSampleProportionDisplay(sampleGroup)
  clearFlyLayer(flyGroup)
  resetProportionDotsOutline(popGroup)

  const kind: StatKind = isAvgDev
    ? 'average_deviation'
    : statKind === 'ratio'
      ? 'ratio'
      : 'difference'
  const groupProps = sampleGroupProportions(
    sampleIndices,
    populationCategory,
    populationGroup,
    nGroups,
  )
  const grandCentre = Number.isFinite(populationGrandProp)
    ? populationGrandProp
    : proportionFromEncoded(
        sampleIndices.map((i) => populationCategory[i] ?? 1),
        0,
      )
  const summaryStat = Number.isFinite(sampleStat)
    ? sampleStat
    : isAvgDev
      ? groupProps.reduce((s, p) => s + Math.abs(p - grandCentre), 0) /
        Math.max(1, groupProps.length)
      : combineGroupProps(groupProps[0]!, groupProps[1]!, kind === 'ratio' ? 'ratio' : 'difference')

  const showSamplingAnimation = m < 20 && !includeDist
  const fullDistAnimation = includeDist && m < 20
  const placements = twoCatGroupGeometries(
    sampleIndices,
    populationCategory,
    populationGroup,
    groupBands,
    sampleX,
    innerWidth,
  )
  const diffZone = twoGroupDiffZone(innerHeight)

  const finishWithDist = async () => {
    if (!includeDist || !Number.isFinite(summaryStat)) {
      await delay(timingMs, signal)
      return
    }
    await animateDistDrop({
      sampleGroup,
      distGroup,
      flyGroup,
      paneLayout,
      population: [],
      sampleStat: summaryStat,
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
      numCatMode: true,
      statKind: kind,
      nGroups,
      groupStats: groupProps,
      paneInnerHeight: innerHeight,
      groupBands,
      statistic: 'mean',
      populationGrandStat: isAvgDev ? grandCentre : 0,
      populationStat,
      statZoneTop,
      m,
    })
    if (!fullDistAnimation) {
      await delay(timingMs, signal)
    }
  }

  const showSummary = async (animate: boolean) => {
    drawMultiGroupSampleProportionCharts(
      sampleGroup,
      sampleIndices,
      populationCategory,
      populationGroup,
      groupLevels,
      groupBands,
      groupProps,
      sampleX,
      innerWidth,
      categoryLabels,
      replicateIndex,
      true,
      !isAvgDev,
    )
    const wait = (ms: number) => delay(ms, signal)
    if (isAvgDev) {
      appendMultiGroupSampleStatMarkers(
        sampleGroup,
        sampleX,
        groupProps,
        groupBands,
        replicateIndex,
      )
      if (animate) {
        await animateSampleDeviationSummary(
          sampleGroup,
          sampleX,
          groupProps,
          grandCentre,
          groupBands,
          replicateIndex,
          innerWidth,
          innerHeight,
          sampleTiming,
          wait,
          () => signal.aborted,
        )
      } else {
        await animateSampleDeviationSummary(
          sampleGroup,
          sampleX,
          groupProps,
          grandCentre,
          groupBands,
          replicateIndex,
          innerWidth,
          innerHeight,
          { multiGroupArrowsMs: 0 },
          wait,
          () => signal.aborted,
        )
      }
    } else {
      await animateTwoGroupSampleDiffSummary(
        sampleGroup,
        sampleX,
        groupProps,
        groupBands,
        diffZone,
        'mean',
        kind,
        replicateIndex,
        animate ? sampleTiming : INSTANT_TWO_GROUP_SUMMARY_TIMING,
        wait,
        () => signal.aborted,
        PROP_DIFF_SYMBOL,
      )
    }
  }

  if (!showSamplingAnimation) {
    if (signal.aborted) return
    await showSummary(false)
    await finishWithDist()
    return
  }

  await highlightProportionSample(
    popGroup,
    populationCategory,
    sampleIndices,
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
    .attr('r', (popIdx) => readProportionDotPosition(popGroup, popIdx)?.r ?? 4)
    .attr('fill', (popIdx) => sampleFill(populationCategory[popIdx] === 0))
    .attr('fill-opacity', 0.95)
    .attr('stroke', (popIdx) => sampleStroke(populationCategory[popIdx] === 0))
    .attr('stroke-width', 0.5)
    .attr('cx', (popIdx) => {
      const p = readProportionDotPosition(popGroup, popIdx)
      if (!p) return 0
      return toAbsolute(paneLayout, PANE.DATA, p.x, p.y).x
    })
    .attr('cy', (popIdx) => {
      const p = readProportionDotPosition(popGroup, popIdx)
      if (!p) return 0
      return toAbsolute(paneLayout, PANE.DATA, p.x, p.y).y
    })

  await transitionCircles(flyers, signal, sampleTiming.slideToSampleMs, (t) =>
    t
      .attr('cx', (popIdx) => {
        const p = readProportionDotPosition(popGroup, popIdx)
        if (!p) return 0
        return toAbsolute(paneLayout, PANE.SAMPLE, p.x, p.y).x
      })
      .attr('cy', (popIdx) => {
        const p = readProportionDotPosition(popGroup, popIdx)
        if (!p) return 0
        return toAbsolute(paneLayout, PANE.SAMPLE, p.x, p.y).y
      }),
  )
  if (signal.aborted) return

  await transitionCircles(flyers, signal, sampleTiming.restackSampleMs, (t) =>
    t
      .attr('cx', (popIdx) => {
        const place = placements.get(popIdx)
        if (!place) return toAbsolute(paneLayout, PANE.SAMPLE, 0, 0).x
        return toAbsolute(paneLayout, PANE.SAMPLE, place.x, place.y).x
      })
      .attr('cy', (popIdx) => {
        const place = placements.get(popIdx)
        if (!place) return toAbsolute(paneLayout, PANE.SAMPLE, 0, 0).y
        return toAbsolute(paneLayout, PANE.SAMPLE, place.x, place.y).y
      })
      .attr('r', (popIdx) => placements.get(popIdx)?.r ?? 4),
  )
  if (signal.aborted) return

  d3.select(flyGroup).selectAll('.fly-dot').remove()

  await showSummary(true)
  if (signal.aborted) return

  await delay(sampleTiming.statDisplayPauseMs, signal)
  if (signal.aborted) return

  if (includeDist) {
    await finishWithDist()
  }
}

export function clearProportionAnimationLayers(
  popGroup: SVGGElement,
  sampleGroup: SVGGElement,
  flyGroup: SVGGElement,
  distGroup?: SVGGElement,
  keepStatLines = false,
) {
  resetProportionDotsOutline(popGroup)
  // Drop any leftover two_cat population summary on P1.
  d3.select(popGroup)
    .selectAll(
      '.pop-stat-drop-line, .pop-stat-drop, .pop-diff-arrow, .pop-diff-label, .pop-avg-dev-label, .pop-grand-mean, .pop-dev-arrow',
    )
    .remove()
  clearFlyLayer(flyGroup)
  clearSampleProportionDisplay(sampleGroup)
  if (!keepStatLines) {
    d3.select(sampleGroup)
      .selectAll(
        '.sample-stat-barcode-vline, .sample-stat-line, .sample-stat-summary, .sample-stat-drop-line, .sample-diff-label, .sample-summary-arrow, .sample-diff-arrow',
      )
      .remove()
  }
  if (distGroup) {
    d3.select(distGroup).selectAll('.dist-dot').remove()
  }
}
