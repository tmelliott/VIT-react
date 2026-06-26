import * as d3 from 'd3'
import { computeStatistic, type SamplingStatistic } from '../statistics'
import { BOX_AREA_FRACTION, paneRegions } from '../hooks/useSamplingScales'
import { DOT_RADIUS, heapYFromXPositions, plotRangeMin } from './heapLayout'
import { TWO_GROUP_DIFF_ZONE_HEIGHT, SAMPLE_MEAN_STRIP_HEIGHT } from './statMarker'

export const GROUP_COLORS = [
  '#2563eb',
  '#dc2626',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#0891b2',
  '#65a30d',
]

export { BOX_AREA_FRACTION, TWO_GROUP_DIFF_ZONE_HEIGHT }

/** Arrow strip height under each dotplot row in P2 (K≥3 sample pane). */
export const SAMPLE_BAND_ARROW_HEIGHT = 22
/** Reserved space below group rows for the average deviation label (P2 K≥3). */
export const SAMPLE_AVG_DEV_LABEL_HEIGHT = 20

export type SampleAvgDevLabelZone = {
  top: number
  labelY: number
}

export function sampleAvgDevLabelZone(innerHeight: number): SampleAvgDevLabelZone {
  const top = innerHeight - SAMPLE_AVG_DEV_LABEL_HEIGHT
  return { top, labelY: top + SAMPLE_AVG_DEV_LABEL_HEIGHT - 6 }
}

export type GroupBand = {
  index: number
  label: string
  top: number
  height: number
  dotAreaHeight: number
  baselineY: number
  statZoneTop: number
  statZoneHeight: number
  boxTop: number
  boxAreaHeight: number
  color: string
}

export function groupColor(index: number): string {
  return GROUP_COLORS[index % GROUP_COLORS.length]!
}

/** Vertical centre of the per-band deviation arrow row (P2 K≥3). */
export function bandDeviationArrowY(band: GroupBand): number {
  return band.top + band.dotAreaHeight + band.statZoneHeight / 2
}

export function computeGroupBands(
  innerHeight: number,
  groupLevels: string[],
  radius = DOT_RADIUS,
): GroupBand[] {
  const n = Math.max(1, groupLevels.length)
  const bottomReserve = n >= 2 ? TWO_GROUP_DIFF_ZONE_HEIGHT : 0
  const bandsHeight = innerHeight - bottomReserve
  const bandHeight = bandsHeight / n
  return groupLevels.map((label, index) => {
    const top = index * bandHeight
    const regions = paneRegions(bandHeight, radius, {
      showStatLabel: false,
      includeBox: false,
    })
    return {
      index,
      label,
      top,
      height: bandHeight,
      dotAreaHeight: regions.dotAreaHeight,
      baselineY: top + regions.baselineY,
      statZoneTop: top + regions.statZoneTop,
      statZoneHeight: regions.statZoneHeight,
      boxTop: top + regions.boxTop,
      boxAreaHeight: regions.boxAreaHeight,
      color: groupColor(index),
    }
  })
}

/** P2 sample pane for K≥3: each group row = dotplot + deviation arrow strip beneath it. */
export function computeSampleMultiGroupBands(
  innerHeight: number,
  groupLevels: string[],
  radius = DOT_RADIUS,
): GroupBand[] {
  const n = Math.max(1, groupLevels.length)
  const labelZone = sampleAvgDevLabelZone(innerHeight)
  const bandsHeight = labelZone.top
  const bandHeight = bandsHeight / n
  const arrowZoneHeight = Math.min(
    SAMPLE_BAND_ARROW_HEIGHT,
    Math.max(16, Math.floor(bandHeight * 0.28)),
  )
  const dotAreaHeight = bandHeight - arrowZoneHeight

  return groupLevels.map((label, index) => {
    const top = index * bandHeight
    const baselineY = top + dotAreaHeight - radius
    return {
      index,
      label,
      top,
      height: bandHeight,
      dotAreaHeight,
      baselineY,
      statZoneTop: top + dotAreaHeight,
      statZoneHeight: arrowZoneHeight,
      boxTop: top + bandHeight,
      boxAreaHeight: 0,
      color: groupColor(index),
    }
  })
}

/** P2 sample pane for K=2: dotplot + mean strip under each row, shared diff zone at bottom. */
export function computeSampleTwoGroupBands(
  innerHeight: number,
  groupLevels: string[],
  radius = DOT_RADIUS,
): GroupBand[] {
  const diffZone = twoGroupDiffZone(innerHeight)
  const bandsHeight = diffZone.top
  const bandHeight = bandsHeight / Math.max(2, groupLevels.length)
  const markerHeight = SAMPLE_MEAN_STRIP_HEIGHT

  return groupLevels.map((label, index) => {
    const top = index * bandHeight
    const dotAreaHeight = bandHeight - markerHeight
    const baselineY = top + dotAreaHeight - radius
    return {
      index,
      label,
      top,
      height: bandHeight,
      dotAreaHeight,
      baselineY,
      statZoneTop: top + dotAreaHeight,
      statZoneHeight: markerHeight,
      boxTop: top + bandHeight,
      boxAreaHeight: 0,
      color: groupColor(index),
    }
  })
}

export function samplePaneGroupBands(
  innerHeight: number,
  groupLevels: string[],
  nGroups: number,
  radius = DOT_RADIUS,
): GroupBand[] {
  if (nGroups >= 3) {
    return computeSampleMultiGroupBands(innerHeight, groupLevels, radius)
  }
  if (nGroups === 2) {
    return computeSampleTwoGroupBands(innerHeight, groupLevels, radius)
  }
  return computeGroupBands(innerHeight, groupLevels, radius)
}

export type TwoGroupDiffZone = {
  top: number
  arrowY: number
  labelY: number
}

export function twoGroupDiffZone(innerHeight: number): TwoGroupDiffZone {
  const top = innerHeight - TWO_GROUP_DIFF_ZONE_HEIGHT
  const arrowY = top + 10
  return {
    top,
    arrowY,
    labelY: arrowY + 14,
  }
}

export function populationGrandStat(
  population: number[],
  statistic: SamplingStatistic,
): number {
  return computeStatistic(population, statistic)
}

/** Mean absolute deviation over groups present in the sample only. */
export function sampleAverageDeviation(
  groupStats: number[],
  grandStat: number,
): number {
  if (!Number.isFinite(grandStat)) return NaN
  return averageDeviationFromGroups(groupStats, grandStat)
}

export function presentGroupIndices(
  sampleIndices: number[],
  populationGroup: number[],
): Set<number> {
  const present = new Set<number>()
  for (const idx of sampleIndices) {
    const g = populationGroup[idx]
    if (g != null && g >= 0) present.add(g)
  }
  return present
}

export function syncSampleBandLabels(
  sampleGroup: SVGGElement,
  bands: GroupBand[],
  sampleIndices: number[],
  populationGroup: number[],
): void {
  const present = presentGroupIndices(sampleIndices, populationGroup)
  const sel = d3.select(sampleGroup)
  sel.selectAll('.sample-band-label').remove()
  for (const band of bands) {
    if (!present.has(band.index)) continue
    sel
      .append('text')
      .attr('class', 'sample-band-label')
      .attr('x', 4)
      .attr('y', band.top + 12)
      .attr('text-anchor', 'start')
      .attr('font-size', 9)
      .attr('fill', band.color)
      .attr('font-weight', 600)
      .text(band.label)
  }
}

/** Mean absolute deviation of group stats from the overall population statistic. */
export function averageDeviationFromGroups(
  groupStats: number[],
  grandStat: number,
): number {
  const devs = groupStats
    .filter((s) => Number.isFinite(s))
    .map((s) => Math.abs(s - grandStat))
  if (devs.length === 0) return NaN
  return d3.mean(devs) ?? NaN
}

export function groupStatsFromPopulation(
  population: number[],
  populationGroup: number[],
  nGroups: number,
  statistic: SamplingStatistic,
): number[] {
  const stats = new Array<number>(nGroups).fill(0)
  for (let g = 0; g < nGroups; g++) {
    const values = population.filter((_, i) => populationGroup[i] === g)
    if (values.length === 0) {
      stats[g] = 0
    } else {
      stats[g] = computeStatistic(values, statistic)
    }
  }
  return stats
}

export function sampleGroupStats(
  sampleIndices: number[],
  population: number[],
  populationGroup: number[],
  nGroups: number,
  statistic: SamplingStatistic,
): number[] {
  const buckets: number[][] = Array.from({ length: nGroups }, () => [])
  for (const i of sampleIndices) {
    const g = populationGroup[i]
    if (g == null || g < 0 || g >= nGroups) continue
    buckets[g]!.push(population[i]!)
  }
  return buckets.map((values) => {
    if (values.length === 0) return NaN
    return computeStatistic(values, statistic)
  })
}

export function heapYByGroup(
  population: number[],
  populationGroup: number[],
  xScale: { (v: number): number | undefined; range(): number[] },
  bands: GroupBand[],
  radius = DOT_RADIUS,
): number[] {
  const ys = new Array<number>(population.length)
  const rangeMin = plotRangeMin(xScale)

  for (const band of bands) {
    const indices: number[] = []
    const values: number[] = []
    for (let i = 0; i < population.length; i++) {
      if (populationGroup[i] === band.index) {
        indices.push(i)
        values.push(population[i]!)
      }
    }
    if (indices.length === 0) continue

    const xPixels = values.map((v) => xScale(v)!)
    const bandYs = heapYFromXPositions(
      xPixels,
      band.baselineY,
      radius,
      band.top + radius,
      rangeMin,
    )
    for (let j = 0; j < indices.length; j++) {
      ys[indices[j]!] = bandYs[j]!
    }
  }
  return ys
}

export function heapYForSampleInBand(
  values: number[],
  xScale: { (v: number): number | undefined; range(): number[] },
  band: GroupBand,
  radius = DOT_RADIUS,
): number[] {
  const xPixels = values.map((v) => xScale(v)!)
  return heapYFromXPositions(
    xPixels,
    band.baselineY,
    radius,
    band.top + radius,
    plotRangeMin(xScale),
  )
}
