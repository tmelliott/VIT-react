import * as d3 from 'd3'
import { drawHorizontalArrow } from './drawArrow'
import { STAT_GAP, TRIANGLE_SIZE, formatStatValue, statSymbol, appendStatMarker } from './statMarker'
import {
  averageDeviationFromGroups,
  populationGrandStat,
  sampleAverageDeviation,
  type GroupBand,
  type TwoGroupDiffZone,
} from './groupLayout'

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
    const lineTop = band.statZoneTop + STAT_GAP
    const lineBottom = lineTop + GROUP_STAT_VLINE_HEIGHT
    const yMid = (lineTop + lineBottom) / 2

    sel
      .append('line')
      .attr('class', 'pop-stat-vline')
      .attr('data-group', band.index)
      .attr('x1', x)
      .attr('x2', x)
      .attr('y1', lineTop)
      .attr('y2', lineBottom)
      .attr('stroke', band.color)
      .attr('stroke-width', 2)

    drawHorizontalArrow(sel, x, xScale(grandMean)!, yMid, band.color, 0.85, undefined, {
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
  drawHorizontalArrow(sel, x1, x0, arrowY, '#dc2626', 1).attr('class', 'pop-diff-arrow')

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
    appendStatMarker(summary.node()!, xScale(stat)!, band.statZoneTop, stat, {
      color: band.color,
      showLabel: false,
      statistic,
      classPrefix: 'sample-stat',
    })
    const lineTop = band.statZoneTop + STAT_GAP + TRIANGLE_SIZE
    summary
      .append('line')
      .attr('class', 'sample-stat-drop-line')
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
  drawHorizontalArrow(summary, x1, x0, arrowY, '#dc2626', 1).attr(
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
  diffZone: TwoGroupDiffZone,
  replicateIndex: number,
  innerWidth: number,
) {
  const sel = d3.select(parent)
  const summary = sel
    .append('g')
    .attr('class', 'sample-stat-summary')
    .attr('data-index', replicateIndex)

  summary
    .append('line')
    .attr('class', 'sample-grand-mean')
    .attr('x1', xScale(grandMean)!)
    .attr('x2', xScale(grandMean)!)
    .attr('y1', 0)
    .attr('y2', diffZone.top)
    .attr('stroke', '#111827')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '5,3')

  for (const band of bands) {
    const stat = groupStats[band.index]
    if (stat == null || !Number.isFinite(stat)) continue
    const x = xScale(stat)!
    const lineTop = band.statZoneTop + STAT_GAP
    const lineBottom = lineTop + GROUP_STAT_VLINE_HEIGHT
    const yMid = (lineTop + lineBottom) / 2

    summary
      .append('line')
      .attr('class', 'sample-stat-vline')
      .attr('data-group', band.index)
      .attr('x1', x)
      .attr('x2', x)
      .attr('y1', lineTop)
      .attr('y2', lineBottom)
      .attr('stroke', band.color)
      .attr('stroke-width', 2)

    drawHorizontalArrow(summary, x, xScale(grandMean)!, yMid, band.color, 0.85, undefined, {
      minSpan: 0,
    }).attr('class', 'sample-summary-arrow sample-dev-arrow')
  }

  appendAverageDeviationLabel(
    summary.node()!,
    innerWidth,
    diffZone,
    groupStats,
    grandMean,
  )
}

export function removeSampleStatSummaries(sampleGroup: SVGGElement) {
  const sel = d3.select(sampleGroup)
  sel.selectAll('.sample-stat-summary').remove()
  sel.selectAll('.sample-stat-triangle').remove()
  sel.selectAll('.sample-stat-label').remove()
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
    diffZone,
    replicateIndex,
    innerWidth,
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
