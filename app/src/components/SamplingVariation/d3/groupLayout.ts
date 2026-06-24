import * as d3 from 'd3'
import { BOX_AREA_FRACTION, paneRegions } from '../hooks/useSamplingScales'
import { DOT_RADIUS, heapYFromXPositions, plotRangeMin } from './heapLayout'

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

export type GroupBand = {
  index: number
  label: string
  top: number
  height: number
  dotAreaHeight: number
  baselineY: number
  boxTop: number
  boxAreaHeight: number
  color: string
}

export function groupColor(index: number): string {
  return GROUP_COLORS[index % GROUP_COLORS.length]!
}

export function computeGroupBands(
  innerHeight: number,
  groupLevels: string[],
  radius = DOT_RADIUS,
): GroupBand[] {
  const n = Math.max(1, groupLevels.length)
  const bandHeight = innerHeight / n
  return groupLevels.map((label, index) => {
    const top = index * bandHeight
    const regions = paneRegions(bandHeight, radius)
    return {
      index,
      label,
      top,
      height: bandHeight,
      dotAreaHeight: regions.dotAreaHeight,
      baselineY: top + regions.baselineY,
      boxTop: top + regions.boxTop,
      boxAreaHeight: regions.boxAreaHeight,
      color: groupColor(index),
    }
  })
}

export function populationGrandStat(
  population: number[],
  statistic: 'mean' | 'median',
): number {
  if (population.length === 0) return 0
  if (statistic === 'median') return d3.median(population) ?? 0
  return d3.mean(population) ?? 0
}

export function groupStatsFromPopulation(
  population: number[],
  populationGroup: number[],
  nGroups: number,
  statistic: 'mean' | 'median',
): number[] {
  const stats = new Array<number>(nGroups).fill(0)
  for (let g = 0; g < nGroups; g++) {
    const values = population.filter((_, i) => populationGroup[i] === g)
    if (values.length === 0) {
      stats[g] = 0
    } else if (statistic === 'median') {
      stats[g] = d3.median(values) ?? 0
    } else {
      stats[g] = d3.mean(values) ?? 0
    }
  }
  return stats
}

export function sampleGroupStats(
  sampleIndices: number[],
  population: number[],
  populationGroup: number[],
  nGroups: number,
  statistic: 'mean' | 'median',
): number[] {
  const buckets: number[][] = Array.from({ length: nGroups }, () => [])
  for (const i of sampleIndices) {
    const g = populationGroup[i]
    if (g == null || g < 0 || g >= nGroups) continue
    buckets[g]!.push(population[i]!)
  }
  return buckets.map((values) => {
    if (values.length === 0) return NaN
    if (statistic === 'median') return d3.median(values) ?? NaN
    return d3.mean(values) ?? NaN
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

export { BOX_AREA_FRACTION }
