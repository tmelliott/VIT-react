import * as d3 from 'd3'
import { drawHorizontalArrow } from './drawArrow'
import { populationGrandStat, type GroupBand } from './groupLayout'

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

export function appendSampleStatSummary(
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
  innerHeight: number,
) {
  const sel = d3.select(sampleGroup)
  const summary = sel
    .append('g')
    .attr('class', 'sample-stat-summary')
    .attr('data-index', replicateIndex)

  if (statKind === 'difference' || nGroups === 2) {
    const low = groupStats[0]
    const high = groupStats[1]
    if (
      low == null ||
      high == null ||
      !Number.isFinite(low) ||
      !Number.isFinite(high)
    ) {
      summary.remove()
      return
    }
    const y = innerHeight / 2
    const arrow = drawHorizontalArrow(
      summary,
      sampleX(low)!,
      sampleX(high)!,
      y,
      '#dc2626',
      1,
    )
    arrow
      .attr('class', 'sample-summary-arrow sample-diff-arrow')
      .raise()
    return
  }

  if (statKind !== 'average_deviation' || nGroups < 3) {
    summary.remove()
    return
  }

  const grandMean = sampleGrandStat(sampleIndices, population, statistic)
  if (!Number.isFinite(grandMean)) {
    summary.remove()
    return
  }

  summary
    .append('line')
    .attr('class', 'sample-grand-mean')
    .attr('x1', sampleX(grandMean)!)
    .attr('x2', sampleX(grandMean)!)
    .attr('y1', 0)
    .attr('y2', innerHeight)
    .attr('stroke', '#111827')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '5,3')

  for (const band of bands) {
    const stat = groupStats[band.index]
    if (stat == null || !Number.isFinite(stat)) continue
    const y = band.top + band.height / 2
    const arrow = drawHorizontalArrow(
      summary,
      sampleX(stat)!,
      sampleX(grandMean)!,
      y,
      '#6b7280',
      1,
    )
    arrow.attr('class', 'sample-summary-arrow sample-dev-arrow')
  }
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
