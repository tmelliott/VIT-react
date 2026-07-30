import {
  averageDeviationFromGroups,
  groupStatsFromPopulation,
  populationGrandStat,
} from '../components/SamplingVariation/d3/groupLayout'
import { proportionFromEncoded } from '../components/SamplingVariation/d3/proportionLayout'
import { combineGroupProps } from '../components/SamplingVariation/statistics'
import type { VariableSupport } from '../components/SamplingVariation/variableSupport'

/** Deterministic pseudo-random in [0, 1). */
function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function normalish(rand: () => number, mean: number, sd: number): number {
  // Box–Muller
  const u = Math.max(1e-9, rand())
  const v = rand()
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return mean + sd * z
}

function numericPopulation(
  seed: number,
  n: number,
  mean: number,
  sd: number,
): number[] {
  const rand = mulberry32(seed)
  return Array.from({ length: n }, () =>
    Math.round(normalish(rand, mean, sd) * 10) / 10,
  )
}

type NumericFixtureProps = {
  population: number[]
  populationGroup: number[]
  groupLevels: string[]
  groupStats: number[]
  nGroups: number
  statKind: string
  statistic: string
  populationStat: number | undefined
  showPopulationStat: boolean
  showFullPopulation: boolean
  moduleReady: boolean
  variableSupport: VariableSupport
  sampleSize: number
  scales: undefined
}

type ProportionFixtureProps = {
  populationCategory: number[]
  populationGroup: number[]
  groupLevels: string[]
  groupStats: number[]
  categoryLabels: string[]
  nGroups: number
  statKind: string
  populationStat: number | undefined
  showPopulationStat: boolean
  moduleReady: boolean
  variableSupport: VariableSupport
  sampleSize: number
  scales: undefined
}

export type P1GalleryFixture =
  | {
      id: string
      title: string
      description: string
      kind: 'numeric'
      props: NumericFixtureProps
    }
  | {
      id: string
      title: string
      description: string
      kind: 'proportion'
      props: ProportionFixtureProps
    }

function numericBase(
  partial: Omit<
    NumericFixtureProps,
    | 'showPopulationStat'
    | 'showFullPopulation'
    | 'moduleReady'
    | 'sampleSize'
    | 'scales'
  >,
): NumericFixtureProps {
  return {
    ...partial,
    showPopulationStat: true,
    showFullPopulation: true,
    moduleReady: false,
    sampleSize: 25,
    scales: undefined,
  }
}

function proportionBase(
  partial: Omit<
    ProportionFixtureProps,
    'showPopulationStat' | 'moduleReady' | 'sampleSize' | 'scales'
  >,
): ProportionFixtureProps {
  return {
    ...partial,
    showPopulationStat: true,
    moduleReady: false,
    sampleSize: 25,
    scales: undefined,
  }
}

function buildOneNum(statistic: string): P1GalleryFixture {
  const population = numericPopulation(42, 80, 68, 8)
  const populationStat = populationGrandStat(
    population,
    statistic === 'median' ||
      statistic === 'lq' ||
      statistic === 'uq' ||
      statistic === 'iqr'
      ? statistic
      : 'mean',
  )
  const label =
    statistic === 'mean'
      ? 'One numeric — mean'
      : statistic === 'median'
        ? 'One numeric — median (boxplot)'
        : `One numeric — ${statistic}`
  return {
    id: `one_num_${statistic}`,
    title: label,
    description: `Heap of ${population.length} values with population ${statistic} highlighted.`,
    kind: 'numeric',
    props: numericBase({
      population,
      populationGroup: [],
      groupLevels: [],
      groupStats: [],
      nGroups: 0,
      statKind: '',
      statistic,
      populationStat,
      variableSupport: 'one_num',
    }),
  }
}

function buildNumCatTwoGroups(): P1GalleryFixture {
  const a = numericPopulation(7, 40, 62, 6)
  const b = numericPopulation(11, 40, 74, 7)
  const population = [...a, ...b]
  const populationGroup = [
    ...Array.from({ length: a.length }, () => 0),
    ...Array.from({ length: b.length }, () => 1),
  ]
  const groupLevels = ['Control', 'Treatment']
  const nGroups = 2
  const statistic = 'mean'
  const groupStats = groupStatsFromPopulation(
    population,
    populationGroup,
    nGroups,
    statistic,
  )
  const populationStat = combineGroupProps(groupStats[0]!, groupStats[1]!, 'difference')
  return {
    id: 'num_cat_k2',
    title: 'Numeric × category (k=2) — difference',
    description: 'Two group heaps with a population difference summary.',
    kind: 'numeric',
    props: numericBase({
      population,
      populationGroup,
      groupLevels,
      groupStats,
      nGroups,
      statKind: 'difference',
      statistic,
      populationStat,
      variableSupport: 'num_cat',
    }),
  }
}

function buildNumCatThreeGroups(): P1GalleryFixture {
  const a = numericPopulation(3, 30, 55, 5)
  const b = numericPopulation(5, 30, 68, 6)
  const c = numericPopulation(9, 30, 80, 7)
  const population = [...a, ...b, ...c]
  const populationGroup = [
    ...Array.from({ length: a.length }, () => 0),
    ...Array.from({ length: b.length }, () => 1),
    ...Array.from({ length: c.length }, () => 2),
  ]
  const groupLevels = ['A', 'B', 'C']
  const nGroups = 3
  const statistic = 'mean'
  const groupStats = groupStatsFromPopulation(
    population,
    populationGroup,
    nGroups,
    statistic,
  )
  const grand = populationGrandStat(population, statistic)
  const populationStat = averageDeviationFromGroups(groupStats, grand)
  return {
    id: 'num_cat_k3',
    title: 'Numeric × category (k≥3) — average deviation',
    description: 'Three group heaps with average-deviation markers.',
    kind: 'numeric',
    props: numericBase({
      population,
      populationGroup,
      groupLevels,
      groupStats,
      nGroups,
      statKind: 'average_deviation',
      statistic,
      populationStat,
      variableSupport: 'num_cat',
    }),
  }
}

function buildOneCat(): P1GalleryFixture {
  const rand = mulberry32(21)
  const populationCategory = Array.from({ length: 60 }, () =>
    rand() < 0.42 ? 0 : 1,
  )
  const populationStat = proportionFromEncoded(populationCategory, 0)
  return {
    id: 'one_cat',
    title: 'One categorical — proportion',
    description: 'Hybrid unit chart for a single binary variable.',
    kind: 'proportion',
    props: proportionBase({
      populationCategory,
      populationGroup: [],
      groupLevels: [],
      groupStats: [],
      categoryLabels: ['Yes', 'No'],
      nGroups: 0,
      statKind: 'proportion',
      populationStat,
      variableSupport: 'one_cat',
    }),
  }
}

function buildTwoCat(): P1GalleryFixture {
  const rand = mulberry32(99)
  const nPer = 35
  const populationCategory: number[] = []
  const populationGroup: number[] = []
  // Group 0: ~30% focus; Group 1: ~55% focus
  for (let i = 0; i < nPer; i++) {
    populationCategory.push(rand() < 0.3 ? 0 : 1)
    populationGroup.push(0)
  }
  for (let i = 0; i < nPer; i++) {
    populationCategory.push(rand() < 0.55 ? 0 : 1)
    populationGroup.push(1)
  }
  const groupLevels = ['Female', 'Male']
  const nGroups = 2
  const groupStats = groupLevels.map((_, g) => {
    const encoded = populationCategory.filter((_, i) => populationGroup[i] === g)
    return proportionFromEncoded(encoded, 0)
  })
  const populationStat = combineGroupProps(groupStats[0]!, groupStats[1]!, 'difference')
  return {
    id: 'two_cat',
    title: 'Two categorical — group proportions',
    description: 'Multi-group proportion bars with a difference summary.',
    kind: 'proportion',
    props: proportionBase({
      populationCategory,
      populationGroup,
      groupLevels,
      groupStats,
      categoryLabels: ['Passed', 'Failed'],
      nGroups,
      statKind: 'difference',
      populationStat,
      variableSupport: 'two_cat',
    }),
  }
}

/** Static P1 scenarios for design review without R. */
export const p1GalleryFixtures: P1GalleryFixture[] = [
  buildOneNum('mean'),
  buildOneNum('median'),
  buildNumCatTwoGroups(),
  buildNumCatThreeGroups(),
  buildOneCat(),
  buildTwoCat(),
]
