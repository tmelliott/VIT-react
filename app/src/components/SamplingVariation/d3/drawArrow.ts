import * as d3 from 'd3'

export type HorizontalArrowHandle = {
  g: d3.Selection<SVGGElement, unknown, null, undefined>
  setGeometry: (fromX: number, toX: number, y: number) => void
}

/** Minimum horizontal span so tiny differences stay visible on screen. */
const MIN_ARROW_SPAN_PX = 14
const MIN_HEAD_PX = 5
const MAX_HEAD_PX = 8

function headSizeForSpan(span: number, headSize = MAX_HEAD_PX): number {
  const abs = Math.abs(span)
  if (abs < 0.5) return 0
  return Math.max(MIN_HEAD_PX, Math.min(headSize, abs * 0.45))
}

/** Widen sub-pixel/near-zero spans so the arrow shaft and head remain visible. */
export function expandArrowEndpoints(
  fromX: number,
  toX: number,
  minSpan = MIN_ARROW_SPAN_PX,
): { fromX: number; toX: number } {
  if (!Number.isFinite(fromX) || !Number.isFinite(toX)) {
    return { fromX, toX }
  }
  const span = toX - fromX
  if (Math.abs(span) < 0.5) return { fromX, toX }
  if (Math.abs(span) >= minSpan) return { fromX, toX }
  const dir = span > 0 ? 1 : -1
  const mid = (fromX + toX) / 2
  return {
    fromX: mid - (dir * minSpan) / 2,
    toX: mid + (dir * minSpan) / 2,
  }
}

const LINE_ATTRS = {
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
} as const

function applyArrowStroke(
  selection: d3.Selection<SVGLineElement, unknown, null, undefined>,
  color: string,
  opacity: number,
) {
  selection
    .attr('stroke', color)
    .attr('stroke-width', 2)
    .attr('opacity', opacity)
    .attr(LINE_ATTRS)
}

/** Horizontal arrow from `fromX` to `toX` at fixed `y`. */
export function drawHorizontalArrow(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  fromX: number,
  toX: number,
  y: number,
  color: string,
  opacity = 1,
  headSize = MAX_HEAD_PX,
): d3.Selection<SVGGElement, unknown, null, undefined> {
  const g = parent.append('g').attr('class', 'horizontal-arrow')
  const expanded = expandArrowEndpoints(fromX, toX)
  const diff = expanded.toX - expanded.fromX
  if (!Number.isFinite(expanded.fromX) || !Number.isFinite(expanded.toX) || Math.abs(diff) < 0.5) {
    return g
  }

  const size = headSizeForSpan(diff, headSize)
  const dir = diff > 0 ? 1 : -1

  applyArrowStroke(
    g
      .append('line')
      .attr('class', 'arrow-shaft')
      .attr('x1', expanded.fromX)
      .attr('x2', expanded.toX)
      .attr('y1', y)
      .attr('y2', y),
    color,
    opacity,
  )

  applyArrowStroke(
    g
      .append('line')
      .attr('class', 'arrow-head arrow-head-a')
      .attr('x1', expanded.toX)
      .attr('x2', expanded.toX - dir * size)
      .attr('y1', y)
      .attr('y2', y + size / 2),
    color,
    opacity,
  )

  applyArrowStroke(
    g
      .append('line')
      .attr('class', 'arrow-head arrow-head-b')
      .attr('x1', expanded.toX)
      .attr('x2', expanded.toX - dir * size)
      .attr('y1', y)
      .attr('y2', y - size / 2),
    color,
    opacity,
  )

  return g
}

export function createHorizontalArrow(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  color: string,
  opacity = 1,
  headSize = MAX_HEAD_PX,
): HorizontalArrowHandle {
  const setGeometry = (fromX: number, toX: number, y: number) => {
    const expanded = expandArrowEndpoints(fromX, toX)
    const diff = expanded.toX - expanded.fromX
    const shaft = g.select<SVGLineElement>('.arrow-shaft')
    const headA = g.select<SVGLineElement>('.arrow-head-a')
    const headB = g.select<SVGLineElement>('.arrow-head-b')

    if (
      !Number.isFinite(expanded.fromX) ||
      !Number.isFinite(expanded.toX) ||
      Math.abs(diff) < 0.5
    ) {
      shaft.attr('opacity', 0)
      headA.attr('opacity', 0)
      headB.attr('opacity', 0)
      return
    }

    const size = headSizeForSpan(diff, headSize)
    const dir = diff > 0 ? 1 : -1

    shaft
      .attr('x1', expanded.fromX)
      .attr('x2', expanded.toX)
      .attr('y1', y)
      .attr('y2', y)
    applyArrowStroke(shaft, color, opacity)

    headA
      .attr('x1', expanded.toX)
      .attr('x2', expanded.toX - dir * size)
      .attr('y1', y)
      .attr('y2', y + size / 2)
    applyArrowStroke(headA, color, opacity)

    headB
      .attr('x1', expanded.toX)
      .attr('x2', expanded.toX - dir * size)
      .attr('y1', y)
      .attr('y2', y - size / 2)
    applyArrowStroke(headB, color, opacity)
  }

  return { g, setGeometry }
}

export function transitionHorizontalArrow(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  fromX: number,
  toX: number,
  y: number,
  endFromX: number,
  endToX: number,
  endY: number,
  duration: number,
  color = '#374151',
  opacity = 1,
): Promise<void> {
  const shaft = g.select<SVGLineElement>('.arrow-shaft')
  const headA = g.select<SVGLineElement>('.arrow-head-a')
  const headB = g.select<SVGLineElement>('.arrow-head-b')

  const start = expandArrowEndpoints(fromX, toX)
  const end = expandArrowEndpoints(endFromX, endToX)
  const startSpan = start.toX - start.fromX
  const endSpan = end.toX - end.fromX
  const startDir = startSpan >= 0 ? 1 : -1
  const endDir = endSpan >= 0 ? 1 : -1
  const startHead = headSizeForSpan(startSpan)
  const endHead = headSizeForSpan(endSpan)

  applyArrowStroke(shaft, color, opacity)
  applyArrowStroke(headA, color, opacity)
  applyArrowStroke(headB, color, opacity)

  shaft
    .attr('x1', start.fromX)
    .attr('x2', start.toX)
    .attr('y1', y)
    .attr('y2', y)
  headA
    .attr('x1', start.toX)
    .attr('x2', start.toX - startDir * startHead)
    .attr('y1', y)
    .attr('y2', y + startHead / 2)
  headB
    .attr('x1', start.toX)
    .attr('x2', start.toX - startDir * startHead)
    .attr('y1', y)
    .attr('y2', y - startHead / 2)

  if (duration <= 0) {
    shaft
      .attr('x1', end.fromX)
      .attr('x2', end.toX)
      .attr('y1', endY)
      .attr('y2', endY)
    headA
      .attr('x1', end.toX)
      .attr('x2', end.toX - endDir * endHead)
      .attr('y1', endY)
      .attr('y2', endY + endHead / 2)
    headB
      .attr('x1', end.toX)
      .attr('x2', end.toX - endDir * endHead)
      .attr('y1', endY)
      .attr('y2', endY - endHead / 2)
    return Promise.resolve()
  }

  const shaftTween = shaft
    .transition()
    .duration(duration)
    .attr('x1', end.fromX)
    .attr('x2', end.toX)
    .attr('y1', endY)
    .attr('y2', endY)

  const headATween = headA
    .transition()
    .duration(duration)
    .attr('x1', end.toX)
    .attr('x2', end.toX - endDir * endHead)
    .attr('y1', endY)
    .attr('y2', endY + endHead / 2)

  const headBTween = headB
    .transition()
    .duration(duration)
    .attr('x1', end.toX)
    .attr('x2', end.toX - endDir * endHead)
    .attr('y1', endY)
    .attr('y2', endY - endHead / 2)

  return Promise.all([
    shaftTween.end(),
    headATween.end(),
    headBTween.end(),
  ]).then(() => undefined)
}

export function transitionVerticalLine(
  line: d3.Selection<SVGLineElement, unknown, null, undefined>,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  endX: number,
  endY1: number,
  endY2: number,
  duration: number,
): Promise<void> {
  line.attr('x1', x1).attr('x2', x2).attr('y1', y1).attr('y2', y2)

  if (duration <= 0) {
    line
      .attr('x1', endX)
      .attr('x2', endX)
      .attr('y1', endY1)
      .attr('y2', endY2)
    return Promise.resolve()
  }

  return line
    .transition()
    .duration(duration)
    .attr('x1', endX)
    .attr('x2', endX)
    .attr('y1', endY1)
    .attr('y2', endY2)
    .end()
    .then(() => undefined)
}
