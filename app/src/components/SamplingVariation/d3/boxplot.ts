import * as d3 from 'd3'

export type FiveNum = {
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

export function fiveNumSummary(values: number[]): FiveNum | null {
  const clean = values.filter((v) => Number.isFinite(v))
  if (clean.length === 0) return null
  const sorted = [...clean].sort((a, b) => a - b)
  return {
    min: sorted[0]!,
    q1: d3.quantileSorted(sorted, 0.25)!,
    median: d3.quantileSorted(sorted, 0.5)!,
    q3: d3.quantileSorted(sorted, 0.75)!,
    max: sorted[sorted.length - 1]!,
  }
}

/** Horizontal boxplot matching VITonline makeBoxplot. */
export function drawHorizontalBoxplot(
  parent: SVGGElement,
  values: number[],
  xScale: d3.ScaleLinear<number, number>,
  y: number,
  height: number,
  className = 'boxplot',
) {
  const summary = fiveNumSummary(values)
  const g = d3.select(parent)
  g.selectAll(`.${className}`).remove()
  if (!summary) return

  const box = g.append('g').attr('class', className)
  const midY = y + height / 2
  const topY = y
  const bottomY = y + height
  const xMin = xScale(summary.min)
  const xQ1 = xScale(summary.q1)
  const xMed = xScale(summary.median)
  const xQ3 = xScale(summary.q3)
  const xMax = xScale(summary.max)
  const stroke = '#374151'

  const line = (x1: number, y1: number, x2: number, y2: number) => {
    box
      .append('line')
      .attr('x1', x1)
      .attr('y1', y1)
      .attr('x2', x2)
      .attr('y2', y2)
      .attr('stroke', stroke)
      .attr('stroke-width', 1.5)
  }

  line(xMin, midY, xQ1, midY)
  line(xQ1, topY, xQ1, bottomY)
  line(xMed, topY, xMed, bottomY)
  line(xQ3, topY, xQ3, bottomY)
  line(xQ3, midY, xMax, midY)
  line(xQ1, topY, xQ3, topY)
  line(xQ1, bottomY, xQ3, bottomY)
}

export function removeBoxplot(parent: SVGGElement, className = 'boxplot') {
  d3.select(parent).selectAll(`.${className}`).remove()
}
