import * as d3 from 'd3'
import {
  drawHorizontalArrow,
  transitionHorizontalArrow,
  transitionVerticalLine,
} from './drawArrow'
import { appendDistDotElement, distTarget, type DistLayout } from './distPhysics'
import { sampleGrandStat, type StatKind } from './sampleStatSummary'
import { type GroupBand } from './groupLayout'
import { PANE, type PaneLayout, toAbsolute } from './paneCoords'
import type { AnimSignal } from './animateSample'

export type DistArrowDropContext = {
  sampleGroup: SVGGElement
  distGroup: SVGGElement
  flyGroup: SVGGElement
  paneLayout: PaneLayout
  population: number[]
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
  numCatMode: boolean
  statKind: StatKind
  nGroups: number
  groupStats: number[]
  sampleIndices: number[]
  paneInnerHeight: number
  groupBands: GroupBand[]
  statistic: 'mean' | 'median'
}

function appendDistStatArrow(
  distGroup: SVGGElement,
  distX: d3.ScaleLinear<number, number>,
  sampleStat: number,
  baselineY: number,
  replicateIndex: number,
  color: string,
) {
  const fromX = distX(0)!
  const toX = distX(sampleStat)!
  if (!Number.isFinite(fromX) || !Number.isFinite(toX)) return
  if (Math.abs(toX - fromX) < 0.5) return

  d3.select(distGroup)
    .selectAll(`.dist-stat-arrow[data-index="${replicateIndex}"]`)
    .remove()

  const arrow = drawHorizontalArrow(
    d3.select(distGroup),
    fromX,
    toX,
    baselineY,
    color,
    0.9,
  )
  arrow
    .attr('class', 'dist-stat-arrow')
    .attr('data-index', replicateIndex)
}

export async function animateDistArrowDrop(
  ctx: DistArrowDropContext,
): Promise<void> {
  const {
    distGroup,
    flyGroup,
    paneLayout,
    population,
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
    numCatMode,
    statKind,
    nGroups,
    groupStats,
    sampleIndices,
    paneInnerHeight,
    groupBands,
    statistic,
  } = ctx

  if (signal.aborted) return

  const target = distTarget(
    distLayout,
    replicateIndex,
    distX,
    sampleStat,
    distBaselineY,
  )

  const placeDot = () => {
    appendDistDotElement(
      distGroup,
      replicateIndex,
      sampleStat,
      target.x,
      target.y,
      dotRadius,
    )
  }

  if (!fullAnimation || timingMs <= 0) {
    placeDot()
    return
  }

  const duration = timingMs * 0.5
  const flySel = d3.select(flyGroup)
  flySel.selectAll('.dist-arrow-fly, .dist-line-fly').remove()

  const endFrom = toAbsolute(paneLayout, PANE.DIST, distX(0)!, distBaselineY)
  const endTo = toAbsolute(paneLayout, PANE.DIST, distX(sampleStat)!, distBaselineY)

  const flyHorizontalArrow = async (
    color: string,
    startFromX: number,
    startToX: number,
    startY: number,
    endFromX: number,
    endToX: number,
    endY: number,
    distArrowColor: string,
  ) => {
    const arrowG = drawHorizontalArrow(
      flySel,
      startFromX,
      startToX,
      startY,
      color,
      1,
    )
    arrowG.attr('class', 'dist-arrow-fly')
    try {
      await transitionHorizontalArrow(
        arrowG,
        startFromX,
        startToX,
        startY,
        endFromX,
        endToX,
        endY,
        duration,
        color,
      )
    } finally {
      flySel.selectAll('.dist-arrow-fly').remove()
    }
    appendDistStatArrow(
      distGroup,
      distX,
      sampleStat,
      distBaselineY,
      replicateIndex,
      distArrowColor,
    )
  }

  if (numCatMode && (statKind === 'difference' || nGroups === 2)) {
    const low = groupStats[0]!
    const high = groupStats[1]!
    if (!Number.isFinite(low) || !Number.isFinite(high)) {
      placeDot()
      return
    }

    const startY = paneInnerHeight / 2
    const startFrom = toAbsolute(paneLayout, PANE.SAMPLE, sampleX(low)!, startY)
    const startTo = toAbsolute(paneLayout, PANE.SAMPLE, sampleX(high)!, startY)

    await flyHorizontalArrow(
      '#dc2626',
      startFrom.x,
      startTo.x,
      startFrom.y,
      endFrom.x,
      endTo.x,
      endFrom.y,
      '#dc2626',
    )
  } else if (numCatMode && statKind === 'average_deviation' && nGroups >= 3) {
    const grandMean = sampleGrandStat(sampleIndices, population, statistic)
    let anchorStat = grandMean
    let anchorBandIndex = 0
    let maxDev = 0
    for (let i = 0; i < groupStats.length; i++) {
      const stat = groupStats[i]
      if (stat == null || !Number.isFinite(stat)) continue
      const dev = Math.abs(stat - grandMean)
      if (dev > maxDev) {
        maxDev = dev
        anchorStat = stat
        anchorBandIndex = i
      }
    }

    const anchorBand = groupBands[anchorBandIndex]
    const startY = anchorBand
      ? anchorBand.top + anchorBand.height / 2
      : paneInnerHeight / 2
    const startFrom = toAbsolute(
      paneLayout,
      PANE.SAMPLE,
      sampleX(grandMean)!,
      startY,
    )
    const startTo = toAbsolute(
      paneLayout,
      PANE.SAMPLE,
      sampleX(anchorStat)!,
      startY,
    )

    if (Math.abs(startTo.x - startFrom.x) < 1) {
      placeDot()
      return
    }

    await flyHorizontalArrow(
      '#6b7280',
      startFrom.x,
      startTo.x,
      startFrom.y,
      endFrom.x,
      endTo.x,
      endFrom.y,
      '#6b7280',
    )
  } else {
    const sampleLocalX = sampleX(sampleStat)!
    const lineTop = boxTop + dotRadius
    const lineBottom = boxTop + boxAreaHeight - dotRadius
    const startTop = toAbsolute(paneLayout, PANE.SAMPLE, sampleLocalX, lineTop)
    const startBottom = toAbsolute(
      paneLayout,
      PANE.SAMPLE,
      sampleLocalX,
      lineBottom,
    )
    const endPoint = toAbsolute(paneLayout, PANE.DIST, target.x, target.y)

    const line = flySel
      .append('line')
      .attr('class', 'dist-line-fly')
      .attr('stroke', '#dc2626')
      .attr('stroke-width', 2.5)

    await transitionVerticalLine(
      line,
      startTop.x,
      startTop.y,
      startBottom.x,
      startBottom.y,
      endPoint.x,
      endPoint.y,
      endPoint.y,
      duration,
    )
  }

  if (signal.aborted) return

  flySel.selectAll('.dist-line-fly').remove()
  placeDot()

  if (timingMs > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, timingMs * 0.1))
  }
}
