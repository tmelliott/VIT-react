import * as d3 from 'd3'

export function drawBottomAxis(
  container: SVGGElement,
  scale: d3.ScaleLinear<number, number>,
  width: number,
) {
  const g = d3.select(container)
  g.selectAll('*').remove()

  const [d0, d1] = scale.domain()
  const span = Math.abs(d1 - d0)
  const tickCount = Math.max(2, Math.min(8, Math.floor(width / 72)))
  const format =
    span >= 100 ? d3.format('.0f')
    : span >= 10 ? d3.format('.1f')
    : span >= 1 ? d3.format('.2f')
    : d3.format('.3f')

  const axis = d3
    .axisBottom(scale)
    .ticks(tickCount)
    .tickFormat(format)
    .tickSizeOuter(0)

  g.call(axis)
  g.selectAll('text').attr('fill', '#4b5563').attr('font-size', 10)
  g.selectAll('line').attr('stroke', '#9ca3af')
  g.select('.domain').attr('stroke', '#9ca3af')
}
