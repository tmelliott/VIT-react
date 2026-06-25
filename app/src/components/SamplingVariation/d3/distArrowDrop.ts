import * as d3 from 'd3'
import {
  drawHorizontalArrow,
  drawHorizontalLine,
  transitionHorizontalArrow,
  transitionHorizontalLine,
  transitionHorizontalLinesTo,
  transitionVerticalLine,
} from './drawArrow'
import { appendDistDotElement, distTarget, type DistLayout } from './distPhysics'
import { type StatKind } from './sampleStatSummary'
import { twoGroupDiffZone, type GroupBand } from './groupLayout'
import { PANE, type PaneLayout, toAbsolute } from './paneCoords'
import { DIST_BARCODE_VLINE_COLOR, DIST_STAGE_DROP_OFFSET, DIST_STAGE_LINE_GAP, DIST_STAGE_Y } from './paneStyle'
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
  populationGrandStat: number
  populationStat: number
  statZoneTop: number
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Remove per-replicate P3 overlays; kept until the next distribution animation starts. */
export function removeDistTransientOverlays(distGroup: SVGGElement) {
  d3.select(distGroup)
    .selectAll(
      '.dist-stage-dev-line, .dist-avg-dev-line, .dist-transient-arrow, .dist-stat-arrow',
    )
    .remove()
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
    populationGrandStat,
    populationStat,
    statZoneTop,
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
    if (!target) return
    appendDistDotElement(
      distGroup,
      replicateIndex,
      sampleStat,
      target.x,
      target.y,
      dotRadius,
    )
  }

  if (!Number.isFinite(sampleStat)) return

  if (!fullAnimation || timingMs <= 0) {
    placeDot()
    return
  }

  const flySel = d3.select(flyGroup)
  flySel.selectAll('.dist-arrow-fly, .dist-line-fly, .dist-stage-fly').remove()
  removeDistTransientOverlays(distGroup)

  const stageDuration = Math.round(timingMs * 0.22)
  const slideDuration = Math.round(timingMs * 0.28)

  if (numCatMode && (statKind === 'difference' || nGroups === 2)) {
    const low = groupStats[0]!
    const high = groupStats[1]!
    if (!Number.isFinite(low) || !Number.isFinite(high)) {
      placeDot()
      return
    }

    const refStat = Number.isFinite(populationStat) ? populationStat : 0
    const diffZone = twoGroupDiffZone(paneInnerHeight)
    const startFrom = toAbsolute(
      paneLayout,
      PANE.SAMPLE,
      sampleX(low)!,
      diffZone.arrowY,
    )
    const startTo = toAbsolute(
      paneLayout,
      PANE.SAMPLE,
      sampleX(high)!,
      diffZone.arrowY,
    )
    const endFrom = toAbsolute(paneLayout, PANE.DIST, distX(refStat)!, distBaselineY)
    const endTo = toAbsolute(
      paneLayout,
      PANE.DIST,
      distX(sampleStat)!,
      distBaselineY,
    )

    const arrowG = drawHorizontalArrow(
      flySel,
      startFrom.x,
      startTo.x,
      startFrom.y,
      '#dc2626',
      1,
    )
    arrowG.attr('class', 'dist-arrow-fly')
    try {
      await transitionHorizontalArrow(
        arrowG,
        startFrom.x,
        startTo.x,
        startFrom.y,
        endFrom.x,
        endTo.x,
        endFrom.y,
        stageDuration + slideDuration,
        '#dc2626',
        1,
      )
    } finally {
      flySel.selectAll('.dist-arrow-fly').remove()
    }

    drawHorizontalArrow(
      d3.select(distGroup),
      distX(refStat)!,
      distX(sampleStat)!,
      distBaselineY,
      '#dc2626',
      1,
    ).attr('class', 'dist-transient-arrow')
  } else if (numCatMode && statKind === 'average_deviation' && nGroups >= 3) {
    const grandMean = populationGrandStat
    if (!Number.isFinite(grandMean) || !Number.isFinite(sampleStat)) {
      placeDot()
      return
    }

    const zeroX = distX(0)
    if (zeroX == null || !Number.isFinite(zeroX)) {
      placeDot()
      return
    }

    type DevLineSpec = {
      sampleFromX: number
      sampleToX: number
      sampleY: number
      stageY: number
      devMagnitude: number
    }
    const devLines: DevLineSpec[] = []

    for (const band of groupBands) {
      const stat = groupStats[band.index]
      if (stat == null || !Number.isFinite(stat)) continue
      const sampleFromX = sampleX(grandMean)!
      const sampleToX = sampleX(stat)!
      if (Math.abs(sampleToX - sampleFromX) < 1) continue
      const devMagnitude = Math.abs(stat - grandMean)
      if (!Number.isFinite(devMagnitude) || devMagnitude < 1e-9) continue
      devLines.push({
        sampleFromX,
        sampleToX,
        sampleY: band.top + band.height / 2,
        stageY: DIST_STAGE_Y + devLines.length * DIST_STAGE_LINE_GAP,
        devMagnitude,
      })
    }

    const distSel = d3.select(distGroup)

    const flyInDuration = Math.round(timingMs * 0.28)
    const slideDuration = Math.round(timingMs * 0.28)
    const beforeRedDelay = Math.round(timingMs * 0.38)
    const redHoldDelay = Math.round(timingMs * 0.42)
    const redSlideDuration = Math.round(timingMs * 0.28)

    if (devLines.length > 0) {
      await Promise.all(
        devLines.map(async (dl) => {
          const startFrom = toAbsolute(
            paneLayout,
            PANE.SAMPLE,
            dl.sampleFromX,
            dl.sampleY,
          )
          const startTo = toAbsolute(
            paneLayout,
            PANE.SAMPLE,
            dl.sampleToX,
            dl.sampleY,
          )
          const endFrom = toAbsolute(
            paneLayout,
            PANE.DIST,
            dl.sampleFromX,
            dl.stageY,
          )
          const endTo = toAbsolute(
            paneLayout,
            PANE.DIST,
            dl.sampleToX,
            dl.stageY,
          )

          const line = flySel
            .append('line')
            .attr('class', 'dist-line-fly dist-stage-fly')
            .attr('x1', startFrom.x)
            .attr('x2', startTo.x)
            .attr('y1', startFrom.y)
            .attr('y2', startFrom.y)
            .attr('stroke', '#9ca3af')
            .attr('stroke-width', 2)
            .attr('stroke-linecap', 'round')
            .attr('opacity', 0.85)

          try {
            await transitionHorizontalLine(
              line,
              startFrom.x,
              startTo.x,
              startFrom.y,
              endFrom.x,
              endTo.x,
              endFrom.y,
              flyInDuration,
            )
          } catch {
            // interrupted
          }

          if (signal.aborted) return

          drawHorizontalLine(
            distSel,
            dl.sampleFromX,
            dl.sampleToX,
            dl.stageY,
            '#9ca3af',
            0.75,
            { minSpan: 0 },
          )
            .attr('class', 'dist-stage-dev-line')
            .attr('data-dev', dl.devMagnitude)
            .attr('data-stage-y', dl.stageY)
        }),
      )

      flySel.selectAll('.dist-stage-fly').remove()
      if (signal.aborted) return

      await transitionHorizontalLinesTo(
        distSel.selectAll<SVGLineElement, unknown>('.dist-stage-dev-line'),
        (node) => {
          const dev = Number(d3.select(node).attr('data-dev'))
          const stageY = Number(d3.select(node).attr('data-stage-y'))
          const endToX = distX(dev)
          return {
            x1: zeroX,
            x2: endToX != null && Number.isFinite(endToX) ? endToX : zeroX,
            y: stageY + DIST_STAGE_DROP_OFFSET,
          }
        },
        slideDuration,
      )
    }

    if (signal.aborted) return

    await delay(beforeRedDelay)
    if (signal.aborted) return

    const endToX = distX(sampleStat)
    if (endToX == null || !Number.isFinite(endToX)) {
      placeDot()
      return
    }

    const redStageY =
      devLines.length > 0
        ? DIST_STAGE_Y +
          (devLines.length - 1) * DIST_STAGE_LINE_GAP +
          DIST_STAGE_DROP_OFFSET +
          14
        : DIST_STAGE_Y + DIST_STAGE_DROP_OFFSET + 14

    drawHorizontalLine(
      distSel,
      zeroX,
      endToX,
      redStageY,
      '#dc2626',
      1,
      { minSpan: 0 },
    ).attr('class', 'dist-avg-dev-line')

    await delay(redHoldDelay)
    if (signal.aborted) return

    const redLine = distSel.select<SVGLineElement>('.dist-avg-dev-line')
    try {
      await transitionHorizontalLineTo(
        redLine,
        zeroX,
        endToX,
        distBaselineY,
        redSlideDuration,
      )
    } catch {
      // interrupted
    }
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
    const endPoint = toAbsolute(paneLayout, PANE.DIST, target?.x ?? distX(sampleStat)!, target?.y ?? distBaselineY)

    const line = flySel
      .append('line')
      .attr('class', 'dist-line-fly')
      .attr('stroke', DIST_BARCODE_VLINE_COLOR)
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round')

    await transitionVerticalLine(
      line,
      startTop.x,
      startTop.y,
      startBottom.x,
      startBottom.y,
      endPoint.x,
      endPoint.y,
      endPoint.y,
      stageDuration + slideDuration,
    )
  }

  if (signal.aborted) return

  flySel.selectAll('.dist-line-fly, .dist-arrow-fly').remove()
  placeDot()

  if (timingMs > 0) {
    await delay(Math.round(timingMs * 0.1))
  }
}
