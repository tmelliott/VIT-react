import * as d3 from 'd3'
import {
  DIST_POPULATION_REF_COLOR,
  DIST_POPULATION_REF_WIDTH,
  DIST_REF_HALO_COLOR,
  DIST_REF_HALO_WIDTH,
  REFERENCE_STAT_COLOR,
} from './paneStyle'

type ReferenceLineOptions = {
  className?: string
  dashed?: boolean
  y1?: number
  y2?: number
  /** P3: white under-stroke so the line stays visible over dist dots. */
  halo?: boolean
  color?: string
  strokeWidth?: number
}

function drawVerticalReferenceLine(
  parent: SVGGElement,
  xScale: d3.ScaleLinear<number, number>,
  stat: number,
  innerHeight: number,
  options: ReferenceLineOptions,
) {
  const x = xScale(stat)
  if (x == null || !Number.isFinite(x) || !Number.isFinite(stat)) return

  const className = options.className ?? 'ref-stat-line'
  const lineY1 = options.y1 ?? 4
  const lineY2 = options.y2 ?? innerHeight - 4
  const dashed = options.dashed ?? true
  const color = options.color ?? REFERENCE_STAT_COLOR
  const strokeWidth = options.strokeWidth ?? 1.5
  const halo = options.halo ?? false

  const sel = d3.select(parent)
  sel.selectAll(`.${className}, .${className}-halo`).remove()

  if (halo) {
    sel
      .append('line')
      .attr('class', `${className}-halo`)
      .attr('x1', x)
      .attr('x2', x)
      .attr('y1', lineY1)
      .attr('y2', lineY2)
      .attr('stroke', DIST_REF_HALO_COLOR)
      .attr('stroke-width', DIST_REF_HALO_WIDTH)
      .attr('stroke-linecap', 'round')
  }

  const line = sel
    .append('line')
    .attr('class', className)
    .attr('x1', x)
    .attr('x2', x)
    .attr('y1', lineY1)
    .attr('y2', lineY2)
    .attr('stroke', color)
    .attr('stroke-width', strokeWidth)
    .attr('stroke-linecap', 'round')

  if (dashed) {
    line.attr('stroke-dasharray', '5,4')
  } else {
    line.attr('stroke-dasharray', null)
  }
}

export function drawReferenceStatLine(
  parent: SVGGElement,
  xScale: d3.ScaleLinear<number, number>,
  stat: number,
  innerHeight: number,
  y1 = 4,
  y2?: number,
  options?: ReferenceLineOptions,
) {
  drawVerticalReferenceLine(parent, xScale, stat, innerHeight, {
    ...options,
    y1: options?.y1 ?? y1,
    y2: options?.y2 ?? y2,
  })
}

/** P3 population parameter — dashed, dark, with halo over dist dots (k≥3 and k=2 Δ). */
export function drawDistPopulationReferenceLine(
  parent: SVGGElement,
  xScale: d3.ScaleLinear<number, number>,
  stat: number,
  innerHeight: number,
  className = 'dist-pop-stat-line',
) {
  drawVerticalReferenceLine(parent, xScale, stat, innerHeight, {
    className,
    dashed: true,
    halo: true,
    color: DIST_POPULATION_REF_COLOR,
    strokeWidth: DIST_POPULATION_REF_WIDTH,
  })
}

/** P3 k=2: solid baseline line (0 for differences, 1 for ratios) and population summary. */
export function drawDistTwoGroupReferenceLines(
  parent: SVGGElement,
  xScale: d3.ScaleLinear<number, number>,
  populationSummary: number,
  innerHeight: number,
  baseline = 0,
) {
  drawReferenceStatLine(parent, xScale, baseline, innerHeight, 4, undefined, {
    className: 'dist-zero-line',
    dashed: false,
    halo: true,
  })
  if (Number.isFinite(populationSummary)) {
    drawDistPopulationReferenceLine(parent, xScale, populationSummary, innerHeight)
  }
}

export function removeReferenceStatLine(parent: SVGGElement) {
  d3.select(parent).selectAll('.ref-stat-line, .ref-stat-line-halo').remove()
}

export function removeDistReferenceLines(parent: SVGGElement) {
  removeReferenceStatLine(parent)
  d3.select(parent)
    .selectAll(
      '.dist-zero-line, .dist-zero-line-halo, .dist-pop-stat-line, .dist-pop-stat-line-halo',
    )
    .remove()
}
