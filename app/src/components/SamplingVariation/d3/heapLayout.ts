export const DOT_RADIUS = 5

/** Y centre for the first dot row, sitting on the x-axis. */
export function axisBaselineY(innerHeight: number, radius = DOT_RADIUS): number {
  return innerHeight - radius
}

export function plotRangeMin(xScale: { range(): number[] }): number {
  const [r0, r1] = xScale.range()
  return Math.min(r0, r1)
}

/** Dot diameter in pixels — also used as horizontal bin width. */
export function dotDiameter(radius: number): number {
  return radius * 2
}

/**
 * Assign stack levels using fixed-width pixel bins (width = dot diameter).
 * Points whose centres fall in the same bin stack vertically.
 */
export function stackPointLevelsByBin(
  xPixels: number[],
  rangeMin: number,
  binWidth: number,
): number[] {
  const stackCounts = new Map<number, number>()
  const levels = new Array<number>(xPixels.length)

  for (let i = 0; i < xPixels.length; i++) {
    const binIdx = Math.floor((xPixels[i]! - rangeMin) / binWidth)
    const stack = (stackCounts.get(binIdx) ?? 0) + 1
    stackCounts.set(binIdx, stack)
    levels[i] = stack
  }

  return levels
}

/** Compress a pile vertically when it exceeds the available band height. */
export function fitStackYToHeight(
  ys: number[],
  floorY: number,
  minY: number,
): void {
  if (ys.length === 0) return
  const top = Math.min(...ys)
  if (top >= minY) return
  const pileHeight = floorY - top
  const available = floorY - minY
  if (pileHeight <= available || pileHeight <= 0) return
  const scale = available / pileHeight
  for (let i = 0; i < ys.length; i++) {
    ys[i] = floorY - (floorY - ys[i]!) * scale
  }
}

/** Stack y-positions upward from baseline, keeping approximate x alignment. */
export function heapYFromXPositions(
  xPixels: number[],
  baselineY: number,
  radius: number,
  minY = radius,
  rangeMin = 0,
): number[] {
  const n = xPixels.length
  if (n === 0) return []
  if (n === 1) return [baselineY]

  const binWidth = dotDiameter(radius)
  const levels = stackPointLevelsByBin(xPixels, rangeMin, binWidth)
  const maxStack = Math.max(...levels)
  const available = baselineY - minY
  const stackStep = Math.min(available / maxStack, binWidth)

  const ys = levels.map((level) => baselineY - (level - 1) * stackStep)
  fitStackYToHeight(ys, baselineY, minY)
  return ys
}

/** Stack y-positions upward from the x-axis baseline. */
export function heapYValues(
  xValues: number[],
  xScale: { (v: number): number | undefined; range(): number[] },
  baselineY: number,
  radius: number,
): number[] {
  const xPixels = xValues.map((v) => xScale(v)!)
  return heapYFromXPositions(
    xPixels,
    baselineY,
    radius,
    radius,
    plotRangeMin(xScale),
  )
}
