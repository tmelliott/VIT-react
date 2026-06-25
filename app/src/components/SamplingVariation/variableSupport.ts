export type VariableSupport = 'empty' | 'one_num' | 'num_cat' | 'unsupported'

export function isNumericVariable(name: string, variables: string[]): boolean {
  return variables.includes(name)
}

export function isCategoricalVariable(
  name: string,
  groupVariables: string[],
): boolean {
  return groupVariables.includes(name)
}

export function getVariableSupport(
  xvar: string,
  yvar: string,
  variables: string[],
  groupVariables: string[],
): VariableSupport {
  if (!xvar) return 'empty'
  if (!isNumericVariable(xvar, variables)) return 'unsupported'
  if (!yvar) return 'one_num'
  if (isCategoricalVariable(yvar, groupVariables)) return 'num_cat'
  return 'unsupported'
}

export function populationDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1]

  let min = Infinity
  let max = -Infinity
  for (const value of values) {
    if (!Number.isFinite(value)) continue
    min = Math.min(min, value)
    max = Math.max(max, value)
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  if (min === max) return [min - 1, max + 1]

  const pad = (max - min) * 0.05
  return [min - pad, max + pad]
}

export function effectivePopDomain(
  population: number[],
  scalesPop: Float64Array | number[] | undefined | null,
): [number, number] {
  const scaled = scalesPop == null ? [] : Array.from(scalesPop)
  if (scaled.length >= 2) return [scaled[0]!, scaled[1]!]
  if (population.length > 0) return populationDomain(population)
  return [0, 1]
}

export function effectiveDistDomain(
  sampleStats: number[],
  scalesDist: Float64Array | number[] | undefined | null,
): [number, number] {
  const scaled = scalesDist == null ? [] : Array.from(scalesDist)
  if (scaled.length >= 2) return [scaled[0]!, scaled[1]!]
  if (sampleStats.length > 0) return populationDomain(sampleStats)
  return [0, 1]
}

/** P3 axis for K≥3: same px/unit as pop/sample, domain shifted to start at 0. */
export function distDomainAlignedToPop(
  popDomain: [number, number],
): [number, number] {
  const span = popDomain[1] - popDomain[0]
  if (!Number.isFinite(span) || span <= 0) return [0, 1]
  return [0, span]
}
