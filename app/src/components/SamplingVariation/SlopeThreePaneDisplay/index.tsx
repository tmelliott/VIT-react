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
import type { PaneLayout } from '../d3/paneCoords'
import { usePaneLayout } from '../hooks/useSamplingScales'
import { DOT_RADIUS } from '../d3/heapLayout'
import {
  effectiveDistDomain,
  populationDomain,
  type VariableSupport,
} from '../variableSupport'
import { PaneHelpModal } from '../PaneHelpModal'
import { paneHelpContent } from '../paneHelpContent'
import { leastSquares, slopeDerivationTriangle } from '../d3/slopeMath'
import {
  clearSlopePopulation,
  distSlopeSplit,
  drawDistSlopeChrome,
  drawPopulationSlopePanel,
  drawPopulationSlopeScatter,
  drawSampleSlopeChrome,
  distPanelYDomain as computeDistPanelYDomain,
  SCATTER_X_AXIS_HEIGHT,
  slopePaneSplit,
  slopePanelYDomain,
  type DistSlopeSplit,
  type SlopePaneSplit,
} from '../d3/slopeScatter'

export type SlopeThreePaneHandle = {
  popGroup: SVGGElement
  sampleGroup: SVGGElement
  distGroup: SVGGElement
  flyGroup: SVGGElement
  paneLayout: PaneLayout
  popX: d3.ScaleLinear<number, number>
  sampleX: d3.ScaleLinear<number, number>
  sampleYScale: d3.ScaleLinear<number, number>
  /** Kept for DistLayoutHandle compatibility; unused for slope P3. */
  distX: d3.ScaleLinear<number, number>
  /** Slope → pane-local y (shared by P3A endpoints and P3B dots). */
  distY: d3.ScaleLinear<number, number>
  popYScale: d3.ScaleLinear<number, number>
  variableSupport: 'num_num'
  slope: number
  intercept: number
  populationX: number[]
  populationY: number[]
  xDomain: [number, number]
  yDomain: [number, number]
  /** Symmetric P1B/P2B y-domain from slope magnitudes (fits all). */
  panelYDomain: [number, number]
  /** P3A/P3B y-domain: includes 0; may clip extreme slopes. */
  distPanelYDomain: [number, number]
  split: SlopePaneSplit
  distSplit: DistSlopeSplit
  scatterPlotLeft: number
  scatterPlotHeight: number
  innerWidth: number
  innerHeight: number
  /** Left floor for P3B horizontal stacking (pane-local x). */
  distBaselineX: number
  /** Right bound for P3B stacking. */
  distPlotBoundX: number
  /** Unused vertical baseline; kept for DistLayoutHandle compatibility. */
  distBaselineY: number
  dotRadius: number
}

type SlopeThreePaneDisplayProps = {
  populationX: number[]
  populationY: number[]
  slope: number | undefined
  intercept: number | undefined
  showPopulationStat: boolean
  moduleReady: boolean
  variableSupport: VariableSupport
  sampleSize: number
  /** Sample slope statistics (after Confirm); used for P2B y-axis range. */
  sampleStats?: number[]
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
  if (support !== 'num_num') return 'Not supported'
  if (support === 'empty') {
    return paneIndex === 0 ? 'Select two numeric variables' : null
  }
  if (!ready) {
    if (paneIndex === 0) return null
    return 'Confirm to generate samples'
  }
  return null
}

function domainFromScalesOrData(
  scalesPop: Float64Array | number[] | undefined | null,
  values: number[],
): [number, number] {
  const scaled = scalesPop == null ? [] : Array.from(scalesPop)
  if (scaled.length >= 2) return [scaled[0]!, scaled[1]!]
  return populationDomain(values)
}

export const SlopeThreePaneDisplay = forwardRef<
  SlopeThreePaneHandle,
  SlopeThreePaneDisplayProps
>(function SlopeThreePaneDisplay(
  {
    populationX,
    populationY,
    slope: slopeProp,
    intercept: interceptProp,
    showPopulationStat,
    moduleReady,
    variableSupport,
    sampleSize,
    sampleStats,
    scales,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const popGroupRef = useRef<SVGGElement>(null)
  const sampleGroupRef = useRef<SVGGElement>(null)
  const distGroupRef = useRef<SVGGElement>(null)
  const flyGroupRef = useRef<SVGGElement>(null)
  const [size, setSize] = useState({ width: 720, height: 540 })
  const clipIdPrefix = useId().replace(/:/g, '')

  const fitted = useMemo(() => {
    if (
      slopeProp != null &&
      Number.isFinite(slopeProp) &&
      interceptProp != null &&
      Number.isFinite(interceptProp)
    ) {
      return { slope: slopeProp, intercept: interceptProp }
    }
    return leastSquares(populationX, populationY)
  }, [slopeProp, interceptProp, populationX, populationY])

  const xDomain = useMemo(
    () => domainFromScalesOrData(scales?.pop, populationX),
    [scales?.pop, populationX],
  )
  const yDomain = useMemo(
    () => populationDomain(populationY),
    [populationY],
  )
  const distDomain = useMemo(
    () => effectiveDistDomain([], scales?.dist, false),
    [scales?.dist],
  )
  const hasSampleSlopes = Boolean(sampleStats && sampleStats.length > 0)
  // P1B/P2B: fit every sample slope (symmetric about 0).
  const panelYDomain = useMemo(() => {
    if (!hasSampleSlopes) return slopePanelYDomain([])
    const slopes = [...sampleStats!]
    if (Number.isFinite(fitted.slope)) slopes.push(fitted.slope)
    return slopePanelYDomain(slopes)
  }, [fitted.slope, sampleStats, hasSampleSlopes])

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

  const { paneHeight, innerWidth, innerHeight, plotTop, margin } =
    usePaneLayout(size.width, size.height)

  const split = useMemo(() => slopePaneSplit(innerWidth), [innerWidth])
  const distSplit = useMemo(() => distSlopeSplit(innerWidth), [innerWidth])
  const scatterPlotHeight = Math.max(40, innerHeight - SCATTER_X_AXIS_HEIGHT)
  // P3A/P3B: angle-matched to P2A; narrower P3A → larger y-span.
  const distYDomain = useMemo(
    () =>
      computeDistPanelYDomain(xDomain, yDomain, {
        referencePlotWidth: split.scatterPlotWidth,
        panelPlotWidth: distSplit.panelPlotWidth,
      }),
    [xDomain, yDomain, split.scatterPlotWidth, distSplit.panelPlotWidth],
  )
  // P3B dots grow right from the heap y-axis; y aligns with P3A endpoints.
  const distBaselineX =
    distSplit.heapLeft + distSplit.heapPlotLeft + DOT_RADIUS
  const distPlotBoundX =
    distSplit.heapLeft + distSplit.heapPlotLeft + distSplit.heapPlotWidth
  const distBaselineY = Math.max(DOT_RADIUS, scatterPlotHeight - DOT_RADIUS)

  const popX = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain(xDomain)
        .range([0, split.scatterPlotWidth]),
    [xDomain, split.scatterPlotWidth],
  )
  const popYScale = useMemo(
    () => d3.scaleLinear().domain(yDomain).range([scatterPlotHeight, 0]),
    [yDomain, scatterPlotHeight],
  )
  const sampleX = popX
  const sampleYScale = popYScale
  // Placeholder for DistLayoutHandle; slope P3 uses distY + horizontal stacking.
  const distX = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain(distDomain)
        .range([distBaselineX, distPlotBoundX]),
    [distDomain, distBaselineX, distPlotBoundX],
  )
  const distY = useMemo(
    () =>
      d3.scaleLinear().domain(distYDomain).range([scatterPlotHeight, 0]),
    [distYDomain, scatterPlotHeight],
  )

  const paneLayout: PaneLayout = useMemo(
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
      sampleYScale,
      distX,
      distY,
      popYScale,
      variableSupport: 'num_num',
      slope: fitted.slope,
      intercept: fitted.intercept,
      populationX,
      populationY,
      xDomain,
      yDomain,
      panelYDomain,
      distPanelYDomain: distYDomain,
      split,
      distSplit,
      scatterPlotLeft: split.scatterPlotLeft,
      scatterPlotHeight,
      innerWidth,
      innerHeight,
      distBaselineX,
      distPlotBoundX,
      distBaselineY,
      dotRadius: DOT_RADIUS,
    }),
    [
      paneLayout,
      popX,
      sampleX,
      sampleYScale,
      distX,
      distY,
      popYScale,
      fitted.slope,
      fitted.intercept,
      populationX,
      populationY,
      xDomain,
      yDomain,
      panelYDomain,
      distYDomain,
      split,
      distSplit,
      scatterPlotHeight,
      innerWidth,
      innerHeight,
      distBaselineX,
      distPlotBoundX,
      distBaselineY,
    ],
  )

  const showData =
    showPopulationStat &&
    variableSupport === 'num_num' &&
    populationX.length > 0 &&
    populationY.length > 0 &&
    Number.isFinite(fitted.slope)

  useEffect(() => {
    const popG = popGroupRef.current
    if (!popG) return
    if (!showData) {
      clearSlopePopulation(popG)
      return
    }

    const root = d3.select(popG)
    root.selectAll('*').remove()

    const scatterG = root
      .append('g')
      .attr('class', 'pop-slope-scatter')
      .attr('transform', `translate(${split.scatterPlotLeft}, 0)`)
      .node()!

    drawPopulationSlopeScatter(scatterG, {
      x: populationX,
      y: populationY,
      slope: fitted.slope,
      intercept: fitted.intercept,
      xDomain,
      yDomain,
      plotWidth: split.scatterPlotWidth,
      plotHeight: scatterPlotHeight,
      showDerivation: true,
    })

    const triangle = slopeDerivationTriangle(
      fitted.slope,
      fitted.intercept,
      xDomain,
      yDomain,
    )

    const panelG = root
      .append('g')
      .attr('class', 'pop-slope-panel')
      .attr('transform', `translate(${split.slopePanelLeft}, 0)`)
      .node()!

    drawPopulationSlopePanel(panelG, {
      slope: fitted.slope,
      triangle,
      panelWidth: split.slopePanelWidth,
      panelHeight: scatterPlotHeight,
      panelYDomain,
      showLine: hasSampleSlopes,
    })
  }, [
    showData,
    populationX,
    populationY,
    fitted.slope,
    fitted.intercept,
    xDomain,
    yDomain,
    panelYDomain,
    hasSampleSlopes,
    split,
    scatterPlotHeight,
  ])

  useEffect(() => {
    const sampleG = sampleGroupRef.current
    const distG = distGroupRef.current
    if (!sampleG || !distG) return
    if (!moduleReady) {
      d3.select(sampleG).selectAll('*').remove()
      d3.select(distG).selectAll('*').remove()
      return
    }
    drawSampleSlopeChrome(sampleG, {
      split,
      plotHeight: scatterPlotHeight,
      xDomain,
      yDomain,
      slope: fitted.slope,
      panelYDomain,
    })
    drawDistSlopeChrome(distG, {
      distSplit,
      plotHeight: scatterPlotHeight,
      distPanelYDomain: distYDomain,
      populationSlope: fitted.slope,
      showPopulationRef: hasSampleSlopes && Number.isFinite(fitted.slope),
    })
  }, [
    moduleReady,
    split,
    distSplit,
    scatterPlotHeight,
    xDomain,
    yDomain,
    fitted.slope,
    panelYDomain,
    distYDomain,
    hasSampleSlopes,
  ])

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full rounded border border-gray-300 bg-white"
    >
      {PANE_LABELS.map((label, paneIndex) => {
        const help = paneHelpContent({
          paneIndex: paneIndex as 0 | 1 | 2,
          variableSupport,
          statistic: 'mean',
          nGroups: 0,
          statKind: 'slope',
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
      <svg
        width={size.width}
        height={size.height}
        className="block overflow-hidden"
      >
        {PANE_LABELS.map((label, paneIndex) => {
          const yOffset = paneIndex * paneHeight
          const clipId = `${clipIdPrefix}-pane-clip-${paneIndex}`
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
                    <rect
                      x={0}
                      y={0}
                      width={innerWidth}
                      height={innerHeight}
                    />
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
                    <g ref={distGroupRef} transform="translate(0, 0)" />
                  )}
                </g>
              </g>
            </g>
          )
        })}
        <g ref={flyGroupRef} className="fly-layer" />
      </svg>
    </div>
  )
})
