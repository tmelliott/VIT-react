import * as d3 from 'd3'

/** How population (P1) data is shown relative to sample highlights. */
export type PopulationVisibility = 'show' | 'fuzz' | 'hide'

export const POPULATION_VISIBILITY_OPTIONS: {
  value: PopulationVisibility
  label: string
}[] = [
  { value: 'show', label: 'Show' },
  { value: 'fuzz', label: 'Fuzz' },
  { value: 'hide', label: 'Hide' },
]

/** CSS blur applied to the population underlay in fuzz mode. */
export const POP_FUZZ_BLUR_PX = 10
/** Light wash over blurred population (under sample highlights). */
export const POP_FUZZ_VEIL_OPACITY = 0.28

/**
 * Ensure popGroup has underlay → optional veil → highlight stacking.
 * Population drawing goes in the underlay; sample highlights stay above the veil.
 */
export function ensurePopLayers(popGroup: SVGGElement): {
  underlay: SVGGElement
  highlight: SVGGElement
} {
  const root = d3.select(popGroup)

  let underlay = root.select<SVGGElement>('.pop-underlay')
  if (underlay.empty()) {
    underlay = root.append('g').attr('class', 'pop-underlay')
  }

  let veil = root.select<SVGRectElement>('.pop-fuzz-veil')
  if (veil.empty()) {
    veil = root
      .append('rect')
      .attr('class', 'pop-fuzz-veil')
      .attr('x', 0)
      .attr('y', 0)
      .attr('pointer-events', 'none')
      .attr('visibility', 'hidden')
  }

  let highlight = root.select<SVGGElement>('.pop-highlight-layer')
  if (highlight.empty()) {
    highlight = root.append('g').attr('class', 'pop-highlight-layer')
  }

  const underlayNode = underlay.node()!
  const veilNode = veil.node()!
  const highlightNode = highlight.node()!

  // Enforce paint order: underlay (blurred) → veil → highlights (sharp).
  popGroup.appendChild(underlayNode)
  popGroup.appendChild(veilNode)
  popGroup.appendChild(highlightNode)

  return { underlay: underlayNode, highlight: highlightNode }
}

/** Clear underlay drawing without removing the highlight / veil siblings. */
export function clearPopUnderlay(popGroup: SVGGElement): SVGGElement {
  const { underlay } = ensurePopLayers(popGroup)
  d3.select(underlay).selectAll('*').remove()
  return underlay
}

/**
 * Apply show / fuzz / hide to the population underlay.
 * Sample highlights in `.pop-highlight-layer` are never blurred or hidden here.
 */
export function applyPopulationVisibility(
  popGroup: SVGGElement,
  mode: PopulationVisibility,
  plotSize: { width: number; height: number },
): void {
  const { underlay } = ensurePopLayers(popGroup)
  const underlaySel = d3.select(underlay)
  const veil = d3.select(popGroup).select<SVGRectElement>('.pop-fuzz-veil')

  veil
    .attr('width', Math.max(0, plotSize.width))
    .attr('height', Math.max(0, plotSize.height))

  if (mode === 'hide') {
    underlaySel.style('visibility', 'hidden').style('filter', null)
    veil.attr('visibility', 'hidden').attr('fill-opacity', 0)
    return
  }

  underlaySel.style('visibility', 'visible')

  if (mode === 'fuzz') {
    underlaySel.style('filter', `blur(${POP_FUZZ_BLUR_PX}px)`)
    veil
      .attr('visibility', 'visible')
      .attr('fill', '#ffffff')
      .attr('fill-opacity', POP_FUZZ_VEIL_OPACITY)
    return
  }

  underlaySel.style('filter', null)
  veil.attr('visibility', 'hidden').attr('fill-opacity', 0)
}

/** Population dots stay outline-only in every visibility mode. */
export function popDotsFilled(_mode: PopulationVisibility): boolean {
  return false
}
