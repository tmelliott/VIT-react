import * as d3 from 'd3'
import { useMemo } from 'react'
import { DOT_RADIUS } from '../d3/heapLayout'
import { statZoneHeight } from '../d3/statMarker'
import { scaleDomain } from '../types'

const MARGIN = { left: 24, right: 24, top: 4, bottom: 4 }
const LABEL_HEIGHT = 20
export const AXIS_HEIGHT = 28
export const BOX_AREA_FRACTION = 0.25

export function paneRegions(
  innerHeight: number,
  radius = DOT_RADIUS,
  options?: { showStatLabel?: boolean; includeBox?: boolean },
) {
  const showStatLabel = options?.showStatLabel ?? false
  const includeBox = options?.includeBox ?? true
  const markerHeight = statZoneHeight(showStatLabel)
  const boxAreaHeight = includeBox
    ? Math.max(28, Math.floor(innerHeight * BOX_AREA_FRACTION))
    : 0
  const dotAreaHeight = innerHeight - boxAreaHeight - markerHeight
  const baselineY = dotAreaHeight - radius
  const statZoneTop = dotAreaHeight
  const boxTop = dotAreaHeight + markerHeight
  const boxCenterY = boxTop + boxAreaHeight / 2
  const distBaselineY = innerHeight - radius
  return {
    dotAreaHeight,
    statZoneTop,
    statZoneHeight: markerHeight,
    showStatLabel,
    boxAreaHeight,
    baselineY,
    boxTop,
    boxCenterY,
    distBaselineY,
    distDotAreaHeight: innerHeight,
  }
}

export function usePaneLayout(
  width: number,
  height: number,
  showStatLabel = false,
) {
  return useMemo(() => {
    const paneHeight = Math.floor(height / 3)
    const innerWidth = width - MARGIN.left - MARGIN.right
    const plotTop = LABEL_HEIGHT + MARGIN.top
    const plotBand = paneHeight - plotTop - MARGIN.bottom
    const innerHeight = plotBand - AXIS_HEIGHT
    const regions = paneRegions(innerHeight, DOT_RADIUS, { showStatLabel })
    return {
      paneHeight,
      innerWidth,
      innerHeight,
      axisHeight: AXIS_HEIGHT,
      plotTop,
      margin: MARGIN,
      ...regions,
    }
  }, [width, height, showStatLabel])
}

export function useSamplingScales(
  popDomain: [number, number],
  distDomain: [number, number],
  innerWidth: number,
  innerHeight: number,
) {
  return useMemo(
    () => ({
      popX: d3.scaleLinear().domain(popDomain).range([0, innerWidth]),
      sampleX: d3.scaleLinear().domain(popDomain).range([0, innerWidth]),
      distX: d3.scaleLinear().domain(distDomain).range([0, innerWidth]),
      innerHeight,
    }),
    [popDomain, distDomain, innerWidth, innerHeight],
  )
}

export function domainsFromState(scales: {
  pop?: Float64Array | number[]
  sample?: Float64Array | number[]
  dist?: Float64Array | number[]
} | undefined) {
  return {
    pop: scaleDomain(scales?.pop),
    sample: scaleDomain(scales?.sample ?? scales?.pop),
    dist: scaleDomain(scales?.dist),
  }
}
