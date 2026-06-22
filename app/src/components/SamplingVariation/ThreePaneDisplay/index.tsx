import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as d3 from 'd3'
import { DOT_RADIUS, heapYValues } from '../d3/heapLayout'
import { drawHorizontalBoxplot } from '../d3/boxplot'
import { drawBottomAxis } from '../d3/drawPaneAxis'
import type { PaneLayout } from '../d3/paneCoords'
import { domainsFromState, usePaneLayout, useSamplingScales } from '../hooks/useSamplingScales'

export type ThreePaneHandle = {
  popGroup: SVGGElement
  sampleGroup: SVGGElement
  distGroup: SVGGElement
  flyGroup: SVGGElement
  paneLayout: PaneLayout
  popX: d3.ScaleLinear<number, number>
  sampleX: d3.ScaleLinear<number, number>
  distX: d3.ScaleLinear<number, number>
  popY: number[]
  paneInnerHeight: number
  dotAreaHeight: number
  boxTop: number
  boxAreaHeight: number
  baselineY: number
  distBaselineY: number
  dotRadius: number
}

type ThreePaneDisplayProps = {
  population: number[]
  populationStat: number | undefined
  showPopulationStat: boolean
  scales: {
    pop?: Float64Array | number[]
    sample?: Float64Array | number[]
    dist?: Float64Array | number[]
  } | undefined
}

const PANE_LABELS = ['Data', 'Sample', 'Sampling Distribution'] as const

export const ThreePaneDisplay = forwardRef<ThreePaneHandle, ThreePaneDisplayProps>(
  function ThreePaneDisplay(
    { population, populationStat, showPopulationStat, scales },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const popGroupRef = useRef<SVGGElement>(null)
    const sampleGroupRef = useRef<SVGGElement>(null)
    const distGroupRef = useRef<SVGGElement>(null)
    const flyGroupRef = useRef<SVGGElement>(null)
    const axisRefs = useRef<(SVGGElement | null)[]>([null, null, null])
    const [size, setSize] = useState({ width: 720, height: 540 })

    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const ro = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) setSize({ width, height })
      })
      ro.observe(el)
      return () => ro.disconnect()
    }, [])

    const {
      paneHeight,
      innerWidth,
      innerHeight,
      plotTop,
      margin,
      dotAreaHeight,
      boxTop,
      boxAreaHeight,
      baselineY,
      distBaselineY,
    } = usePaneLayout(size.width, size.height)
    const domains = domainsFromState(scales)
    const { popX, sampleX, distX } = useSamplingScales(
      domains.pop,
      domains.dist,
      innerWidth,
      innerHeight,
    )

    const popY = useMemo(() => {
      if (population.length === 0) return []
      return heapYValues(population, popX, baselineY, DOT_RADIUS)
    }, [population, popX, baselineY])

    const paneLayout = useMemo<PaneLayout>(
      () => ({
        marginLeft: margin.left,
        plotTop,
        paneHeight,
        innerWidth,
      }),
      [margin.left, plotTop, paneHeight, innerWidth],
    )

    useImperativeHandle(
      ref,
      () => ({
        popGroup: popGroupRef.current!,
        sampleGroup: sampleGroupRef.current!,
        distGroup: distGroupRef.current!,
        flyGroup: flyGroupRef.current!,
        paneLayout,
        popX,
        sampleX,
        distX,
        popY,
        paneInnerHeight: innerHeight,
        dotAreaHeight,
        boxTop,
        boxAreaHeight,
        baselineY,
        distBaselineY,
        dotRadius: DOT_RADIUS,
      }),
      [popX, sampleX, distX, popY, innerHeight, dotAreaHeight, boxTop, boxAreaHeight, baselineY, distBaselineY, paneLayout],
    )

    useEffect(() => {
      const g = popGroupRef.current
      if (!g) return
      const sel = d3
        .select(g)
        .selectAll<SVGCircleElement, number>('.pop-dot')
        .data(population, (_, i) => i)

      sel
        .join('circle')
        .attr('class', 'pop-dot')
        .attr('cx', (d) => popX(d)!)
        .attr('cy', (_, i) => popY[i] ?? baselineY)
        .attr('r', DOT_RADIUS)
        .attr('fill', '#64748b')
        .attr('fill-opacity', 0.55)

      d3.select(g).selectAll('.pop-stat-line').remove()
      if (showPopulationStat && populationStat != null && Number.isFinite(populationStat)) {
        d3.select(g)
          .append('line')
          .attr('class', 'pop-stat-line')
          .attr('x1', popX(populationStat)!)
          .attr('x2', popX(populationStat)!)
          .attr('y1', 4)
          .attr('y2', dotAreaHeight)
          .attr('stroke', '#7c3aed')
          .attr('stroke-width', 2.5)
      }

      drawHorizontalBoxplot(
        g,
        population,
        popX,
        boxTop + DOT_RADIUS,
        boxAreaHeight - DOT_RADIUS * 2,
        'pop-boxplot',
      )
    }, [
      population,
      popX,
      popY,
      dotAreaHeight,
      boxTop,
      boxAreaHeight,
      baselineY,
      showPopulationStat,
      populationStat,
    ])

    useEffect(() => {
      const axes = axisRefs.current
      if (axes[0]) drawBottomAxis(axes[0], popX, innerWidth)
      if (axes[1]) drawBottomAxis(axes[1], sampleX, innerWidth)
      if (axes[2]) drawBottomAxis(axes[2], distX, innerWidth)
    }, [popX, sampleX, distX, innerWidth])

    return (
      <div ref={containerRef} className="h-full w-full rounded border border-gray-300 bg-white">
        <svg width={size.width} height={size.height} className="block overflow-hidden">
          {PANE_LABELS.map((label, paneIndex) => {
            const yOffset = paneIndex * paneHeight
            const clipId = `pane-clip-${paneIndex}`
            return (
              <g key={label} transform={`translate(0, ${yOffset})`}>
                <text
                  x={margin.left}
                  y={16}
                  className="text-xs font-semibold fill-gray-700"
                >
                  {label}
                </text>
                <line
                  x1={0}
                  y1={paneHeight - 1}
                  x2={size.width}
                  y2={paneHeight - 1}
                  stroke="#e5e7eb"
                />
                <g transform={`translate(${margin.left}, ${plotTop})`}>
                  <defs>
                    <clipPath id={clipId}>
                      <rect x={0} y={0} width={innerWidth} height={innerHeight} />
                    </clipPath>
                  </defs>
                  <g clipPath={`url(#${clipId})`}>
                    {paneIndex === 0 && (
                      <g ref={popGroupRef} transform="translate(0, 0)" />
                    )}
                    {paneIndex === 1 && (
                      <g ref={sampleGroupRef} transform="translate(0, 0)" />
                    )}
                    {paneIndex === 2 && (
                      <g ref={distGroupRef} transform="translate(0, 0)" />
                    )}
                  </g>
                  <g
                    ref={(el) => {
                      axisRefs.current[paneIndex] = el
                    }}
                    className="pane-x-axis"
                    transform={`translate(0, ${innerHeight})`}
                  />
                </g>
              </g>
            )
          })}
          <g ref={flyGroupRef} className="fly-layer" pointerEvents="none" />
        </svg>
      </div>
    )
  },
)
