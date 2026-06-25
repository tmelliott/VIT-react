import * as d3 from 'd3'
import { REFERENCE_STAT_COLOR } from './paneStyle'

export function drawReferenceStatLine(
  parent: SVGGElement,
  xScale: d3.ScaleLinear<number, number>,
  stat: number,
  innerHeight: number,
  y1 = 4,
  y2?: number,
) {
  const x = xScale(stat)
  if (x == null || !Number.isFinite(x) || !Number.isFinite(stat)) return

  d3.select(parent)
    .selectAll('.ref-stat-line')
    .remove()
    .data([stat])
    .join('line')
    .attr('class', 'ref-stat-line')
    .attr('x1', x)
    .attr('x2', x)
    .attr('y1', y1)
    .attr('y2', y2 ?? innerHeight - 4)
    .attr('stroke', REFERENCE_STAT_COLOR)
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '5,4')
}

export function removeReferenceStatLine(parent: SVGGElement) {
  d3.select(parent).selectAll('.ref-stat-line').remove()
}
