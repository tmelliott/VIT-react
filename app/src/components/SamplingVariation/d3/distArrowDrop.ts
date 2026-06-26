import * as d3 from 'd3'
import {
  drawHorizontalArrow,
  drawHorizontalLine,
  transitionHorizontalArrow,
  transitionHorizontalLine,
  transitionHorizontalLinesTo,
  transitionVerticalLine,
} from './drawArrow'
import { fiveNumSummary } from './boxplot'
import { appendDistDotElement, distTarget, stackDotYsByBin, type DistLayout } from './distPhysics'
import { distBaselineValue, type SamplingStatistic } from '../statistics'
import { type StatKind } from './sampleStatSummary'
import { twoGroupDiffZone, type GroupBand } from './groupLayout'
import { PANE, type PaneLayout, toAbsolute } from './paneCoords'
import { DIST_BARCODE_VLINE_COLOR, DIST_STAGE_DROP_OFFSET, DIST_STAGE_LINE_GAP, DIST_STAGE_Y } from './paneStyle'
import { appendUpTriangle, STAT_GAP, TRIANGLE_SIZE } from './statMarker'
import type { SampleAnimationTiming, MValue } from '../types'
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
  sampleTiming: SampleAnimationTiming
  numCatMode: boolean
  statKind: StatKind
  nGroups: number
  groupStats: number[]
  sampleIndices: number[]
  paneInnerHeight: number
  groupBands: GroupBand[]
  statistic: SamplingStatistic
  /** k≥3: sample grand mean/median; otherwise unused. */
  populationGrandStat: number
  populationStat: number
  statZoneTop: number
  m: MValue
}

function waitWithSignal(ms: number, signal: AnimSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    const start = performance.now()
    const tick = (now: number) => {
      if (signal.aborted) {
        resolve()
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

function fadeOpacity(
  selection: d3.Selection<d3.BaseType, unknown, null, undefined>,
  opacity: number,
  duration: number,
): Promise<void> {
  if (selection.empty() || duration <= 0) {
    selection.attr('opacity', opacity)
    return Promise.resolve()
  }
  return selection
    .transition()
    .duration(duration)
    .attr('opacity', opacity)
    .end()
    .then(() => undefined)
}

/** Remove per-replicate P3 overlays; kept until the next distribution animation starts. */
export function removeDistTransientOverlays(distGroup: SVGGElement) {
  d3.select(distGroup)
    .selectAll(
      '.dist-stage-dev-line, .dist-avg-dev-line, .dist-transient-arrow, .dist-stat-arrow, .dist-zero-vline, .dist-stage-endpoint, .dist-avg-stage-vline, .dist-stage-triangle, .dist-stage-triangle-wrap, .dist-transient-stat-line',
    )
    .remove()
}

function transitionCircleCy(
  circle: d3.Selection<SVGCircleElement, unknown, null, undefined>,
  endCy: number,
  duration: number,
): Promise<void> {
  if (circle.empty()) return Promise.resolve()
  if (duration <= 0) {
    circle.attr('cy', endCy)
    return Promise.resolve()
  }
  return circle
    .transition()
    .duration(duration)
    .attr('cy', endCy)
    .end()
    .then(() => undefined)
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
    sampleIndices,
    sampleX,
    distX,
    distLayout,
    distBaselineY,
    dotRadius,
    boxTop,
    replicateIndex,
    timingMs,
    signal,
    fullAnimation,
    sampleTiming,
    numCatMode,
    statKind,
    nGroups,
    groupStats,
    paneInnerHeight,
    groupBands,
    populationGrandStat,
    statistic,
    statZoneTop,
    boxAreaHeight,
    m,
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
  const distSel = d3.select(distGroup)
  flySel.selectAll('.dist-arrow-fly, .dist-line-fly, .dist-stage-fly').remove()
  removeDistTransientOverlays(distGroup)

  const slideMs = sampleTiming.slideToSampleMs
  if (m === 1) {
    await waitWithSignal(sampleTiming.distPreSlidePauseMs, signal)
    if (signal.aborted) return
  }

  if (numCatMode && (statKind === 'difference' || statKind === 'ratio' || nGroups === 2)) {
    const low = groupStats[0]!
    const high = groupStats[1]!
    const baseline = distBaselineValue(statKind)
    const baselineX = distX(baseline)
    const statX = distX(sampleStat)
    if (
      !Number.isFinite(low) ||
      !Number.isFinite(high) ||
      baselineX == null ||
      statX == null ||
      !Number.isFinite(baselineX) ||
      !Number.isFinite(statX)
    ) {
      placeDot()
      return
    }

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
    const endFrom = toAbsolute(paneLayout, PANE.DIST, baselineX, distBaselineY)
    const endTo = toAbsolute(paneLayout, PANE.DIST, statX, distBaselineY)

    const arrowG = drawHorizontalArrow(
      flySel,
      startFrom.x,
      startTo.x,
      startFrom.y,
      '#dc2626',
      1,
      undefined,
      { minSpan: 0 },
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
        slideMs,
        '#dc2626',
        1,
      )
    } finally {
      flySel.selectAll('.dist-arrow-fly').remove()
    }
    if (signal.aborted) return

    drawHorizontalArrow(
      distSel,
      baselineX,
      statX,
      distBaselineY,
      '#dc2626',
      1,
      undefined,
      { minSpan: 0 },
    ).attr('class', 'dist-transient-arrow')

    const dotX = target?.x ?? statX
    const dotY = target?.y ?? distBaselineY
    appendDistDotElement(
      distGroup,
      replicateIndex,
      sampleStat,
      dotX,
      dotY,
      dotRadius,
    )
    distSel.select('.dist-transient-arrow').remove()
  } else if (numCatMode && statKind === 'average_deviation' && nGroups >= 3) {
    const grandMean = populationGrandStat
    if (!Number.isFinite(grandMean) || !Number.isFinite(sampleStat)) {
      placeDot()
      return
    }

    const zeroX = distX(0)
    const endToX = distX(sampleStat)
    if (
      zeroX == null ||
      endToX == null ||
      !Number.isFinite(zeroX) ||
      !Number.isFinite(endToX)
    ) {
      placeDot()
      return
    }

    type DevLineSpec = {
      /** Left-to-right span in sample pane x coords (matches P2 arrow segment). */
      lineLeftX: number
      lineRightX: number
      sampleY: number
      stageY: number
      devMagnitude: number
    }
    const devLines: DevLineSpec[] = []

    for (const band of groupBands) {
      const stat = groupStats[band.index]
      if (stat == null || !Number.isFinite(stat)) continue
      const grandPx = sampleX(grandMean)!
      const statPx = sampleX(stat)!
      const lineLeftX = Math.min(grandPx, statPx)
      const lineRightX = Math.max(grandPx, statPx)
      if (lineRightX - lineLeftX < 1) continue
      const devMagnitude = Math.abs(stat - grandMean)
      if (!Number.isFinite(devMagnitude) || devMagnitude < 1e-9) continue
      devLines.push({
        lineLeftX,
        lineRightX,
        sampleY: band.top + band.height / 2,
        stageY: DIST_STAGE_Y + devLines.length * DIST_STAGE_LINE_GAP,
        devMagnitude,
      })
    }

    if (devLines.length > 0) {
      await Promise.all(
        devLines.map(async (dl) => {
          const startFrom = toAbsolute(
            paneLayout,
            PANE.SAMPLE,
            dl.lineLeftX,
            dl.sampleY,
          )
          const startTo = toAbsolute(
            paneLayout,
            PANE.SAMPLE,
            dl.lineRightX,
            dl.sampleY,
          )
          const endFrom = toAbsolute(
            paneLayout,
            PANE.DIST,
            dl.lineLeftX,
            dl.stageY,
          )
          const endTo = toAbsolute(
            paneLayout,
            PANE.DIST,
            dl.lineRightX,
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
              slideMs,
            )
          } catch {
            // interrupted
          }

          if (signal.aborted) return

          drawHorizontalLine(
            distSel,
            dl.lineLeftX,
            dl.lineRightX,
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
          const magX = distX(dev)
          return {
            x1: zeroX,
            x2: magX != null && Number.isFinite(magX) ? magX : zeroX,
            y: stageY + DIST_STAGE_DROP_OFFSET,
          }
        },
        slideMs,
      )
    }

    if (signal.aborted) return

    const rowY =
      devLines.length > 0
        ? DIST_STAGE_Y +
          (devLines.length - 1) * DIST_STAGE_LINE_GAP +
          DIST_STAGE_DROP_OFFSET
        : DIST_STAGE_Y + DIST_STAGE_DROP_OFFSET

    const stageLines = distSel.selectAll<SVGLineElement, unknown>(
      '.dist-stage-dev-line',
    )

    if (!stageLines.empty()) {
      await Promise.all(
        stageLines.nodes().map((node) => {
          const lineSel = d3.select(node)
          const x2 = Number(lineSel.attr('x2'))
          const lineY = Number(lineSel.attr('y1'))
          return distSel
            .append('circle')
            .attr('class', 'dist-stage-endpoint')
            .attr('cx', x2)
            .attr('cy', lineY)
            .attr('r', dotRadius - 1)
            .attr('fill', '#9ca3af')
            .attr('opacity', 0)
            .transition()
            .duration(sampleTiming.distDotFadeInMs)
            .attr('opacity', 0.9)
            .end()
            .then(() => undefined)
        }),
      )

      await waitWithSignal(sampleTiming.distDevPointPauseMs, signal)
      if (signal.aborted) return

      await fadeOpacity(stageLines, 0, sampleTiming.distDevLineFadeOutMs)
      stageLines.remove()
      if (signal.aborted) return

      const endpoints = distSel.selectAll<SVGCircleElement, unknown>(
        '.dist-stage-endpoint',
      )
      const stackItems = endpoints.nodes().map((node, index) => ({
        key: index,
        x: Number(d3.select(node).attr('cx')),
      }))
      const stackedYs = stackDotYsByBin(
        stackItems,
        rowY,
        dotRadius,
        distX.range() as [number, number],
        DIST_STAGE_Y,
      )
      await Promise.all(
        endpoints.nodes().map((node, index) =>
          transitionCircleCy(
            d3.select(node),
            stackedYs.get(index) ?? rowY,
            sampleTiming.distAvgDevStageMs,
          ),
        ),
      )
    }

    if (signal.aborted) return

    await waitWithSignal(sampleTiming.distTrianglePauseMs, signal)
    if (signal.aborted) return

    const triangleGap = 10
    const triangleTipY = rowY + triangleGap
    const triangleWrap = distSel
      .append('g')
      .attr('class', 'dist-stage-triangle-wrap')
      .attr('opacity', 0)
    appendUpTriangle(
      triangleWrap.node()!,
      endToX,
      triangleTipY,
      TRIANGLE_SIZE,
      '#dc2626',
      'dist-stage-triangle',
    )
    await fadeOpacity(triangleWrap, 1, Math.min(200, sampleTiming.distDotFadeInMs))
    if (signal.aborted) return

    await waitWithSignal(sampleTiming.distPostArrowPauseMs, signal)
    if (signal.aborted) return

    const dotX = target?.x ?? endToX
    const dotY = target?.y ?? distBaselineY
    const dropStartY = triangleTipY + TRIANGLE_SIZE * 0.5
    appendDistDotElement(
      distGroup,
      replicateIndex,
      sampleStat,
      dotX,
      dropStartY,
      dotRadius,
    )
    const finalDot = d3
      .select(distGroup)
      .select<SVGCircleElement>(`.dist-dot[data-index="${replicateIndex}"]`)
    try {
      await transitionCircleCy(finalDot, dotY, sampleTiming.distArrowDropMs)
    } catch {
      // interrupted
    }
  } else if (!numCatMode && statistic === 'iqr') {
    const sampleValues = sampleIndices
      .map((index) => population[index])
      .filter((value): value is number => value != null && Number.isFinite(value))
    const summary = fiveNumSummary(sampleValues)
    const zeroX = distX(0)
    const statX = distX(sampleStat)
    if (
      !summary ||
      zeroX == null ||
      statX == null ||
      !Number.isFinite(zeroX) ||
      !Number.isFinite(statX)
    ) {
      placeDot()
      return
    }

    const boxY = boxTop + dotRadius
    const startFrom = toAbsolute(
      paneLayout,
      PANE.SAMPLE,
      sampleX(summary.q1)!,
      boxY,
    )
    const startTo = toAbsolute(
      paneLayout,
      PANE.SAMPLE,
      sampleX(summary.q3)!,
      boxY,
    )
    const endFrom = toAbsolute(paneLayout, PANE.DIST, zeroX, distBaselineY)
    const endTo = toAbsolute(paneLayout, PANE.DIST, statX, distBaselineY)

    const arrowG = drawHorizontalArrow(
      flySel,
      startFrom.x,
      startTo.x,
      startFrom.y,
      '#dc2626',
      1,
      undefined,
      { minSpan: 0 },
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
        slideMs,
        '#dc2626',
        1,
      )
    } finally {
      flySel.selectAll('.dist-arrow-fly').remove()
    }
    if (signal.aborted) return

    drawHorizontalArrow(
      distSel,
      zeroX,
      statX,
      distBaselineY,
      '#dc2626',
      1,
      undefined,
      { minSpan: 0 },
    ).attr('class', 'dist-transient-arrow')

    const dotX = target?.x ?? statX
    const dotY = target?.y ?? distBaselineY
    appendDistDotElement(
      distGroup,
      replicateIndex,
      sampleStat,
      dotX,
      dotY,
      dotRadius,
    )
    distSel.select('.dist-transient-arrow').remove()
  } else {
    const axisLocalX = distX(sampleStat)!
    const dotR = dotRadius - 1
    const dotSize = dotR * 2
    const stubTop = distBaselineY - dotSize
    const sampleLocalX = sampleX(sampleStat)!
    const lineTop = statZoneTop + STAT_GAP + TRIANGLE_SIZE
    const lineBottom = boxTop + boxAreaHeight - dotRadius
    const startTop = toAbsolute(paneLayout, PANE.SAMPLE, sampleLocalX, lineTop)
    const startBottom = toAbsolute(
      paneLayout,
      PANE.SAMPLE,
      sampleLocalX,
      lineBottom,
    )
    const endTop = toAbsolute(paneLayout, PANE.DIST, axisLocalX, stubTop)
    const endBottom = toAbsolute(paneLayout, PANE.DIST, axisLocalX, distBaselineY)

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
      endBottom.x,
      endTop.y,
      endBottom.y,
      slideMs,
      d3.easeCubicIn,
    )
    if (signal.aborted) return

    const dotX = target?.x ?? axisLocalX
    const dotY = target?.y ?? distBaselineY
    appendDistDotElement(
      distGroup,
      replicateIndex,
      sampleStat,
      dotX,
      dotY,
      dotRadius,
    )
    flySel.selectAll('.dist-line-fly').remove()
  }
}
