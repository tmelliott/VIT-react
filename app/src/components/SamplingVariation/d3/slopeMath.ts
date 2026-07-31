/** Least-squares slope and intercept for paired (x, y). */
export function leastSquares(
  x: number[],
  y: number[],
): { slope: number; intercept: number } {
  const n = Math.min(x.length, y.length)
  if (n < 2) return { slope: NaN, intercept: NaN }

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  let count = 0
  for (let i = 0; i < n; i++) {
    const xi = x[i]!
    const yi = y[i]!
    if (!Number.isFinite(xi) || !Number.isFinite(yi)) continue
    sumX += xi
    sumY += yi
    sumXY += xi * yi
    sumXX += xi * xi
    count += 1
  }
  if (count < 2) return { slope: NaN, intercept: NaN }

  const denom = count * sumXX - sumX * sumX
  if (Math.abs(denom) < 1e-12) return { slope: NaN, intercept: NaN }

  const slope = (count * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / count
  return { slope, intercept }
}

/** Round to a "nice" magnitude near `target` (1–2–5 × 10^k). */
export function niceNumber(target: number): number {
  if (!Number.isFinite(target) || target === 0) return 1
  const sign = target < 0 ? -1 : 1
  const abs = Math.abs(target)
  const exp = Math.floor(Math.log10(abs))
  const frac = abs / 10 ** exp
  let niceFrac: number
  if (frac < 1.5) niceFrac = 1
  else if (frac < 3.5) niceFrac = 2
  else if (frac < 7.5) niceFrac = 5
  else niceFrac = 10
  return sign * niceFrac * 10 ** exp
}

export type SlopeTriangle = {
  /** Start point on the fitted line (data units). */
  x0: number
  y0: number
  /** End point on the fitted line (data units). */
  x1: number
  y1: number
  dx: number
  dy: number
}

/**
 * Pedagogical rise/run triangle on the LS line.
 * Prefers a nice |Δy| near ~20% of the y-domain span; Δx = Δy / slope.
 */
export function slopeDerivationTriangle(
  slope: number,
  intercept: number,
  xDomain: [number, number],
  yDomain: [number, number],
): SlopeTriangle | null {
  if (!Number.isFinite(slope) || !Number.isFinite(intercept) || Math.abs(slope) < 1e-12) {
    return null
  }

  const ySpan = yDomain[1] - yDomain[0]
  const xSpan = xDomain[1] - xDomain[0]
  if (!(ySpan > 0) || !(xSpan > 0)) return null

  const targetDy = 0.2 * ySpan
  let dy = niceNumber(targetDy)
  // Keep triangle from dominating the pane.
  if (Math.abs(dy) > 0.45 * ySpan) {
    dy = niceNumber(0.15 * ySpan)
  }
  if (slope < 0) dy = -Math.abs(dy)
  else dy = Math.abs(dy)

  let dx = dy / slope
  // If run is huge relative to x, shrink to ~25% of x span and accept non-nice dy.
  if (Math.abs(dx) > 0.45 * xSpan) {
    dx = Math.sign(dx) * 0.25 * xSpan
    dy = slope * dx
    // Re-nice dy if possible without blowing x.
    const niceDy = niceNumber(dy)
    const trialDx = niceDy / slope
    if (Math.abs(trialDx) <= 0.45 * xSpan) {
      dy = niceDy
      dx = trialDx
    }
  }

  // Place near the horizontal centre of the line segment that stays in-bounds.
  const midX = (xDomain[0] + xDomain[1]) / 2
  let x0 = midX - dx / 2
  let x1 = x0 + dx
  if (x0 < xDomain[0]) {
    x0 = xDomain[0] + 0.05 * xSpan
    x1 = x0 + dx
  }
  if (x1 > xDomain[1]) {
    x1 = xDomain[1] - 0.05 * xSpan
    x0 = x1 - dx
  }

  const y0 = slope * x0 + intercept
  const y1 = slope * x1 + intercept

  // Vertically nudge if the rise-then-run corner (x0, y1) sits outside the y domain.
  const cornerY = y1
  if (
    cornerY < yDomain[0] ||
    cornerY > yDomain[1] ||
    y0 < yDomain[0] ||
    y0 > yDomain[1]
  ) {
    // Shift along the line so the triangle stays inside the plot.
    const shift = Math.sign(slope) * 0.1 * ySpan
    const y0b = y0 + shift
    const x0b = (y0b - intercept) / slope
    const x1b = x0b + dx
    const y1b = y0b + dy
    if (
      x0b >= xDomain[0] &&
      x1b <= xDomain[1] &&
      y0b >= yDomain[0] &&
      y1b >= yDomain[0] &&
      y1b <= yDomain[1]
    ) {
      return { x0: x0b, y0: y0b, x1: x1b, y1: y1b, dx, dy }
    }
  }

  return { x0, y0, x1, y1: y0 + dy, dx, dy }
}

/** Format a slope / delta for labels. */
export function formatSlopeNumber(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 100) return value.toFixed(1)
  if (abs >= 10) return value.toFixed(2)
  if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-9) {
    return String(Math.round(value))
  }
  if (abs >= 1) return value.toFixed(2)
  return value.toFixed(3)
}
