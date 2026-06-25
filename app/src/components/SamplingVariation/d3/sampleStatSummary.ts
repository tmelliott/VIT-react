import * as d3 from 'd3'
import { createHorizontalArrow, drawHorizontalArrow } from './drawArrow'
import { STAT_GAP, TRIANGLE_SIZE, formatStatValue, statSymbol, appendStatMarker } from './statMarker'
import {
  averageDeviationFromGroups,
  bandDeviationArrowY,
  populationGrandStat,
  sampleAverageDeviation,
  sampleAvgDevLabelZone,
  type GroupBand,
  type TwoGroupDiffZone,
} from './groupLayout'
import type { SampleAnimationTiming } from '../types'
import {
  PREVIOUS_STAT_OPACITY,
} from './paneStyle'

export type StatKind = 'difference' | 'average_deviation' | ''

export function sampleGrandStat(
  sampleIndices: number[],
  population: number[],
  statistic: 'mean' | 'median',
): number {
  const values = sampleIndices.map((i) => population[i]!)
  return populationGrandStat(values, statistic)
}

export function appendPopulationDeviationArrows(
  parent: SVGGElement,
  xScale: d3.ScaleLinear<number, number>,
  groupStats: number[],
  grandMean: number,
  bands: GroupBand[],
) {
  const sel = d3.select(parent)
  for (const band of bands) {
    const stat = groupStats[band.index]
    if (stat == null || !Number.isFinite(stat)) continue
    const y = band.top + band.height / 2
    const arrow = drawHorizontalArrow(
      sel,
      xScale(stat)!,
      xScale(grandMean)!,
      y,
      '#2563eb',
      0.85,
    )
    arrow.attr('class', 'pop-dev-arrow')
  }
}

const GROUP_STAT_VLINE_HEIGHT = 12

/** K≥3 P2: estimate tick in each band's arrow row (under that group's dotplot). */
export function appendMultiGroupSampleStatMarkers(
  parent: SVGGElement,
  xScale: d3.ScaleLinear<number, number>,
  groupStats: number[],
  bands: GroupBand[],
  replicateIndex: number,
) {
  const sel = d3.select(parent)
  for (const band of bands) {
    const stat = groupStats[band.index]
    if (stat == null || !Number.isFinite(stat)) continue
    const x = xScale(stat)!
    const arrowY = bandDeviationArrowY(band)
    const bandBottom = band.top + band.dotAreaHeight
    const tickHalf = GROUP_STAT_VLINE_HEIGHT / 2

    sel
      .append('line')
      .attr('class', 'sample-stat-line')
      .attr('data-index', replicateIndex)
      .attr('data-group', band.index)
      .attr('x1', x)
      .attr('x2', x)
      .attr('y1', bandBottom)
      .attr('y2', arrowY - tickHalf)
      .attr('stroke', band.color)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.85)

    sel
      .append('line')
      .attr('class', 'sample-stat-line sample-stat-vline')
      .attr('data-index', replicateIndex)
      .attr('data-group', band.index)
      .attr('x1', x)
      .attr('x2', x)
      .attr('y1', arrowY - tickHalf)
      .attr('y2', arrowY + tickHalf)
      .attr('stroke', band.color)
      .attr('stroke-width', 2)
  }
}

/** Short vertical line at group stat + horizontal arrow to grand mean (K ≥ 3). */
export function appendPopulationDeviationMarkers(
  parent: SVGGElement,
  xScale: d3.ScaleLinear<number, number>,
  groupStats: number[],
  grandMean: number,
  bands: GroupBand[],
) {
  const sel = d3.select(parent)
  for (const band of bands) {
    const stat = groupStats[band.index]
    if (stat == null || !Number.isFinite(stat)) continue
    const x = xScale(stat)!
    const arrowY = bandDeviationArrowY(band)
    const bandBottom = band.top + band.dotAreaHeight
    const tickHalf = GROUP_STAT_VLINE_HEIGHT / 2

    sel
      .append('line')
      .attr('class', 'pop-stat-drop')
      .attr('data-group', band.index)
      .attr('x1', x)
      .attr('x2', x)
      .attr('y1', bandBottom)
      .attr('y2', arrowY - tickHalf)
      .attr('stroke', band.color)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.85)

    sel
      .append('line')
      .attr('class', 'pop-stat-vline')
      .attr('data-group', band.index)
      .attr('x1', x)
      .attr('x2', x)
      .attr('y1', arrowY - tickHalf)
      .attr('y2', arrowY + tickHalf)
      .attr('stroke', band.color)
      .attr('stroke-width', 2)

    drawHorizontalArrow(sel, x, xScale(grandMean)!, arrowY, band.color, 0.85, undefined, {
      minSpan: 0,
    }).attr('class', 'pop-dev-arrow')
  }
}

export function groupedDiffLabelText(
  stat0: number,
  stat1: number,
  statistic: 'mean' | 'median',
): string {
  const sym = statSymbol(statistic)
  return `${sym}\u2082 \u2212 ${sym}\u2081 = ${formatStatValue(stat1 - stat0)}`
}

/** Label for K≥3: mean absolute deviation from the overall population statistic. */
export function averageDeviationLabelText(
  groupStats: number[],
  grandStat: number,
): string {
  const value = averageDeviationFromGroups(groupStats, grandStat)
  return `Average deviation = ${formatStatValue(value)}`
}

export function appendAverageDeviationLabel(
  parent: SVGGElement,
  innerWidth: number,
  zone: { labelY: number },
  groupStats: number[],
  grandStat: number,
) {
  const sel = d3.select(parent)
  sel.selectAll('.pop-avg-dev-label').remove()
  if (groupStats.length < 3 || !Number.isFinite(grandStat)) return

  const value = averageDeviationFromGroups(groupStats, grandStat)
  if (!Number.isFinite(value)) return

  sel
    .append('text')
    .attr('class', 'pop-avg-dev-label text-sm fill-gray-700')
    .attr('x', innerWidth / 2)
    .attr('y', zone.labelY)
    .attr('text-anchor', 'middle')
    .text(averageDeviationLabelText(groupStats, grandStat))
}

export function appendTwoGroupPopulationDiffDisplay(
  parent: SVGGElement,
  xScale: d3.ScaleLinear<number, number>,
  groupStats: number[],
  bands: GroupBand[],
  diffZone: TwoGroupDiffZone,
  statistic: 'mean' | 'median',
) {
  if (groupStats.length < 2 || bands.length < 2) return
  const stat0 = groupStats[0]!
  const stat1 = groupStats[1]!
  if (!Number.isFinite(stat0) || !Number.isFinite(stat1)) return

  const sel = d3.select(parent)
  const arrowY = diffZone.arrowY

  for (const band of bands.slice(0, 2)) {
    const stat = groupStats[band.index]
    if (stat == null || !Number.isFinite(stat)) continue
    const lineTop = band.statZoneTop + STAT_GAP + TRIANGLE_SIZE
    sel
      .append('line')
      .attr('class', 'pop-stat-drop-line')
      .attr('data-group', band.index)
      .attr('x1', xScale(stat)!)
      .attr('x2', xScale(stat)!)
      .attr('y1', lineTop)
      .attr('y2', arrowY)
      .attr('stroke', '#111827')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3')
  }

  const x0 = xScale(stat0)!
  const x1 = xScale(stat1)!
  drawHorizontalArrow(sel, x0, x1, arrowY, '#dc2626', 1).attr('class', 'pop-diff-arrow')

  sel
    .append('text')
    .attr('class', 'pop-diff-label text-sm fill-gray-700')
    .attr('x', (x0 + x1) / 2)
    .attr('y', diffZone.labelY)
    .attr('text-anchor', 'middle')
    .text(groupedDiffLabelText(stat0, stat1, statistic))
}

export function appendPopulationDifferenceArrow(
  parent: SVGGElement,
  xScale: d3.ScaleLinear<number, number>,
  groupStats: number[],
  innerHeight: number,
) {
  if (groupStats.length < 2) return
  const low = groupStats[0]!
  const high = groupStats[1]!
  if (!Number.isFinite(low) || !Number.isFinite(high)) return
  const y = innerHeight / 2
  const arrow = drawHorizontalArrow(
    d3.select(parent),
    xScale(low)!,
    xScale(high)!,
    y,
    '#dc2626',
    0.9,
  )
  arrow.attr('class', 'pop-diff-arrow')
}

export function twoGroupBandStatLineGeometry(band: GroupBand): {
  lineTop: number
  lineBottom: number
  verticalSpan: number
} {
  const lineTop = band.statZoneTop + STAT_GAP + TRIANGLE_SIZE
  const lineBottom = band.statZoneTop + band.statZoneHeight - 2
  return { lineTop, lineBottom, verticalSpan: lineBottom - lineTop }
}

/** K=2 P2: group mean in the stat strip under the dotplot (matches K≥3 styling). */
export function appendTwoGroupBandSampleStat(
  parent: SVGGElement,
  xScale: d3.ScaleLinear<number, number>,
  stat: number,
  band: GroupBand,
  statistic: 'mean' | 'median',
  replicateIndex: number,
  current = true,
) {
  if (!Number.isFinite(stat)) return
  const x = xScale(stat)!
  const { lineTop, lineBottom } = twoGroupBandStatLineGeometry(band)
  const sel = d3.select(parent)

  sel
    .append('line')
    .attr('class', 'sample-stat-line')
    .attr('data-index', replicateIndex)
    .attr('data-group', band.index)
    .attr('x1', x)
    .attr('x2', x)
    .attr('y1', lineTop)
    .attr('y2', lineBottom)
    .attr('stroke', band.color)
    .attr('stroke-width', 2)
    .attr('stroke-opacity', current ? 1 : PREVIOUS_STAT_OPACITY)

  if (current) {
    appendStatMarker(parent, x, band.statZoneTop, stat, {
      color: band.color,
      showLabel: false,
      statistic,
      classPrefix: 'sample-stat',
    })
  }
}

export function appendTwoGroupSampleMeanMarkers(
  parent: SVGGElement,
  xScale: d3.ScaleLinear<number, number>,
  groupStats: number[],
  bands: GroupBand[],
  statistic: 'mean' | 'median',
  replicateIndex: number,
) {
  if (groupStats.length < 2 || bands.length < 2) return
  const sel = d3.select(parent)
  const summary = sel
    .append('g')
    .attr('class', 'sample-stat-summary')
    .attr('data-index', replicateIndex)

  for (const band of bands.slice(0, 2)) {
    const stat = groupStats[band.index]
    if (stat == null || !Number.isFinite(stat)) continue
    appendStatMarker(summary.node()!, xScale(stat)!, band.statZoneTop, stat, {
      color: band.color,
      showLabel: false,
      statistic,
      classPrefix: 'sample-stat',
    })
  }
}

export async function animateTwoGroupSampleDiffSummary(
  sampleGroup: SVGGElement,
  xScale: d3.ScaleLinear<number, number>,
  groupStats: number[],
  bands: GroupBand[],
  diffZone: TwoGroupDiffZone,
  statistic: 'mean' | 'median',
  replicateIndex: number,
  timing: Pick<
    SampleAnimationTiming,
    'twoGroupDropLineMs' | 'twoGroupPreArrowPauseMs' | 'twoGroupArrowMs'
  >,
  wait: (ms: number) => Promise<void>,
  aborted: () => boolean,
): Promise<void> {
  if (groupStats.length < 2 || bands.length < 2) return
  const stat0 = groupStats[0]!
  const stat1 = groupStats[1]!
  if (!Number.isFinite(stat0) || !Number.isFinite(stat1)) return

  const sel = d3.select(sampleGroup)
  let summary = sel.select<SVGGElement>(
    `.sample-stat-summary[data-index="${replicateIndex}"]`,
  )
  if (summary.empty()) {
    appendTwoGroupSampleMeanMarkers(
      sampleGroup,
      xScale,
      groupStats,
      bands,
      statistic,
      replicateIndex,
    )
    summary = sel.select<SVGGElement>(
      `.sample-stat-summary[data-index="${replicateIndex}"]`,
    )
  }

  const arrowY = diffZone.arrowY
  const dropLines: d3.Selection<SVGLineElement, unknown, null, undefined>[] = []

  for (const band of bands.slice(0, 2)) {
    const stat = groupStats[band.index]
    if (stat == null || !Number.isFinite(stat)) continue
    const { lineBottom } = twoGroupBandStatLineGeometry(band)
    const line = summary
      .append('line')
      .attr('class', 'sample-stat-drop-line')
      .attr('data-group', band.index)
      .attr('x1', xScale(stat)!)
      .attr('x2', xScale(stat)!)
      .attr('y1', lineBottom)
      .attr('y2', lineBottom)
      .attr('stroke', band.color)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3')
      .attr('opacity', 0.65)
    dropLines.push(line)
  }

  const dropDuration = timing.twoGroupDropLineMs
  if (dropDuration > 0 && !aborted()) {
    await Promise.all(
      dropLines.map((line) =>
        line
          .transition()
          .duration(dropDuration)
          .attr('y2', arrowY)
          .end()
          .then(() => undefined),
      ),
    )
  } else {
    dropLines.forEach((line) => line.attr('y2', arrowY))
  }

  if (aborted()) return
  await wait(timing.twoGroupPreArrowPauseMs)
  if (aborted()) return

  const x0 = xScale(stat0)!
  const x1 = xScale(stat1)!
  const arrowDuration = timing.twoGroupArrowMs
  const { g: arrowG, setGeometry } = createHorizontalArrow(
    summary,
    '#dc2626',
    1,
  )
  arrowG.attr('class', 'sample-summary-arrow sample-diff-arrow')
  setGeometry(x0, x0, arrowY)

  if (arrowDuration > 0 && !aborted()) {
    const start = performance.now()
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        if (aborted()) {
          resolve()
          return
        }
        const t = Math.min(1, (now - start) / arrowDuration)
        const eased = d3.easeCubicInOut(t)
        const toX = x0 + (x1 - x0) * eased
        setGeometry(x0, toX, arrowY)
        if (t >= 1) {
          setGeometry(x0, x1, arrowY)
          resolve()
          return
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  } else {
    setGeometry(x0, x1, arrowY)
  }

  const label = summary
    .append('text')
    .attr('class', 'sample-diff-label text-sm fill-gray-700')
    .attr('x', (x0 + x1) / 2)
    .attr('y', diffZone.labelY)
    .attr('text-anchor', 'middle')
    .text(groupedDiffLabelText(stat0, stat1, statistic))

  const labelFadeMs = Math.min(200, timing.twoGroupArrowMs)
  if (labelFadeMs <= 0) {
    label.attr('opacity', 1)
  } else {
    label
      .attr('opacity', 0)
      .transition()
      .duration(labelFadeMs)
      .attr('opacity', 1)
      .end()
      .then(() => undefined)
  }
}

export async function animateSampleDeviationSummary(
  sampleGroup: SVGGElement,
  xScale: d3.ScaleLinear<number, number>,
  groupStats: number[],
  grandMean: number,
  bands: GroupBand[],
  replicateIndex: number,
  innerWidth: number,
  innerHeight: number,
  timing: Pick<SampleAnimationTiming, 'multiGroupArrowsMs'>,
  wait: (ms: number) => Promise<void>,
  aborted: () => boolean,
): Promise<void> {
  if (!Number.isFinite(grandMean)) return
  if (!Number.isFinite(sampleAverageDeviation(groupStats, grandMean))) return

  const sel = d3.select(sampleGroup)
  const summary = sel
    .append('g')
    .attr('class', 'sample-stat-summary')
    .attr('data-index', replicateIndex)

  const labelZone = sampleAvgDevLabelZone(innerHeight)

  summary
    .append('line')
    .attr('class', 'sample-grand-mean')
    .attr('x1', xScale(grandMean)!)
    .attr('x2', xScale(grandMean)!)
    .attr('y1', 0)
    .attr('y2', labelZone.top)
    .attr('stroke', '#111827')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '5,3')
    .attr('opacity', 0)
    .transition()
    .duration(Math.min(200, timing.multiGroupArrowsMs))
    .attr('opacity', 1)
    .end()
    .then(() => undefined)

  type ArrowSpec = { fromX: number; toX: number; y: number; color: string }
  const arrowSpecs: ArrowSpec[] = []

  for (const band of bands) {
    const stat = groupStats[band.index]
    if (stat == null || !Number.isFinite(stat)) continue
    arrowSpecs.push({
      fromX: xScale(stat)!,
      toX: xScale(grandMean)!,
      y: bandDeviationArrowY(band),
      color: band.color,
    })
  }

  const arrowDuration = timing.multiGroupArrowsMs
  const arrowHandles = arrowSpecs.map((spec) => {
    const { g, setGeometry } = createHorizontalArrow(
      summary,
      spec.color,
      0.85,
      8,
      { minSpan: 0 },
    )
    g.attr('class', 'sample-summary-arrow sample-dev-arrow')
    setGeometry(spec.fromX, spec.fromX, spec.y)
    return { ...spec, setGeometry }
  })

  if (arrowDuration > 0 && !aborted()) {
    const start = performance.now()
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        if (aborted()) {
          resolve()
          return
        }
        const t = Math.min(1, (now - start) / arrowDuration)
        const eased = d3.easeCubicInOut(t)
        for (const { fromX, toX, y, setGeometry } of arrowHandles) {
          const currentTo = fromX + (toX - fromX) * eased
          setGeometry(fromX, currentTo, y)
        }
        if (t >= 1) {
          for (const { fromX, toX, y, setGeometry } of arrowHandles) {
            setGeometry(fromX, toX, y)
          }
          resolve()
          return
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  } else {
    for (const { fromX, toX, y, setGeometry } of arrowHandles) {
      setGeometry(fromX, toX, y)
    }
  }

  if (aborted()) return

  const value = averageDeviationFromGroups(groupStats, grandMean)
  if (Number.isFinite(value)) {
    summary
      .append('text')
      .attr('class', 'sample-avg-dev-label text-sm fill-gray-700')
      .attr('x', innerWidth / 2)
      .attr('y', labelZone.labelY)
      .attr('text-anchor', 'middle')
      .attr('opacity', 0)
      .text(averageDeviationLabelText(groupStats, grandMean))
      .transition()
      .duration(200)
      .attr('opacity', 1)
      .end()
      .then(() => undefined)
  }
}

export function appendTwoGroupSampleDiffDisplay(
  parent: SVGGElement,
  xScale: d3.ScaleLinear<number, number>,
  groupStats: number[],
  bands: GroupBand[],
  diffZone: TwoGroupDiffZone,
  statistic: 'mean' | 'median',
  replicateIndex: number,
) {
  if (groupStats.length < 2 || bands.length < 2) return
  const stat0 = groupStats[0]!
  const stat1 = groupStats[1]!
  if (!Number.isFinite(stat0) || !Number.isFinite(stat1)) return

  const sel = d3.select(parent)
  const summary = sel
    .append('g')
    .attr('class', 'sample-stat-summary')
    .attr('data-index', replicateIndex)

  const arrowY = diffZone.arrowY

  for (const band of bands.slice(0, 2)) {
    const stat = groupStats[band.index]
    if (stat == null || !Number.isFinite(stat)) continue
    const { lineBottom } = twoGroupBandStatLineGeometry(band)
    summary
      .append('line')
      .attr('class', 'sample-stat-drop-line')
      .attr('data-group', band.index)
      .attr('x1', xScale(stat)!)
      .attr('x2', xScale(stat)!)
      .attr('y1', lineBottom)
      .attr('y2', arrowY)
      .attr('stroke', band.color)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3')
      .attr('opacity', 0.65)
  }

  const x0 = xScale(stat0)!
  const x1 = xScale(stat1)!
  drawHorizontalArrow(summary, x0, x1, arrowY, '#dc2626', 1).attr(
    'class',
    'sample-summary-arrow sample-diff-arrow',
  )

  summary
    .append('text')
    .attr('class', 'sample-diff-label text-sm fill-gray-700')
    .attr('x', (x0 + x1) / 2)
    .attr('y', diffZone.labelY)
    .attr('text-anchor', 'middle')
    .text(groupedDiffLabelText(stat0, stat1, statistic))
}

/** K≥3 sample deviation markers matching P1 styling (transient overlay). */
export function appendSampleDeviationMarkers(
  parent: SVGGElement,
  xScale: d3.ScaleLinear<number, number>,
  groupStats: number[],
  grandMean: number,
  bands: GroupBand[],
  replicateIndex: number,
  innerWidth: number,
  innerHeight: number,
) {
  const sel = d3.select(parent)
  const summary = sel
    .append('g')
    .attr('class', 'sample-stat-summary')
    .attr('data-index', replicateIndex)

  const labelZone = sampleAvgDevLabelZone(innerHeight)

  summary
    .append('line')
    .attr('class', 'sample-grand-mean')
    .attr('x1', xScale(grandMean)!)
    .attr('x2', xScale(grandMean)!)
    .attr('y1', 0)
    .attr('y2', labelZone.top)
    .attr('stroke', '#111827')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '5,3')

  for (const band of bands) {
    const stat = groupStats[band.index]
    if (stat == null || !Number.isFinite(stat)) continue
    const x = xScale(stat)!
    const arrowY = bandDeviationArrowY(band)
    const bandBottom = band.top + band.dotAreaHeight
    const tickHalf = GROUP_STAT_VLINE_HEIGHT / 2

    summary
      .append('line')
      .attr('class', 'sample-stat-drop')
      .attr('data-group', band.index)
      .attr('x1', x)
      .attr('x2', x)
      .attr('y1', bandBottom)
      .attr('y2', arrowY - tickHalf)
      .attr('stroke', band.color)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.85)

    summary
      .append('line')
      .attr('class', 'sample-stat-vline')
      .attr('data-group', band.index)
      .attr('x1', x)
      .attr('x2', x)
      .attr('y1', arrowY - tickHalf)
      .attr('y2', arrowY + tickHalf)
      .attr('stroke', band.color)
      .attr('stroke-width', 2)

    drawHorizontalArrow(summary, x, xScale(grandMean)!, arrowY, band.color, 0.85, undefined, {
      minSpan: 0,
    }).attr('class', 'sample-summary-arrow sample-dev-arrow')
  }

  const value = averageDeviationFromGroups(groupStats, grandMean)
  if (Number.isFinite(value)) {
    summary
      .append('text')
      .attr('class', 'sample-avg-dev-label text-sm fill-gray-700')
      .attr('x', innerWidth / 2)
      .attr('y', labelZone.labelY)
      .attr('text-anchor', 'middle')
      .text(averageDeviationLabelText(groupStats, grandMean))
  }
}

export function removeSampleStatSummaries(sampleGroup: SVGGElement) {
  clearSampleDiffSummaries(sampleGroup)
  const sel = d3.select(sampleGroup)
  sel.selectAll('.sample-stat-triangle').remove()
  sel.selectAll('.sample-stat-label').remove()
}

/** Remove only P2 diff/deviation summary overlays (arrows, drop lines, labels). */
export function clearSampleDiffSummaries(sampleGroup: SVGGElement) {
  d3.select(sampleGroup).selectAll('.sample-stat-summary').remove()
}

export function appendSampleStatSummary(
  sampleGroup: SVGGElement,
  sampleX: d3.ScaleLinear<number, number>,
  groupStats: number[],
  bands: GroupBand[],
  populationGrandStat: number,
  statistic: 'mean' | 'median',
  statKind: StatKind,
  nGroups: number,
  replicateIndex: number,
  innerHeight: number,
  diffZone: TwoGroupDiffZone,
) {
  if (statKind === 'difference' || nGroups === 2) {
    appendTwoGroupSampleDiffDisplay(
      sampleGroup,
      sampleX,
      groupStats,
      bands,
      diffZone,
      statistic,
      replicateIndex,
    )
    return
  }

  if (statKind !== 'average_deviation' || nGroups < 3) return

  if (!Number.isFinite(populationGrandStat)) return
  if (!Number.isFinite(sampleAverageDeviation(groupStats, populationGrandStat))) return

  const [rangeMin, rangeMax] = sampleX.range()
  const innerWidth = Math.abs(rangeMax - rangeMin)

  appendSampleDeviationMarkers(
    sampleGroup,
    sampleX,
    groupStats,
    populationGrandStat,
    bands,
    replicateIndex,
    innerWidth,
    innerHeight,
  )
}

export function fadePreviousSampleSummaries(
  sampleGroup: SVGGElement,
  signal: { aborted: boolean },
  timingMs: number,
): Promise<void> {
  const existing = d3
    .select(sampleGroup)
    .selectAll<SVGGElement, unknown>('.sample-stat-summary')
  if (existing.empty()) return Promise.resolve()

  const opacity = 0.2
  const duration = timingMs > 0 ? Math.min(300, timingMs * 0.3) : 0
  if (duration <= 0 || signal.aborted) {
    existing.attr('opacity', opacity)
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    existing
      .transition()
      .duration(duration)
      .attr('opacity', opacity)
      .on('end', () => resolve())
  })
}
