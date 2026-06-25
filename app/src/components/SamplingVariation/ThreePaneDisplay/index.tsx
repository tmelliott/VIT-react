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
import {
  POP_DOT_STROKE,
  POP_DOT_STROKE_OPACITY,
  POP_DOT_STROKE_WIDTH,
} from '../d3/paneStyle'
import { drawHorizontalBoxplot } from '../d3/boxplot'
import { drawBottomAxis } from '../d3/drawPaneAxis'
import {
  appendStatMarker,
  removeStatMarkers,
} from '../d3/statMarker'
import {
  computeGroupBands,
  groupStatsFromPopulation,
  heapYByGroup,
  populationGrandStat,
  sampleAvgDevLabelZone,
  samplePaneGroupBands,
  twoGroupDiffZone,
  type GroupBand,
} from '../d3/groupLayout'
import {
  appendPopulationDeviationMarkers,
  appendAverageDeviationLabel,
  appendTwoGroupPopulationDiffDisplay,
} from '../d3/sampleStatSummary'
import {
  drawDistPopulationReferenceLine,
  drawDistTwoGroupReferenceLines,
  drawReferenceStatLine,
  removeDistReferenceLines,
  removeReferenceStatLine,
} from '../d3/referenceLine'
import type { PaneLayout } from '../d3/paneCoords'
import { domainsFromState, usePaneLayout, useSamplingScales } from '../hooks/useSamplingScales'
import {
  effectiveDistDomain,
  distDomainAlignedToPop,
  distDomainCenteredOn,
  effectivePopDomain,
  type VariableSupport,
} from '../variableSupport'
import { PaneHelpModal } from '../PaneHelpModal'
import { paneHelpContent } from '../paneHelpContent'
import type { StatKind } from '../types'

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
  statZoneTop: number
  statZoneHeight: number
  boxTop: number
  boxAreaHeight: number
  baselineY: number
  distBaselineY: number
  dotRadius: number
  numCatMode: boolean
  groupBands: GroupBand[]
  sampleGroupBands: GroupBand[]
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
  showFullPopulation: boolean
  moduleReady: boolean
  variableSupport: VariableSupport
  sampleSize: number
  scales: {
    pop?: Float64Array | number[]
    sample?: Float64Array | number[]
    dist?: Float64Array | number[]
  } | undefined
}

const PANE_LABELS = ['Data', 'Sample', 'Sampling Distribution'] as const

function paneMessage(
  paneIndex: number,
  support: VariableSupport,
  ready: boolean,
): string | null {
  if (support === 'unsupported') return 'Not supported'
  if (support === 'empty') {
    return paneIndex === 0 ? 'Select a primary variable' : null
  }
  if (!ready) {
    if (paneIndex === 0) return null
    return 'Confirm to generate samples'
  }
  return null
}

function drawGroupBandGuides(
  parent: SVGGElement,
  bands: GroupBand[],
  classPrefix: string,
  showLabels = true,
) {
  const g = d3.select(parent)
  g.selectAll(`.${classPrefix}-band-line`).remove()
  g.selectAll(`.${classPrefix}-band-label`).remove()

  for (const band of bands) {
    if (showLabels) {
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
}

function removeGroupedPopulationOverlays(g: SVGGElement) {
  const sel = d3.select(g)
  sel.selectAll('.pop-grand-mean').remove()
  sel.selectAll('.pop-dev-arrow').remove()
  sel.selectAll('.pop-diff-arrow').remove()
  sel.selectAll('.pop-stat-drop-line').remove()
  sel.selectAll('.pop-stat-drop').remove()
  sel.selectAll('.pop-diff-label').remove()
  sel.selectAll('.pop-avg-dev-label').remove()
  sel.selectAll('.pop-stat-vline').remove()
  sel.selectAll('.pop-band-line, .pop-band-label').remove()
}

function drawPopulationGrouped(
  g: SVGGElement,
  population: number[],
  populationGroup: number[],
  bands: GroupBand[],
  groupStats: number[],
  grandMean: number,
  statKind: string,
  statistic: 'mean' | 'median',
  nGroups: number,
  popX: d3.ScaleLinear<number, number>,
  popY: number[],
  showStats: boolean,
  innerWidth: number,
  innerHeight: number,
) {
  const sel = d3.select(g)
  sel.selectAll('.pop-dot').remove()
  removeStatMarkers(g)
  removeGroupedPopulationOverlays(g)
  sel.selectAll('[class^="pop-boxplot"]').remove()

  sel
    .selectAll<SVGCircleElement, number>('.pop-dot')
    .data(population, (_, i) => i)
    .join('circle')
    .attr('class', 'pop-dot')
    .attr('cx', (d) => popX(d)!)
    .attr('cy', (_, i) => popY[i] ?? bands[0]?.baselineY ?? 0)
    .attr('r', DOT_RADIUS)
    .attr('fill', 'none')
    .attr('stroke', (_, i) => bands[populationGroup[i] ?? 0]?.color ?? POP_DOT_STROKE)
    .attr('stroke-width', POP_DOT_STROKE_WIDTH)
    .attr('stroke-opacity', nGroups > 2 ? 0.7 : POP_DOT_STROKE_OPACITY)

  if (showStats) {
    const multiGroupDev = nGroups >= 3 && Number.isFinite(grandMean)

    if (multiGroupDev) {
      const labelZone = sampleAvgDevLabelZone(innerHeight)
      sel
        .append('line')
        .attr('class', 'pop-grand-mean')
        .attr('x1', popX(grandMean)!)
        .attr('x2', popX(grandMean)!)
        .attr('y1', 0)
        .attr('y2', labelZone.top)
        .attr('stroke', '#111827')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '5,3')

      appendPopulationDeviationMarkers(g, popX, groupStats, grandMean, bands)
      appendAverageDeviationLabel(g, innerWidth, labelZone, groupStats, grandMean)
    } else {
      for (const band of bands) {
        const stat = groupStats[band.index]
        if (stat == null || !Number.isFinite(stat)) continue
        appendStatMarker(g, popX(stat)!, band.statZoneTop, stat, {
          color: band.color,
          showLabel: false,
        })
      }

      if (
        nGroups === 2 &&
        (statKind === 'difference' || groupStats.length === 2) &&
        groupStats.length >= 2
      ) {
        appendTwoGroupPopulationDiffDisplay(
          g,
          popX,
          groupStats,
          bands,
          twoGroupDiffZone(innerHeight),
          statistic,
        )
      }
    }
  }

  drawGroupBandGuides(g, bands, 'pop')
}

function drawPopulationOneNum(
  g: SVGGElement,
  population: number[],
  populationStat: number | undefined,
  showPopulationStat: boolean,
  showBoxplot: boolean,
  popX: d3.ScaleLinear<number, number>,
  popY: number[],
  statZoneTop: number,
  boxTop: number,
  boxAreaHeight: number,
  baselineY: number,
  stat: 'mean' | 'median',
) {
  removeGroupedPopulationOverlays(g)
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
    .attr('fill', 'none')
    .attr('stroke', POP_DOT_STROKE)
    .attr('stroke-width', POP_DOT_STROKE_WIDTH)
    .attr('stroke-opacity', POP_DOT_STROKE_OPACITY)

  removeStatMarkers(g)
  d3.select(g).selectAll('[class^="pop-boxplot"]').remove()
  if (showPopulationStat && populationStat != null && Number.isFinite(populationStat)) {
    appendStatMarker(g, popX(populationStat)!, statZoneTop, populationStat, {
      showLabel: true,
      statistic: stat,
    })
  }

  if (showBoxplot) {
    drawHorizontalBoxplot(
      g,
      population,
      popX,
      boxTop + DOT_RADIUS,
      boxAreaHeight - DOT_RADIUS * 2,
      'pop-boxplot',
    )
  }
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
      showFullPopulation,
      moduleReady,
      variableSupport,
      sampleSize,
      scales,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const popGroupRef = useRef<SVGGElement>(null)
    const sampleGroupRef = useRef<SVGGElement>(null)
    const distGroupRef = useRef<SVGGElement>(null)
    const distRefGroupRef = useRef<SVGGElement>(null)
    const flyGroupRef = useRef<SVGGElement>(null)
    const axisRefs = useRef<(SVGGElement | null)[]>([null, null, null])
    const [size, setSize] = useState({ width: 720, height: 540 })

    const stat = statistic === 'median' ? 'median' : 'mean'
    const numCatMode =
      variableSupport === 'num_cat' && nGroups >= 2 && groupLevels.length >= 2
    const showData =
      variableSupport === 'one_num' || variableSupport === 'num_cat'
    const popDomain = effectivePopDomain(population, scales?.pop)
    const rawDistDomain = effectiveDistDomain([], scales?.dist)
    const popAlignedDist =
      numCatMode && statKind === 'average_deviation' && nGroups >= 3
    const distDomainTwoGroup =
      numCatMode && nGroups === 2 && populationStat != null && Number.isFinite(populationStat)
        ? distDomainCenteredOn(popDomain, populationStat)
        : null
    const distDomain = popAlignedDist
      ? distDomainAlignedToPop(popDomain)
      : distDomainTwoGroup ?? rawDistDomain

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
      statZoneTop,
      statZoneHeight,
      boxTop,
      boxAreaHeight,
      baselineY,
      distBaselineY,
    } = usePaneLayout(size.width, size.height, !numCatMode)
    const domains = domainsFromState(scales)
    const activeDistDomain =
      variableSupport === 'one_num'
        ? popDomain
        : popAlignedDist
          ? distDomainAlignedToPop(popDomain)
          : distDomainTwoGroup ??
            (moduleReady ? domains.dist : distDomain)
    const { popX, sampleX, distX } = useSamplingScales(
      popDomain,
      activeDistDomain,
      innerWidth,
      innerHeight,
    )

    const groupBands = useMemo(
      () =>
        numCatMode ? computeGroupBands(innerHeight, groupLevels) : [],
      [numCatMode, innerHeight, groupLevels],
    )

    const sampleGroupBands = useMemo(
      () =>
        numCatMode
          ? samplePaneGroupBands(innerHeight, groupLevels, nGroups)
          : [],
      [numCatMode, innerHeight, groupLevels, nGroups],
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
        statZoneTop,
        statZoneHeight,
        boxTop,
        boxAreaHeight,
        baselineY,
        distBaselineY,
        dotRadius: DOT_RADIUS,
        numCatMode,
        groupBands,
        sampleGroupBands,
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
        statZoneTop,
        statZoneHeight,
        boxTop,
        boxAreaHeight,
        baselineY,
        distBaselineY,
        paneLayout,
        numCatMode,
        groupBands,
        sampleGroupBands,
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

      if (!showData || population.length === 0 || innerWidth <= 0) {
        d3.select(g).selectAll('*').remove()
        return
      }

      if (numCatMode) {
        drawPopulationGrouped(
          g,
          population,
          populationGroup,
          groupBands,
          resolvedGroupStats,
          grandMean,
          statKind,
          stat,
          nGroups,
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
          showFullPopulation,
          popX,
          popY,
          statZoneTop,
          boxTop,
          boxAreaHeight,
          baselineY,
          stat,
        )
      }
    }, [
      showData,
      population,
      populationGroup,
      groupBands,
      resolvedGroupStats,
      grandMean,
      statKind,
      stat,
      nGroups,
      numCatMode,
      popX,
      popY,
      statZoneTop,
      dotAreaHeight,
      boxTop,
      boxAreaHeight,
      baselineY,
      showPopulationStat,
      showFullPopulation,
      populationStat,
      stat,
      innerWidth,
      innerHeight,
    ])

    useEffect(() => {
      const sampleG = sampleGroupRef.current
      const distG = distGroupRef.current
      const distRefG = distRefGroupRef.current
      if (!sampleG || !distG) return
      if (moduleReady) return
      d3.select(sampleG).selectAll('*').remove()
      d3.select(distG).selectAll('*').remove()
      if (distRefG) d3.select(distRefG).selectAll('*').remove()
    }, [moduleReady, numCatMode, groupBands, innerWidth])

    useEffect(() => {
      const g = distRefGroupRef.current
      if (!g) return
      removeDistReferenceLines(g)
      if (!moduleReady) {
        return
      }
      if (numCatMode && nGroups === 2) {
        drawDistTwoGroupReferenceLines(g, distX, populationStat ?? NaN, innerHeight)
        return
      }
      if (
        !showPopulationStat ||
        populationStat == null ||
        !Number.isFinite(populationStat)
      ) {
        return
      }
      drawDistPopulationReferenceLine(g, distX, populationStat, innerHeight)
    }, [
      moduleReady,
      showPopulationStat,
      populationStat,
      distX,
      innerHeight,
      numCatMode,
      nGroups,
    ])

    useEffect(() => {
      const g = sampleGroupRef.current
      if (!g) return
      removeReferenceStatLine(g)
      if (
        !moduleReady ||
        variableSupport !== 'one_num' ||
        !showPopulationStat ||
        populationStat == null ||
        !Number.isFinite(populationStat)
      ) {
        return
      }
      drawReferenceStatLine(g, sampleX, populationStat, innerHeight)
    }, [
      moduleReady,
      variableSupport,
      showPopulationStat,
      populationStat,
      sampleX,
      innerHeight,
    ])

    useEffect(() => {
      const axes = axisRefs.current
      if (axes[0]) drawBottomAxis(axes[0], popX, innerWidth)
      if (axes[1]) drawBottomAxis(axes[1], sampleX, innerWidth)
      if (axes[2]) drawBottomAxis(axes[2], distX, innerWidth)
    }, [popX, sampleX, distX, innerWidth])

    const helpStatKind = (statKind || '') as StatKind

    return (
      <div ref={containerRef} className="relative h-full w-full rounded border border-gray-300 bg-white">
        {PANE_LABELS.map((label, paneIndex) => {
          const help = paneHelpContent({
            paneIndex: paneIndex as 0 | 1 | 2,
            variableSupport,
            statistic: stat,
            nGroups,
            statKind: helpStatKind,
            sampleSize,
          })
          return (
            <PaneHelpModal
              key={`help-${label}`}
              paneLabel={label}
              summary={help.summary}
              details={help.details}
              style={{
                top: paneIndex * paneHeight + 6,
                right: margin.right,
              }}
            />
          )
        })}
        <svg width={size.width} height={size.height} className="block overflow-hidden">
          {PANE_LABELS.map((label, paneIndex) => {
            const yOffset = paneIndex * paneHeight
            const clipId = `pane-clip-${paneIndex}`
            const message = paneMessage(paneIndex, variableSupport, moduleReady)
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
                  {message && (
                    <text
                      x={innerWidth / 2}
                      y={innerHeight / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-gray-400 text-sm"
                    >
                      {message}
                    </text>
                  )}
                  <g clipPath={`url(#${clipId})`}>
                    {paneIndex === 0 && (
                      <g ref={popGroupRef} transform="translate(0, 0)" />
                    )}
                    {paneIndex === 1 && (
                      <g ref={sampleGroupRef} transform="translate(0, 0)" />
                    )}
                    {paneIndex === 2 && (
                      <>
                        <g ref={distGroupRef} transform="translate(0, 0)" />
                        <g
                          ref={distRefGroupRef}
                          className="dist-ref-layer"
                          transform="translate(0, 0)"
                        />
                      </>
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
