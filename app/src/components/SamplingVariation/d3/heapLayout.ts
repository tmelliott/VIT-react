export const DOT_RADIUS = 5

/** Y centre for the first dot row, sitting on the x-axis. */
export function axisBaselineY(innerHeight: number, radius = DOT_RADIUS): number {
  return innerHeight - radius
}

/** Stack y-positions upward from the x-axis baseline. */
export function heapYValues(
  xValues: number[],
  xScale: (v: number) => number,
  baselineY: number,
  radius: number,
): number[] {
  const n = xValues.length
  if (n === 0) return []

  const [rangeMin, rangeMax] = xScale.range()
  const span = Math.abs(rangeMax - rangeMin)
  const binWidth = Math.max(radius * 2, span / 40)
  const stackCounts = new Map<number, number>()
  const ys = new Array<number>(n)
  const stackStep = radius * 2.2
  const minY = radius
  const maxStack = Math.max(1, Math.floor((baselineY - minY) / stackStep) + 1)

  for (let i = 0; i < n; i++) {
    const xPos = xScale(xValues[i])
    const binIdx = Math.max(
      0,
      Math.min(39, Math.floor((xPos - rangeMin) / binWidth)),
    )
    const stack = Math.min((stackCounts.get(binIdx) ?? 0) + 1, maxStack)
    stackCounts.set(binIdx, stack)
    ys[i] = Math.max(minY, baselineY - (stack - 1) * stackStep)
  }

  return ys
}
