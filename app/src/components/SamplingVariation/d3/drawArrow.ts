import * as d3 from 'd3'

export type HorizontalArrowHandle = {
  g: d3.Selection<SVGGElement, unknown, null, undefined>
  setGeometry: (fromX: number, toX: number, y: number) => void
}

/** Minimum horizontal span so tiny differences stay visible on screen. */
const MIN_ARROW_SPAN_PX = 14
const MIN_HEAD_PX = 5
const MAX_HEAD_PX = 8

function headSizeForSpan(span: number, headSize = MAX_HEAD_PX, squeeze = false): number {
  const abs = Math.abs(span)
  if (abs < 0.5) return 0
  if (squeeze) {
    return Math.max(3, Math.min(7, abs * 0.55))
  }
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
  options?: { minSpan?: number },
): d3.Selection<SVGGElement, unknown, null, undefined> {
  const minSpan = options?.minSpan ?? MIN_ARROW_SPAN_PX
  const squeeze = minSpan === 0
  const g = parent.append('g').attr('class', 'horizontal-arrow')
  const expanded = expandArrowEndpoints(fromX, toX, minSpan)
  const diff = expanded.toX - expanded.fromX
  if (!Number.isFinite(expanded.fromX) || !Number.isFinite(expanded.toX) || Math.abs(diff) < 0.5) {
    return g
  }

  const size = headSizeForSpan(diff, headSize, squeeze)
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

/** Plain horizontal segment (no arrowhead). */
export function drawHorizontalLine(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  fromX: number,
  toX: number,
  y: number,
  color: string,
  opacity = 1,
  options?: { minSpan?: number },
): d3.Selection<SVGLineElement, unknown, null, undefined> {
  const minSpan = options?.minSpan ?? MIN_ARROW_SPAN_PX
  const expanded = expandArrowEndpoints(fromX, toX, minSpan)
  const line = parent
    .append('line')
    .attr('x1', expanded.fromX)
    .attr('x2', expanded.toX)
    .attr('y1', y)
    .attr('y2', y)
  applyArrowStroke(line, color, opacity)
  return line
}

export function transitionHorizontalLine(
  line: d3.Selection<SVGLineElement, unknown, null, undefined>,
  x1: number,
  x2: number,
  y: number,
  endX1: number,
  endX2: number,
  endY: number,
  duration: number,
): Promise<void> {
  line.attr('x1', x1).attr('x2', x2).attr('y1', y).attr('y2', y)

  if (duration <= 0 || line.empty()) {
    line.attr('x1', endX1).attr('x2', endX2).attr('y1', endY).attr('y2', endY)
    return Promise.resolve()
  }

  return line
    .transition()
    .duration(duration)
    .attr('x1', endX1)
    .attr('x2', endX2)
    .attr('y1', endY)
    .attr('y2', endY)
    .end()
    .then(() => undefined)
}

/** Move a set of horizontal lines down by the same amount in one step. */
export function transitionHorizontalLinesByDy(
  lines: d3.Selection<SVGLineElement, unknown, null, undefined>,
  dy: number,
  duration: number,
): Promise<void> {
  if (lines.empty() || dy === 0) return Promise.resolve()

  if (duration <= 0) {
    lines.each(function () {
      const y = Number(d3.select(this).attr('y1'))
      d3.select(this).attr('y1', y + dy).attr('y2', y + dy)
    })
    return Promise.resolve()
  }

  const transitions = lines.nodes().map((node) => {
    const sel = d3.select(node)
    const y = Number(sel.attr('y1'))
    return sel
      .transition()
      .duration(duration)
      .attr('y1', y + dy)
      .attr('y2', y + dy)
      .end()
  })
  return Promise.all(transitions).then(() => undefined)
}

/** Animate horizontal line to new x endpoints and y (reads current attrs as start). */
export function transitionHorizontalLineTo(
  line: d3.Selection<SVGLineElement, unknown, null, undefined>,
  endX1: number,
  endX2: number,
  endY: number,
  duration: number,
): Promise<void> {
  if (line.empty()) return Promise.resolve()

  if (duration <= 0) {
    line.attr('x1', endX1).attr('x2', endX2).attr('y1', endY).attr('y2', endY)
    return Promise.resolve()
  }

  return line
    .transition()
    .duration(duration)
    .attr('x1', endX1)
    .attr('x2', endX2)
    .attr('y1', endY)
    .attr('y2', endY)
    .end()
    .then(() => undefined)
}

export function transitionHorizontalLinesTo(
  lines: d3.Selection<SVGLineElement, unknown, null, undefined>,
  endForLine: (line: SVGLineElement) => { x1: number; x2: number; y: number },
  duration: number,
): Promise<void> {
  if (lines.empty()) return Promise.resolve()
  const transitions = lines.nodes().map((node) =>
    transitionHorizontalLineTo(
      d3.select(node),
      endForLine(node).x1,
      endForLine(node).x2,
      endForLine(node).y,
      duration,
    ),
  )
  return Promise.all(transitions).then(() => undefined)
}

export function createHorizontalArrow(
  parent: d3.Selection<SVGGElement, unknown, null, undefined>,
  color: string,
  opacity = 1,
  headSize = MAX_HEAD_PX,
  options?: { minSpan?: number },
): HorizontalArrowHandle {
  const minSpan = options?.minSpan ?? MIN_ARROW_SPAN_PX
  const squeeze = minSpan === 0
  const g = parent.append('g').attr('class', 'horizontal-arrow')

  applyArrowStroke(
    g.append('line').attr('class', 'arrow-shaft'),
    color,
    opacity,
  )
  applyArrowStroke(
    g.append('line').attr('class', 'arrow-head arrow-head-a'),
    color,
    opacity,
  )
  applyArrowStroke(
    g.append('line').attr('class', 'arrow-head arrow-head-b'),
    color,
    opacity,
  )

  const setGeometry = (fromX: number, toX: number, y: number) => {
    const expanded = expandArrowEndpoints(fromX, toX, minSpan)
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

    const size = headSizeForSpan(diff, headSize, squeeze)
    const dir = diff > 0 ? 1 : -1

    shaft
      .attr('x1', expanded.fromX)
      .attr('x2', expanded.toX)
      .attr('y1', y)
      .attr('y2', y)
      .attr('opacity', opacity)
    applyArrowStroke(shaft, color, opacity)

    headA
      .attr('x1', expanded.toX)
      .attr('x2', expanded.toX - dir * size)
      .attr('y1', y)
      .attr('y2', y + size / 2)
      .attr('opacity', opacity)
    applyArrowStroke(headA, color, opacity)

    headB
      .attr('x1', expanded.toX)
      .attr('x2', expanded.toX - dir * size)
      .attr('y1', y)
      .attr('y2', y - size / 2)
      .attr('opacity', opacity)
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

  if (shaft.empty()) return Promise.resolve()

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
  ease?: (t: number) => number,
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

  let t = line.transition().duration(duration)
  if (ease) t = t.ease(ease)
  return t
    .attr('x1', endX)
    .attr('x2', endX)
    .attr('y1', endY1)
    .attr('y2', endY2)
    .end()
    .then(() => undefined)
}
