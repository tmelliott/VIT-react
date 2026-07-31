import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as d3 from 'd3'
import { drawBottomAxis } from '../d3/drawPaneAxis'
import {
  drawHybridProportionChart,
  drawMultiGroupProportionBars,
  removeProportionBar,
} from '../d3/proportionBar'
import {
  drawDistPopulationReferenceLine,
  drawDistTwoGroupReferenceLines,
  removeDistReferenceLines,
} from '../d3/referenceLine'
import type { PaneLayout } from '../d3/paneCoords'
import { domainsFromState, paneRegions, usePaneLayout, useSamplingScales } from '../hooks/useSamplingScales'
import { DOT_RADIUS } from '../d3/heapLayout'
import { computeSampleMultiGroupBands, computeSampleTwoGroupBands, type GroupBand } from '../d3/groupLayout'
import {
  effectiveDistDomain,
  effectivePopDomain,
  distDomainCenteredOn,
  distDomainAlignedToPop,
  isProportionMode,
  type VariableSupport,
} from '../variableSupport'
import { PaneHelpModal } from '../PaneHelpModal'
import { PopulationVisibilityControl } from '../PopulationVisibilityControl'
import { paneHelpContent } from '../paneHelpContent'
import type { StatKind } from '../types'
import { distBaselineValue } from '../statistics'
import { proportionFromEncoded } from '../d3/proportionLayout'
import {
  applyPopulationVisibility,
  clearPopUnderlay,
  popDotsFilled,
  type PopulationVisibility,
} from '../d3/populationVisibility'

export type ProportionThreePaneHandle = {
  popGroup: SVGGElement
  sampleGroup: SVGGElement
  distGroup: SVGGElement
  flyGroup: SVGGElement
  paneLayout: PaneLayout
  popX: d3.ScaleLinear<number, number>
  sampleX: d3.ScaleLinear<number, number>
  distX: d3.ScaleLinear<number, number>
  proportionMode: true
  variableSupport: 'one_cat' | 'two_cat'
  nGroups: number
  statKind: string
  populationCategory: number[]
  populationGroup: number[]
  groupLevels: string[]
  groupStats: number[]
  categoryLabels: [string, string]
  /** Overall focus proportion (centre for k≥3 average deviation). */
  populationGrandProp: number
  /** P2 band geometry for two_cat (empty for one_cat). */
  sampleGroupBands: GroupBand[]
  innerWidth: number
  innerHeight: number
  /** Same pane region fields as one-numeric — used by the P2→P3 drop. */
  distBaselineY: number
  dotRadius: number
  boxTop: number
  boxAreaHeight: number
  statZoneTop: number
}

type ProportionThreePaneDisplayProps = {
  populationCategory: number[]
  populationGroup: number[]
  groupLevels: string[]
  groupStats: number[]
  categoryLabels: string[]
  nGroups: number
  statKind: string
  populationStat: number | undefined
  showPopulationStat: boolean
  /** show = outlines; fuzz = blurred outlines + veil; hide = underlay hidden. */
  populationVisibility?: PopulationVisibility
  onPopulationVisibilityChange?: (mode: PopulationVisibility) => void
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
  if (!isProportionMode(support)) return 'Not supported'
  if (support === 'empty') {
    return paneIndex === 0 ? 'Select a categorical variable' : null
  }
  if (!ready) {
    if (paneIndex === 0) return null
    return 'Confirm to generate samples'
  }
  return null
}

export const ProportionThreePaneDisplay = forwardRef<
  ProportionThreePaneHandle,
  ProportionThreePaneDisplayProps
>(function ProportionThreePaneDisplay(
  {
    populationCategory,
    populationGroup,
    groupLevels,
    groupStats,
    categoryLabels,
    nGroups,
    statKind,
    populationStat,
    showPopulationStat,
    populationVisibility = 'show',
    onPopulationVisibilityChange,
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
  const clipIdPrefix = useId().replace(/:/g, '')

  const oneCat = variableSupport === 'one_cat'
  const twoCat = variableSupport === 'two_cat'
  const catLabels = useMemo(
    (): [string, string] => [
      categoryLabels[0] ?? 'Focus',
      categoryLabels[1] ?? 'Other',
    ],
    [categoryLabels],
  )

  const popDomain = effectivePopDomain([], scales?.pop, true)
  const rawDistDomain = effectiveDistDomain([], scales?.dist, true)
  const distDomainTwoGroup =
    twoCat &&
    nGroups === 2 &&
    populationStat != null &&
    Number.isFinite(populationStat)
      ? distDomainCenteredOn([0, 1], populationStat)
      : null
  // one_cat: keep P3 on the same [0, 1] scale as P1/P2.
  const distDomain = oneCat
    ? ([0, 1] as [number, number])
    : twoCat && nGroups >= 3
      ? distDomainAlignedToPop([0, 1])
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

  const { paneHeight, innerWidth, innerHeight, plotTop, margin } = usePaneLayout(
    size.width,
    size.height,
    false,
  )
  const regions = useMemo(() => paneRegions(innerHeight), [innerHeight])
  const domains = domainsFromState(scales)
  const activeDistDomain = oneCat
    ? ([0, 1] as [number, number])
    : moduleReady
      ? domains.dist
      : distDomain
  const { popX, sampleX, distX } = useSamplingScales(
    popDomain,
    activeDistDomain.length >= 2 ? activeDistDomain : distDomain,
    innerWidth,
    innerHeight,
  )

  const paneLayout = useMemo<PaneLayout>(
    () => ({
      marginLeft: margin.left,
      plotTop,
      paneHeight,
      innerWidth,
    }),
    [margin.left, plotTop, paneHeight, innerWidth],
  )

  const sampleGroupBands = useMemo(() => {
    if (!twoCat || nGroups < 2 || groupLevels.length < 2) return []
    if (nGroups >= 3) {
      return computeSampleMultiGroupBands(innerHeight, groupLevels)
    }
    return computeSampleTwoGroupBands(innerHeight, groupLevels)
  }, [twoCat, nGroups, innerHeight, groupLevels])

  const populationGrandProp = useMemo(
    () => proportionFromEncoded(populationCategory, 0),
    [populationCategory],
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
      proportionMode: true as const,
      variableSupport: variableSupport as 'one_cat' | 'two_cat',
      nGroups,
      statKind,
      populationCategory,
      populationGroup,
      groupLevels,
      groupStats,
      categoryLabels: catLabels,
      populationGrandProp,
      sampleGroupBands,
      innerWidth,
      innerHeight,
      distBaselineY: regions.distBaselineY,
      dotRadius: DOT_RADIUS,
      boxTop: regions.boxTop,
      boxAreaHeight: regions.boxAreaHeight,
      statZoneTop: regions.statZoneTop,
    }),
    [
      paneLayout,
      popX,
      sampleX,
      distX,
      variableSupport,
      nGroups,
      statKind,
      populationCategory,
      populationGroup,
      groupLevels,
      groupStats,
      catLabels,
      populationGrandProp,
      sampleGroupBands,
      innerWidth,
      innerHeight,
      regions,
    ],
  )

  useEffect(() => {
    const g = popGroupRef.current
    if (!g || populationCategory.length === 0 || innerWidth <= 0) {
      if (g) d3.select(g).selectAll('*').remove()
      return
    }

    const underlay = clearPopUnderlay(g)
    removeProportionBar(underlay)
    d3.select(underlay).selectAll('.prop-group').remove()
    const filled = popDotsFilled(populationVisibility)
    const dotStyle = filled ? 'filled' : 'outline'

    if (oneCat) {
      drawHybridProportionChart(
        underlay,
        populationCategory,
        innerWidth,
        innerHeight,
        popX,
        {
          showLegend: true,
          showStat: showPopulationStat,
          statValue: populationStat,
          categoryLabels: catLabels,
          dotStyle,
        },
      )
    } else if (twoCat) {
      drawMultiGroupProportionBars(
        underlay,
        populationCategory,
        populationGroup,
        groupLevels,
        null,
        popX,
        innerWidth,
        groupStats.slice(0, nGroups),
        catLabels,
        showPopulationStat,
        innerHeight,
        {
          showDiffSummary: nGroups === 2,
          showAvgDevSummary: nGroups >= 3,
          grandProp: populationGrandProp,
          statKind: (statKind || 'difference') as StatKind,
          dotStyle,
        },
      )
    }

    applyPopulationVisibility(g, populationVisibility, {
      width: innerWidth,
      height: innerHeight,
    })
  }, [
    populationCategory,
    populationGroup,
    groupLevels,
    groupStats,
    oneCat,
    twoCat,
    popX,
    innerWidth,
    innerHeight,
    showPopulationStat,
    populationVisibility,
    populationStat,
    populationGrandProp,
    catLabels,
    nGroups,
    statKind,
  ])

  useEffect(() => {
    const sampleG = sampleGroupRef.current
    const distG = distGroupRef.current
    const distRefG = distRefGroupRef.current
    const flyG = flyGroupRef.current
    if (!sampleG || !distG) return
    // Drop sample / dist / fly leftovers whenever layout mode changes or
    // Confirm is cleared — otherwise two_cat diff artifacts linger on one_cat.
    if (moduleReady) return
    d3.select(sampleG).selectAll('*').remove()
    d3.select(distG).selectAll('*').remove()
    if (distRefG) d3.select(distRefG).selectAll('*').remove()
    if (flyG) d3.select(flyG).selectAll('*').remove()
  }, [moduleReady, innerWidth, oneCat, twoCat, nGroups])

  // Hard-clear sample/dist when switching one_cat ↔ two_cat even if still "ready"
  // (e.g. mid-session variable change before the ready flag flips).
  useEffect(() => {
    const sampleG = sampleGroupRef.current
    const distG = distGroupRef.current
    const flyG = flyGroupRef.current
    if (!sampleG) return
    d3.select(sampleG).selectAll('*').remove()
    if (distG) d3.select(distG).selectAll('.dist-dot, .dist-transient-arrow').remove()
    if (flyG) d3.select(flyG).selectAll('*').remove()
  }, [oneCat, twoCat, nGroups, variableSupport])

  useEffect(() => {
    const g = distRefGroupRef.current
    if (!g) return
    removeDistReferenceLines(g)
    if (!moduleReady) return
    if (twoCat && nGroups === 2) {
      drawDistTwoGroupReferenceLines(
        g,
        distX,
        populationStat ?? NaN,
        innerHeight,
        distBaselineValue(statKind as StatKind),
      )
      return
    }
    if (
      showPopulationStat &&
      populationStat != null &&
      Number.isFinite(populationStat)
    ) {
      drawDistPopulationReferenceLine(g, distX, populationStat, innerHeight)
    }
  }, [
    moduleReady,
    showPopulationStat,
    populationStat,
    distX,
    innerHeight,
    twoCat,
    nGroups,
    statKind,
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
      {onPopulationVisibilityChange && (
        <PopulationVisibilityControl
          value={populationVisibility}
          onChange={onPopulationVisibilityChange}
          style={{
            top: 4,
            right: margin.right + 28,
          }}
        />
      )}
      {PANE_LABELS.map((label, paneIndex) => {
        const help = paneHelpContent({
          paneIndex: paneIndex as 0 | 1 | 2,
          variableSupport,
          statistic: 'mean',
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
          const clipId = `${clipIdPrefix}-prop-pane-clip-${paneIndex}`
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
})
