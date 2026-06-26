import * as d3 from 'd3'

export type SamplingStatistic = 'mean' | 'median' | 'lq' | 'uq' | 'iqr'

export type BoxplotHighlight = 'median' | 'lq' | 'uq' | 'iqr'

/** @deprecated Use BoxplotHighlight */
export type QuartileHighlight = BoxplotHighlight

const ALL_STATISTICS: SamplingStatistic[] = ['mean', 'median', 'lq', 'uq', 'iqr']

function formatStatValue(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1000) return value.toFixed(0)
  if (abs >= 100) return value.toFixed(1)
  if (abs >= 10) return value.toFixed(2)
  return value.toFixed(3)
}

export function parseSamplingStatistic(
  value: string | undefined | null,
): SamplingStatistic {
  if (
    value === 'median' ||
    value === 'lq' ||
    value === 'uq' ||
    value === 'iqr'
  ) {
    return value
  }
  return 'mean'
}

/** Quartile stats apply to one numeric (k=1) and two-group layouts only. */
export function availableStatistics(
  numCatMode: boolean,
  nGroups: number,
): SamplingStatistic[] {
  if (!numCatMode || nGroups <= 2) return ALL_STATISTICS
  return ['mean', 'median']
}

export function usesBoxplotHighlight(
  statistic: SamplingStatistic,
): statistic is BoxplotHighlight {
  return (
    statistic === 'median' ||
    statistic === 'lq' ||
    statistic === 'uq' ||
    statistic === 'iqr'
  )
}

/** @deprecated Use usesBoxplotHighlight */
export function isQuartileStatistic(
  statistic: SamplingStatistic,
): statistic is BoxplotHighlight {
  return usesBoxplotHighlight(statistic)
}

export function computeStatistic(
  values: number[],
  statistic: SamplingStatistic,
): number {
  const clean = values.filter((v) => Number.isFinite(v))
  if (clean.length === 0) return NaN
  const sorted = [...clean].sort(d3.ascending)
  switch (statistic) {
    case 'mean':
      return d3.mean(clean) ?? NaN
    case 'median':
      return d3.median(clean) ?? NaN
    case 'lq':
      return d3.quantileSorted(sorted, 0.25) ?? NaN
    case 'uq':
      return d3.quantileSorted(sorted, 0.75) ?? NaN
    case 'iqr': {
      const q1 = d3.quantileSorted(sorted, 0.25)
      const q3 = d3.quantileSorted(sorted, 0.75)
      if (q1 == null || q3 == null) return NaN
      return q3 - q1
    }
  }
}

export function statSymbol(statistic: SamplingStatistic): string {
  switch (statistic) {
    case 'median':
      return 'x\u0303'
    case 'lq':
      return 'Q\u2081'
    case 'uq':
      return 'Q\u2083'
    case 'iqr':
      return 'IQR'
    default:
      return 'x\u0304'
  }
}

export function statOptionLabel(statistic: SamplingStatistic): string {
  switch (statistic) {
    case 'mean':
      return 'Mean (x̄)'
    case 'median':
      return 'Median (x̃)'
    case 'lq':
      return 'Lower quartile (Q₁)'
    case 'uq':
      return 'Upper quartile (Q₃)'
    case 'iqr':
      return 'Interquartile range (IQR)'
  }
}

export function twoGroupSummaryLabel(
  stat0: number,
  stat1: number,
  statistic: SamplingStatistic,
  statKind: 'difference' | 'ratio',
): string {
  const sym = statSymbol(statistic)
  if (statKind === 'ratio') {
    if (stat0 === 0) return `${sym}\u2082 / ${sym}\u2081 = —`
    return `${sym}\u2082 / ${sym}\u2081 = ${formatStatValue(stat1 / stat0)}`
  }
  return `${sym}\u2082 \u2212 ${sym}\u2081 = ${formatStatValue(stat1 - stat0)}`
}

/** P3 axis anchor for two-group summaries (0 for differences, 1 for ratios). */
export function distBaselineValue(
  statKind: 'difference' | 'ratio' | 'average_deviation' | '',
): number {
  return statKind === 'ratio' ? 1 : 0
}
