import { useRef, useState, useMemo, type ComponentRef } from 'react'
import { useWidget } from '@tmelliott/react-rserve'
import type {
  SamplingVariationCtor,
  SamplingVariationHook,
} from '../../rserve/vit.types'
import { DatasetImport } from '../DatasetImport'
import { useDatasetFromUrl } from '../../hooks/useDatasetFromUrl'
import { useModuleSearchParams } from '../../hooks/useModuleSearchParams'
import { AnimationControls } from './AnimationControls'
import { ConfigPanel } from './ConfigPanel'
import { useAnimationController } from './hooks/useAnimationController'
import { ProgressBar } from './ProgressBar'
import { ThreePaneDisplay } from './ThreePaneDisplay'
import {
  isNumCatMode,
  statKindLabel,
  toIntArray,
  toNumberArray,
  toStringArray,
} from './types'
import {
  getVariableSupport,
} from './variableSupport'
import {
  averageDeviationFromGroups,
  populationGrandStat,
} from './d3/groupLayout'

function useInferenceActive(moduleStatus: string, configEpoch: number) {
  const confirmedEpochRef = useRef<number | null>(null)

  if (moduleStatus !== 'ready') {
    confirmedEpochRef.current = null
  } else if (confirmedEpochRef.current === null) {
    confirmedEpochRef.current = configEpoch
  }

  return moduleStatus === 'ready' && confirmedEpochRef.current === configEpoch
}

export function SamplingVariation({
  module,
}: {
  module: SamplingVariationCtor
}) {
  const widget = useWidget(module) as SamplingVariationHook

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
  const paneRef = useRef<ComponentRef<typeof ThreePaneDisplay>>(null)
  const [configEpoch, setConfigEpoch] = useState(0)
  const bumpConfig = () => setConfigEpoch((n) => n + 1)

  const variables = state.variables ?? []
  const groupVariables = state.group_variables ?? []
  const allVariables = state.all_variables ?? []
  const xvar = state.xvar ?? ''
  const yvar = state.yvar ?? ''
  const sampleSize = state.sample_size ?? 20
  const statistic = state.statistic ?? 'mean'
  const moduleStatus = state.status ?? 'idle'
  const inferenceActive = useInferenceActive(moduleStatus, configEpoch)
  const anim = useAnimationController(state, paneRef, inferenceActive)
  const progress = state.progress ?? 0
  const errorMessage = state.error_message ?? ''
  const population = toNumberArray(state.population)
  const populationGroup = toIntArray(state.population_group)
  const groupLevels = toStringArray(state.group_levels)
  const groupStats = toNumberArray(state.group_stats)
  const nGroups = state.n_groups ?? 0
  const statKind = (state.stat_kind ?? '') as '' | 'difference' | 'average_deviation'
  const variableSupport = getVariableSupport(
    xvar,
    yvar,
    variables,
    groupVariables,
  )
  const numCatMode = variableSupport === 'num_cat' && isNumCatMode(nGroups, yvar)
  const stat = statistic === 'median' ? 'median' : 'mean'
  const showPopulationPreview =
    (variableSupport === 'one_num' || variableSupport === 'num_cat') &&
    population.length > 0
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
      : Math.max(population.length, 1)
  const minSampleSize = numCatMode ? 2 : 1
  const canConfirm =
    (variableSupport === 'one_num' || variableSupport === 'num_cat') &&
    xvar !== '' &&
    sampleSize >= minSampleSize &&
    sampleSize <= maxSampleSize &&
    moduleStatus !== 'computing'

  const handleXvarChange = (value: string) => {
    searchHandlers.onXvarChange(value)
    if (value !== '' && value === yvar) {
      searchHandlers.onYvarChange('')
    }
  }

  const searchHandlers = useModuleSearchParams({
    variables,
    groupVariables,
    hasData: dataset.hasData,
    set,
    onConfigChange: bumpConfig,
  })

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <aside className="flex w-full max-w-[360px] min-w-[240px] shrink-0 flex-col gap-4 overflow-y-auto">
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
        />

        {dataset.hasData && (
          <ConfigPanel
            allVariables={allVariables.length > 0 ? allVariables : [...variables, ...groupVariables]}
            xvar={xvar}
            yvar={yvar}
            sampleSize={sampleSize}
            statistic={statistic}
            statKindLabel={statKindLabel(statKind, nGroups)}
            numCatMode={numCatMode}
            status={moduleStatus}
            errorMessage={errorMessage}
            maxSampleSize={maxSampleSize}
            canConfirm={canConfirm}
            onXvarChange={handleXvarChange}
            onYvarChange={searchHandlers.onYvarChange}
            onSampleSizeChange={searchHandlers.onSampleSizeChange}
            onStatisticChange={searchHandlers.onStatisticChange}
            onConfirm={() => {
              void methods?.record_choices?.()?.catch((err: unknown) => {
                console.error('record_choices failed:', err)
              })
            }}
          />
        )}

        <ProgressBar progress={progress} visible={moduleStatus === 'computing'} />

        {inferenceActive && (
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
          />
        )}
      </aside>

      <main className="flex min-h-0 min-w-0 flex-2">
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
      </main>
    </div>
  )
}
