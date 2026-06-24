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
import {
  computeGroupBands,
  groupStatsFromPopulation,
  heapYByGroup,
  populationGrandStat,
  type GroupBand,
} from '../d3/groupLayout'
import {
  appendPopulationDeviationArrows,
  appendPopulationDifferenceArrow,
} from '../d3/sampleStatSummary'
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
  numCatMode: boolean
  groupBands: GroupBand[]
  populationGroup: number[]
  nGroups: number
  statistic: 'mean' | 'median'
  statKind: string
  grandMean: number
}

type ThreePaneDisplayProps = {
  population: number[]
  populationGroup: number[]
  groupLevels: string[]
  groupStats: number[]
  nGroups: number
  statKind: string
  statistic: string
  populationStat: number | undefined
  showPopulationStat: boolean
  scales: {
    pop?: Float64Array | number[]
    sample?: Float64Array | number[]
    dist?: Float64Array | number[]
  } | undefined
}

const PANE_LABELS = ['Data', 'Sample', 'Sampling Distribution'] as const

function drawGroupBandGuides(
  parent: SVGGElement,
  bands: GroupBand[],
  innerWidth: number,
  classPrefix: string,
) {
  const g = d3.select(parent)
  g.selectAll(`.${classPrefix}-band-line`).remove()
  g.selectAll(`.${classPrefix}-band-label`).remove()

  for (const band of bands) {
    if (band.index > 0) {
      g.append('line')
        .attr('class', `${classPrefix}-band-line`)
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', band.top)
        .attr('y2', band.top)
        .attr('stroke', '#d1d5db')
        .attr('stroke-width', 1)
    }

    g.append('text')
      .attr('class', `${classPrefix}-band-label`)
      .attr('x', 4)
      .attr('y', band.top + 12)
      .attr('text-anchor', 'start')
      .attr('font-size', 9)
      .attr('fill', band.color)
      .attr('font-weight', 600)
      .text(band.label)
  }
}

function drawPopulationGrouped(
  g: SVGGElement,
  population: number[],
  populationGroup: number[],
  bands: GroupBand[],
  groupStats: number[],
  grandMean: number,
  statKind: string,
  popX: d3.ScaleLinear<number, number>,
  popY: number[],
  showStats: boolean,
  innerWidth: number,
  innerHeight: number,
) {
  const sel = d3.select(g)
  sel.selectAll('.pop-dot').remove()
  sel.selectAll('.pop-stat-line').remove()
  sel.selectAll('.pop-grand-mean').remove()
  sel.selectAll('.pop-boxplot').remove()
  sel.selectAll('.pop-dev-arrow').remove()
  sel.selectAll('.pop-diff-arrow').remove()

  sel
    .selectAll<SVGCircleElement, number>('.pop-dot')
    .data(population, (_, i) => i)
    .join('circle')
    .attr('class', 'pop-dot')
    .attr('cx', (d) => popX(d)!)
    .attr('cy', (_, i) => popY[i] ?? bands[0]?.baselineY ?? 0)
    .attr('r', DOT_RADIUS)
    .attr('fill', (_, i) => bands[populationGroup[i] ?? 0]?.color ?? '#64748b')
    .attr('fill-opacity', 0.65)

  if (showStats) {
    for (const band of bands) {
      const stat = groupStats[band.index]
      if (stat == null || !Number.isFinite(stat)) continue
      sel
        .append('line')
        .attr('class', 'pop-stat-line')
        .attr('data-group', band.index)
        .attr('x1', popX(stat)!)
        .attr('x2', popX(stat)!)
        .attr('y1', band.top + 4)
        .attr('y2', band.top + band.dotAreaHeight)
        .attr('stroke', band.color)
        .attr('stroke-width', 2.5)
    }

    if (statKind === 'average_deviation' && Number.isFinite(grandMean)) {
      sel
        .append('line')
        .attr('class', 'pop-grand-mean')
        .attr('x1', popX(grandMean)!)
        .attr('x2', popX(grandMean)!)
        .attr('y1', 0)
        .attr('y2', bands[bands.length - 1]!.top + bands[bands.length - 1]!.height)
        .attr('stroke', '#111827')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '5,3')

      appendPopulationDeviationArrows(g, popX, groupStats, grandMean, bands)
    }

    if (
      (statKind === 'difference' || groupStats.length === 2) &&
      groupStats.length >= 2
    ) {
      appendPopulationDifferenceArrow(g, popX, groupStats, innerHeight)
    }
  }

  for (const band of bands) {
    const values = population.filter((_, i) => populationGroup[i] === band.index)
    drawHorizontalBoxplot(
      g,
      values,
      popX,
      band.boxTop + DOT_RADIUS,
      band.boxAreaHeight - DOT_RADIUS * 2,
      `pop-boxplot-${band.index}`,
    )
  }

  drawGroupBandGuides(g, bands, innerWidth, 'pop')
}

function drawPopulationOneNum(
  g: SVGGElement,
  population: number[],
  populationStat: number | undefined,
  showPopulationStat: boolean,
  popX: d3.ScaleLinear<number, number>,
  popY: number[],
  dotAreaHeight: number,
  boxTop: number,
  boxAreaHeight: number,
  baselineY: number,
) {
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
}

export const ThreePaneDisplay = forwardRef<ThreePaneHandle, ThreePaneDisplayProps>(
  function ThreePaneDisplay(
    {
      population,
      populationGroup,
      groupLevels,
      groupStats,
      nGroups,
      statKind,
      statistic,
      populationStat,
      showPopulationStat,
      scales,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const popGroupRef = useRef<SVGGElement>(null)
    const sampleGroupRef = useRef<SVGGElement>(null)
    const distGroupRef = useRef<SVGGElement>(null)
    const flyGroupRef = useRef<SVGGElement>(null)
    const axisRefs = useRef<(SVGGElement | null)[]>([null, null, null])
    const [size, setSize] = useState({ width: 720, height: 540 })

    const stat = statistic === 'median' ? 'median' : 'mean'
    const numCatMode = nGroups >= 2 && groupLevels.length >= 2

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

    const groupBands = useMemo(
      () => (numCatMode ? computeGroupBands(innerHeight, groupLevels) : []),
      [numCatMode, innerHeight, groupLevels],
    )

    const resolvedGroupStats = useMemo(() => {
      if (!numCatMode) return []
      if (groupStats.length >= nGroups) return groupStats.slice(0, nGroups)
      return groupStatsFromPopulation(population, populationGroup, nGroups, stat)
    }, [numCatMode, groupStats, nGroups, population, populationGroup, stat])

    const grandMean = useMemo(
      () => (numCatMode ? populationGrandStat(population, stat) : 0),
      [numCatMode, population, stat],
    )

    const popY = useMemo(() => {
      if (population.length === 0) return []
      if (numCatMode) {
        return heapYByGroup(population, populationGroup, popX, groupBands)
      }
      return heapYValues(population, popX, baselineY, DOT_RADIUS)
    }, [population, populationGroup, popX, baselineY, numCatMode, groupBands])

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
        numCatMode,
        groupBands,
        populationGroup,
        nGroups,
        statistic: stat,
        statKind,
        grandMean,
      }),
      [
        popX,
        sampleX,
        distX,
        popY,
        innerHeight,
        dotAreaHeight,
        boxTop,
        boxAreaHeight,
        baselineY,
        distBaselineY,
        paneLayout,
        numCatMode,
        groupBands,
        populationGroup,
        nGroups,
        stat,
        statKind,
        grandMean,
      ],
    )

    useEffect(() => {
      const g = popGroupRef.current
      if (!g) return

      d3.select(g).selectAll('.pop-band-line, .pop-band-label').remove()

      if (numCatMode) {
        drawPopulationGrouped(
          g,
          population,
          populationGroup,
          groupBands,
          resolvedGroupStats,
          grandMean,
          statKind,
          popX,
          popY,
          showPopulationStat,
          innerWidth,
          innerHeight,
        )
      } else {
        drawPopulationOneNum(
          g,
          population,
          populationStat,
          showPopulationStat,
          popX,
          popY,
          dotAreaHeight,
          boxTop,
          boxAreaHeight,
          baselineY,
        )
      }
    }, [
      population,
      populationGroup,
      groupBands,
      resolvedGroupStats,
      grandMean,
      statKind,
      numCatMode,
      popX,
      popY,
      dotAreaHeight,
      boxTop,
      boxAreaHeight,
      baselineY,
      showPopulationStat,
      populationStat,
      innerWidth,
      innerHeight,
    ])

    useEffect(() => {
      const g = distGroupRef.current
      if (!g) return
      d3.select(g).selectAll('.dist-pop-stat-line').remove()
      if (
        showPopulationStat &&
        populationStat != null &&
        Number.isFinite(populationStat) &&
        numCatMode
      ) {
        d3.select(g)
          .append('line')
          .attr('class', 'dist-pop-stat-line')
          .attr('x1', distX(populationStat)!)
          .attr('x2', distX(populationStat)!)
          .attr('y1', 4)
          .attr('y2', innerHeight - 4)
          .attr('stroke', '#7c3aed')
          .attr('stroke-width', 2.5)
      }
    }, [
      showPopulationStat,
      populationStat,
      numCatMode,
      distX,
      innerHeight,
    ])

    useEffect(() => {
      const g = sampleGroupRef.current
      if (!g || !numCatMode) return
      drawGroupBandGuides(g, groupBands, innerWidth, 'sample')
    }, [numCatMode, groupBands, innerWidth])

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
