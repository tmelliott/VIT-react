import { useRef, useState, useMemo, useEffect } from 'react'
import type { SamplingVariationHook } from '../../rserve/vit.types'
import { DatasetImport } from '../DatasetImport'
import { useDatasetFromUrl } from '../../hooks/useDatasetFromUrl'
import { useModuleSearchParams } from '../../hooks/useModuleSearchParams'
import { AnimationControls } from './AnimationControls'
import { ConfigPanel } from './ConfigPanel'
import { ControlPanelDock } from './ControlPanelDock'
import {
  useAnimationController,
} from './hooks/useAnimationController'
import type { PaneHandle } from './paneHandle'
import { ProgressBar } from './ProgressBar'
import { ThreePaneDisplay } from './ThreePaneDisplay'
import { ProportionThreePaneDisplay } from './ProportionThreePaneDisplay'
import { SlopeThreePaneDisplay } from './SlopeThreePaneDisplay'
import {
  isNumCatMode,
  statKindLabel,
  toIntArray,
  toNumberArray,
  toStringArray,
} from './types'
import {
  getVariableSupport,
  isProportionMode,
} from './variableSupport'
import {
  averageDeviationFromGroups,
  populationGrandStat,
} from './d3/groupLayout'
import { availableStatistics, parseSamplingStatistic } from './statistics'
import { useSamplingVariationWidget } from '../../hooks/useSamplingVariationWidget'

function useInferenceActive(moduleStatus: string, configEpoch: number) {
  const confirmedEpochRef = useRef<number | null>(null)

  if (moduleStatus !== 'ready') {
    confirmedEpochRef.current = null
  } else if (confirmedEpochRef.current === null) {
    confirmedEpochRef.current = configEpoch
  }

  return moduleStatus === 'ready' && confirmedEpochRef.current === configEpoch
}

export function SamplingVariation() {
  const widget = useSamplingVariationWidget()

  if (widget.status === 'loading') {
    return <p className="text-gray-600">Connecting module…</p>
  }

  if (!widget.state) {
    return <p className="text-gray-600">Waiting for module state…</p>
  }

  return <SamplingVariationView widget={widget} />
}

function SamplingVariationView({
  widget,
}: {
  widget: SamplingVariationHook & { state: NonNullable<SamplingVariationHook['state']> }
}) {
  const { state, set, methods } = widget
  const dataset = useDatasetFromUrl()
  const paneRef = useRef<PaneHandle | null>(null)
  const [configEpoch, setConfigEpoch] = useState(0)
  const bumpConfig = () => setConfigEpoch((n) => n + 1)

  const variables = state.variables ?? []
  const groupVariables = state.group_variables ?? []
  const allVariables = state.all_variables ?? []
  const xvar = state.xvar ?? ''
  const yvar = state.yvar ?? ''
  const loi = state.loi ?? ''
  const xLevels = toStringArray(state.x_levels)
  const categoryLabels = toStringArray(state.category_labels)
  const populationCategory = toIntArray(state.population_category)
  const sampleSize = state.sample_size ?? 20
  const statistic = state.statistic ?? 'mean'
  const moduleStatus = state.status ?? 'idle'
  const inferenceActive = useInferenceActive(moduleStatus, configEpoch)
  const anim = useAnimationController(state, paneRef, inferenceActive)
  const progress = state.progress ?? 0
  const errorMessage = state.error_message ?? ''
  const population = useMemo(
    () => toNumberArray(state.population),
    [state.population],
  )
  const populationY = useMemo(
    () => toNumberArray(state.population_y),
    [state.population_y],
  )
  const sampleStats = useMemo(
    () => toNumberArray(state.sample_stats),
    [state.sample_stats],
  )
  const populationIntercept = state.population_intercept
  const populationGroup = useMemo(
    () => toIntArray(state.population_group),
    [state.population_group],
  )
  const groupLevels = useMemo(
    () => toStringArray(state.group_levels),
    [state.group_levels],
  )
  const groupStats = useMemo(
    () => toNumberArray(state.group_stats),
    [state.group_stats],
  )
  const nGroups = state.n_groups ?? 0
  const statKind = (state.stat_kind ?? '') as
    | ''
    | 'difference'
    | 'ratio'
    | 'average_deviation'
    | 'proportion'
    | 'slope'
  const variableSupport = getVariableSupport(
    xvar,
    yvar,
    variables,
    groupVariables,
  )
  const proportionMode = isProportionMode(variableSupport)
  const slopeMode = variableSupport === 'num_num'
  const numCatMode = variableSupport === 'num_cat' && isNumCatMode(nGroups, yvar)
  const stat = parseSamplingStatistic(statistic)
  const allowedStatistics = availableStatistics(numCatMode, nGroups)
  useEffect(() => {
    if (slopeMode || proportionMode) return
    if (allowedStatistics.includes(stat)) return
    void set?.('statistic', 'mean')
  }, [allowedStatistics, stat, set, slopeMode, proportionMode])
  const showPopulationPreview =
    (variableSupport === 'one_num' ||
      variableSupport === 'num_cat' ||
      variableSupport === 'num_num' ||
      proportionMode) &&
    (population.length > 0 ||
      populationCategory.length > 0 ||
      (slopeMode && populationY.length > 0))
  const displayPopulationStat = useMemo(() => {
    if (variableSupport === 'one_num' && population.length > 0) {
      return populationGrandStat(population, stat)
    }
    if (
      numCatMode &&
      statKind === 'average_deviation' &&
      nGroups >= 3 &&
      groupStats.length >= nGroups
    ) {
      return averageDeviationFromGroups(
        groupStats.slice(0, nGroups),
        populationGrandStat(population, stat),
      )
    }
    return state.population_stat
  }, [
    variableSupport,
    population,
    stat,
    numCatMode,
    statKind,
    nGroups,
    groupStats,
    state.population_stat,
  ])
  const maxSampleSize =
    dataset.dsInfo.nrows > 0
      ? dataset.dsInfo.nrows
      : Math.max(population.length, populationCategory.length, 1)
  const minSampleSize =
    variableSupport === 'one_cat'
      ? 1
      : numCatMode || variableSupport === 'two_cat' || slopeMode
        ? 2
        : 1
  const canConfirm =
    (variableSupport === 'one_num' ||
      variableSupport === 'num_cat' ||
      variableSupport === 'num_num' ||
      proportionMode) &&
    xvar !== '' &&
    (!slopeMode || yvar !== '') &&
    sampleSize >= minSampleSize &&
    sampleSize <= maxSampleSize &&
    (proportionMode || slopeMode || allowedStatistics.includes(stat)) &&
    moduleStatus !== 'computing'

  const handleXvarChange = (value: string) => {
    searchHandlers.onXvarChange(value)
    if (value !== '' && value === yvar) {
      searchHandlers.onYvarChange('')
    }
  }

  const handleLoiChange = (value: string) => {
    bumpConfig()
    void methods?.refresh_preview?.(value)
  }

  const searchHandlers = useModuleSearchParams({
    variables,
    groupVariables,
    hasData: dataset.hasData,
    set,
    onConfigChange: bumpConfig,
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row md:gap-4">
      <main className="order-1 flex min-h-0 min-w-0 flex-1 md:order-2 md:flex-2">
        {proportionMode ? (
          <ProportionThreePaneDisplay
            ref={paneRef}
            populationCategory={populationCategory}
            populationGroup={populationGroup}
            groupLevels={groupLevels}
            groupStats={groupStats}
            categoryLabels={categoryLabels}
            nGroups={nGroups}
            statKind={statKind}
            populationStat={state.population_stat}
            showPopulationStat={showPopulationPreview}
            moduleReady={inferenceActive}
            variableSupport={variableSupport}
            sampleSize={sampleSize}
            scales={state.scales}
          />
        ) : slopeMode ? (
          <SlopeThreePaneDisplay
            ref={paneRef}
            populationX={population}
            populationY={populationY}
            slope={state.population_stat}
            intercept={populationIntercept}
            showPopulationStat={showPopulationPreview}
            moduleReady={inferenceActive}
            variableSupport={variableSupport}
            sampleSize={sampleSize}
            sampleStats={sampleStats}
            scales={state.scales}
          />
        ) : (
          <ThreePaneDisplay
            ref={paneRef}
            population={population}
            populationGroup={populationGroup}
            groupLevels={groupLevels}
            groupStats={groupStats}
            nGroups={nGroups}
            statKind={statKind}
            statistic={statistic}
            populationStat={displayPopulationStat}
            showPopulationStat={showPopulationPreview}
            showFullPopulation={showPopulationPreview}
            moduleReady={inferenceActive}
            variableSupport={variableSupport}
            sampleSize={sampleSize}
            scales={state.scales}
          />
        )}
      </main>

      <ControlPanelDock
        className="order-2 shrink-0 md:order-1 md:w-full md:max-w-[360px] md:min-w-[240px]"
        hasData={dataset.hasData}
        inferenceActive={inferenceActive}
        dataset={({ compact }) => (
          <DatasetImport
            urlInput={dataset.urlInput}
            placeholder={dataset.placeholder}
            onUrlInputChange={dataset.setUrlInput}
            onLoad={() => void dataset.loadDataset(dataset.urlInput)}
            onUseExample={() => void dataset.loadExample()}
            exampleLabel={dataset.exampleLabel}
            loading={dataset.loading}
            nrows={dataset.dsInfo.nrows}
            ncols={dataset.dsInfo.ncols}
            compact={compact}
          />
        )}
        config={({ compact }) => (
          <ConfigPanel
            allVariables={
              allVariables.length > 0
                ? allVariables
                : [...variables, ...groupVariables]
            }
            xvar={xvar}
            yvar={yvar}
            loi={loi}
            xLevels={xLevels}
            sampleSize={sampleSize}
            statistic={statistic}
            statKindLabel={statKindLabel(statKind, nGroups, statistic)}
            proportionMode={proportionMode}
            slopeMode={slopeMode}
            numCatMode={numCatMode}
            nGroups={nGroups}
            minSampleSize={minSampleSize}
            status={moduleStatus}
            errorMessage={errorMessage}
            maxSampleSize={maxSampleSize}
            canConfirm={canConfirm}
            onXvarChange={handleXvarChange}
            onYvarChange={searchHandlers.onYvarChange}
            onLoiChange={handleLoiChange}
            onSampleSizeChange={searchHandlers.onSampleSizeChange}
            onStatisticChange={searchHandlers.onStatisticChange}
            onConfirm={() => {
              void methods?.record_choices?.()?.catch((err: unknown) => {
                console.error('record_choices failed:', err)
              })
            }}
            compact={compact}
          />
        )}
        progress={() => (
          <ProgressBar
            progress={progress}
            visible={moduleStatus === 'computing'}
          />
        )}
        animation={({ compact }) => (
          <AnimationControls
            phase={anim.phase}
            samplingM={anim.samplingM}
            distM={anim.distM}
            onSamplingMChange={anim.setSamplingM}
            onDistMChange={anim.setDistM}
            onGo={anim.onGo}
            onPause={anim.onPause}
            onResume={anim.onResume}
            onStop={anim.onStop}
            onReset={anim.onReset}
            cursor={anim.cursor}
            compact={compact}
          />
        )}
      />
    </div>
  )
}
