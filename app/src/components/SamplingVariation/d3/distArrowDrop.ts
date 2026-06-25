import * as d3 from 'd3'
import {
  drawHorizontalArrow,
  drawHorizontalLine,
  transitionHorizontalArrow,
  transitionHorizontalLine,
  transitionHorizontalLineTo,
  transitionHorizontalLinesTo,
  transitionVerticalLine,
} from './drawArrow'
import { appendDistDotElement, distTarget, type DistLayout } from './distPhysics'
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
  statistic: 'mean' | 'median'
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

async function fadeInDistDot(
  distGroup: SVGGElement,
  replicateIndex: number,
  sampleStat: number,
  x: number,
  y: number,
  dotRadius: number,
  duration: number,
): Promise<void> {
  appendDistDotElement(distGroup, replicateIndex, sampleStat, x, y, dotRadius)
  const dot = d3
    .select(distGroup)
    .select<SVGCircleElement>(`.dist-dot[data-index="${replicateIndex}"]`)
  dot.attr('opacity', 0)
  await fadeOpacity(dot, 1, duration)
}

/** Remove per-replicate P3 overlays; kept until the next distribution animation starts. */
export function removeDistTransientOverlays(distGroup: SVGGElement) {
  d3.select(distGroup)
    .selectAll(
      '.dist-stage-dev-line, .dist-avg-dev-line, .dist-transient-arrow, .dist-stat-arrow, .dist-zero-vline, .dist-stage-endpoint, .dist-avg-stage-vline, .dist-stage-triangle, .dist-transient-stat-line',
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
    sampleTiming,
    numCatMode,
    statKind,
    nGroups,
    groupStats,
    paneInnerHeight,
    groupBands,
    populationGrandStat,
    statZoneTop,
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

  if (numCatMode && (statKind === 'difference' || nGroups === 2)) {
    const low = groupStats[0]!
    const high = groupStats[1]!
    const zeroX = distX(0)
    const statX = distX(sampleStat)
    if (
      !Number.isFinite(low) ||
      !Number.isFinite(high) ||
      zeroX == null ||
      statX == null ||
      !Number.isFinite(zeroX) ||
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
              slideMs,
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
    await Promise.all(
      stageLines.nodes().map((node) => {
        const x2 = Number(d3.select(node).attr('x2'))
        return distSel
          .append('circle')
          .attr('class', 'dist-stage-endpoint')
          .attr('cx', x2)
          .attr('cy', rowY)
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
    await fadeOpacity(distSel.selectAll('.dist-stage-endpoint'), 0, sampleTiming.distDevLineFadeOutMs)
    stageLines.remove()
    distSel.selectAll('.dist-stage-endpoint').remove()
    if (signal.aborted) return

    const avgStageY = rowY - 20
    const avgHoriz = drawHorizontalLine(
      distSel,
      zeroX,
      endToX,
      avgStageY,
      '#dc2626',
      1,
      { minSpan: 0 },
    ).attr('class', 'dist-avg-dev-line')

    const upTop = avgStageY - 28
    const upLine = distSel
      .append('line')
      .attr('class', 'dist-avg-stage-vline')
      .attr('x1', endToX)
      .attr('x2', endToX)
      .attr('y1', avgStageY)
      .attr('y2', avgStageY)
      .attr('stroke', '#dc2626')
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round')

    await Promise.all([
      transitionVerticalLine(
        upLine,
        endToX,
        avgStageY,
        endToX,
        avgStageY,
        endToX,
        upTop,
        upTop,
        sampleTiming.distAvgDevStageMs,
      ),
      fadeOpacity(avgHoriz, 0, sampleTiming.distAvgDevStageMs),
    ])
    if (signal.aborted) return

    appendUpTriangle(
      distGroup,
      endToX,
      upTop - TRIANGLE_SIZE,
      TRIANGLE_SIZE,
      '#dc2626',
      'dist-stage-triangle',
    )

    await waitWithSignal(sampleTiming.distTrianglePauseMs, signal)
    if (signal.aborted) return

    upLine.remove()
    distSel.select('.dist-stage-triangle').remove()
    avgHoriz.attr('opacity', 1).attr('y1', avgStageY).attr('y2', avgStageY)

    try {
      await transitionHorizontalLineTo(
        avgHoriz,
        zeroX,
        endToX,
        distBaselineY,
        sampleTiming.distArrowDropMs,
      )
    } catch {
      // interrupted
    }
    if (signal.aborted) return

    await waitWithSignal(sampleTiming.distPostArrowPauseMs, signal)
    if (signal.aborted) return

    const dotX = target?.x ?? endToX
    const dotY = target?.y ?? distBaselineY
    await fadeInDistDot(
      distGroup,
      replicateIndex,
      sampleStat,
      dotX,
      dotY,
      dotRadius,
      sampleTiming.distDotFadeInMs,
    )
    if (signal.aborted) return

    await fadeOpacity(distSel.select('.dist-avg-dev-line'), 0, sampleTiming.distArrowFadeOutMs)
    distSel.select('.dist-avg-dev-line').remove()
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
