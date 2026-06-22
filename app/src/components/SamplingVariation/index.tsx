import { useRef, type ComponentRef } from 'react'
import { useWidget } from '@tmelliott/react-rserve'
import type {
  SamplingVariationCtor,
  SamplingVariationHook,
} from '../../rserve/vit.types'
import { AnimationControls } from './AnimationControls'
import { ConfigPanel } from './ConfigPanel'
import { useAnimationController } from './hooks/useAnimationController'
import { ProgressBar } from './ProgressBar'
import { ThreePaneDisplay } from './ThreePaneDisplay'
import { toNumberArray } from './types'

export function SamplingVariation({
  module,
  maxRows = 0,
}: {
  module: SamplingVariationCtor
  maxRows?: number
}) {
  const { state, set, methods, status: widgetStatus } = useWidget(
    module,
  ) as SamplingVariationHook
  const paneRef = useRef<ComponentRef<typeof ThreePaneDisplay>>(null)
  const anim = useAnimationController(state, paneRef)

  if (widgetStatus === 'loading') {
    return <p className="text-gray-600">Connecting module…</p>
  }

  if (!state) {
    return <p className="text-gray-600">Waiting for module state…</p>
  }

  const variables = state.variables ?? []
  const xvar = state.xvar ?? ''
  const sampleSize = state.sample_size ?? 20
  const statistic = state.statistic ?? 'mean'
  const moduleStatus = state.status ?? 'idle'
  const progress = state.progress ?? 0
  const errorMessage = state.error_message ?? ''
  const population = toNumberArray(state.population)
  const maxSampleSize = maxRows > 0 ? maxRows : Math.max(population.length, 1)

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3">
      <h1 className="shrink-0 text-xl font-bold">Sampling Variation</h1>

      <div className="flex min-h-0 flex-1 gap-4">
        <aside className="flex w-full max-w-[360px] min-w-[240px] shrink-0 flex-1 flex-col gap-4 overflow-y-auto">
          <ConfigPanel
            variables={variables}
            xvar={xvar}
            sampleSize={sampleSize}
            statistic={statistic}
            status={moduleStatus}
            errorMessage={errorMessage}
            maxSampleSize={maxSampleSize}
            onXvarChange={(v) => void set('xvar', v)}
            onSampleSizeChange={(n) => void set('sample_size', n)}
            onStatisticChange={(s) => void set('statistic', s)}
            onConfirm={() => void methods?.record_choices?.()}
          />

          <ProgressBar progress={progress} visible={moduleStatus === 'computing'} />

          {moduleStatus === 'ready' && (
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
            populationStat={state.population_stat}
            showPopulationStat={moduleStatus === 'ready'}
            scales={state.scales}
          />
        </main>
      </div>
    </div>
  )
}
