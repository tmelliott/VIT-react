import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import {
  animateOneSample,
  animateSampleBatch,
  clearAllAnimationLayers,
  clearSampleTransient,
  clearFlyLayer,
  createAnimSignal,
  type AnimSignal,
} from '../d3/animateSample'
import {
  getSampleIndices,
  DEFAULT_SAMPLE_ANIMATION_TIMING,
  M1000_BATCH,
  m1000StepMs,
  timingForM,
  toNumberArray,
  toIntArray,
  type AnimationMode,
  type AnimationPhase,
  type MValue,
  type SampleAnimationTiming,
} from '../types'
import type { SamplingVariationState } from '../../rserve/vit.types'
import { ensureDistLayout, useDistLayout } from './useDistLayout'
import type { ThreePaneHandle } from '../ThreePaneDisplay'

export function useAnimationController(
  state: SamplingVariationState | undefined,
  paneRef: RefObject<ThreePaneHandle | null>,
  inferenceActive: boolean,
) {
  const [cursor, setCursor] = useState(0)
  const [phase, setPhase] = useState<AnimationPhase>('idle')
  const [samplingM, setSamplingM] = useState<MValue>(1)
  const [distM, setDistM] = useState<MValue>(1)
  const [sampleTiming, setSampleTiming] = useState<SampleAnimationTiming>(
    DEFAULT_SAMPLE_ANIMATION_TIMING,
  )
  const signalRef = useRef<AnimSignal | null>(null)
  const { layoutRef: distLayoutRef, keyRef: distLayoutKeyRef } = useDistLayout(
    state,
    paneRef,
  )

  const resetLocal = useCallback(() => {
    signalRef.current?.abort()
    signalRef.current = null
    setCursor(0)
    setPhase('idle')
    const handle = paneRef.current
    if (handle) {
      clearAllAnimationLayers(
        handle.popGroup,
        handle.sampleGroup,
        handle.distGroup,
        handle.flyGroup,
        false,
        handle.numCatMode,
      )
    }
  }, [paneRef])

  useEffect(() => {
    if (state?.status !== 'ready' || !inferenceActive) {
      resetLocal()
    }
  }, [state?.status, inferenceActive, resetLocal])

  const runBatch = useCallback(
    async (mode: AnimationMode, m: MValue) => {
      const handle = paneRef.current
      if (!handle || !state || state.status !== 'ready') return

      const population = toNumberArray(state.population)
      const populationGroup = toIntArray(state.population_group)
      const sampleStats = toNumberArray(state.sample_stats)
      const sampleSize = state.sample_size ?? 20
      const indices = state.sample_indices
      const statistic = state.statistic === 'median' ? 'median' : 'mean'
      if (!indices || sampleStats.length === 0) return

      const distLayout = ensureDistLayout(
        state,
        handle,
        distLayoutRef,
        distLayoutKeyRef,
      )

      const signal = createAnimSignal()
      signalRef.current = signal
      setPhase('playing')

      const start = cursor
      const end = Math.min(start + m, sampleStats.length)
      const fullAnimation = m < 20
      const accumulateOnly = m === 1000
      const includeDist = mode === 'distribution'
      const timingMs = m === 1000 ? m1000StepMs(start, end) : timingForM(m)

      const runOne = async (repIndex: number) => {
        const sampleIndices = getSampleIndices(indices, sampleSize, repIndex)
        await animateOneSample({
          popGroup: handle.popGroup,
          sampleGroup: handle.sampleGroup,
          distGroup: handle.distGroup,
          flyGroup: handle.flyGroup,
          paneLayout: handle.paneLayout,
          population,
          populationGroup: handle.numCatMode
            ? populationGroup
            : handle.populationGroup,
          popY: handle.popY,
          sampleIndices,
          sampleStat: sampleStats[repIndex]!,
          popX: handle.popX,
          sampleX: handle.sampleX,
          distX: handle.distX,
          distLayout,
          baselineY: handle.baselineY,
          distBaselineY: handle.distBaselineY,
          dotRadius: handle.dotRadius,
          boxTop: handle.boxTop,
          boxAreaHeight: handle.boxAreaHeight,
          statZoneTop: handle.statZoneTop,
          signal,
          timingMs,
          sampleTiming,
          fullAnimation,
          accumulateOnly,
          includeDist,
          replicateIndex: repIndex,
          numCatMode: handle.numCatMode,
          groupBands: handle.sampleGroupBands,
          nGroups: handle.nGroups,
          statistic: handle.statistic,
          statKind: (handle.statKind || '') as 'difference' | 'average_deviation' | '',
          paneInnerHeight: handle.paneInnerHeight,
          populationGrandStat: handle.grandMean,
          populationStat: state.population_stat ?? 0,
          m,
        })
      }

      if (m === 1000) {
        let r = start
        while (r < end && !signal.aborted) {
          const batchEnd = Math.min(r + M1000_BATCH, end)
          const batchReps = []
          for (let i = r; i < batchEnd; i++) {
            batchReps.push({
              replicateIndex: i,
              sampleStat: sampleStats[i]!,
              sampleIndices: getSampleIndices(indices, sampleSize, i),
            })
          }
          await animateSampleBatch({
            sampleGroup: handle.sampleGroup,
            distGroup: handle.distGroup,
            population,
            populationGroup: handle.numCatMode
              ? populationGroup
              : handle.populationGroup,
            showcaseSampleIndices: getSampleIndices(indices, sampleSize, r),
            sampleX: handle.sampleX,
            distX: handle.distX,
            distLayout,
            paneLayout: handle.paneLayout,
            baselineY: handle.baselineY,
            distBaselineY: handle.distBaselineY,
            dotRadius: handle.dotRadius,
            boxTop: handle.boxTop,
            boxAreaHeight: handle.boxAreaHeight,
            statZoneTop: handle.statZoneTop,
            signal,
            timingMs,
            includeDist,
            reps: batchReps,
            numCatMode: handle.numCatMode,
            groupBands: handle.sampleGroupBands,
            nGroups: handle.nGroups,
            statistic: handle.statistic,
            statKind: (handle.statKind || '') as 'difference' | 'average_deviation' | '',
            paneInnerHeight: handle.paneInnerHeight,
            populationGrandStat: handle.grandMean,
            populationStat: state.population_stat ?? 0,
          })
          r = batchEnd
        }
      } else {
        for (let r = start; r < end; r++) {
          if (signal.aborted) break
          await runOne(r)
          if (m === 5 && !signal.aborted && r < end - 1) {
            clearSampleTransient(handle.sampleGroup)
            clearFlyLayer(handle.flyGroup)
          }
        }
      }

      if (!signal.aborted) {
        setCursor(end)
      }
      setPhase('idle')
      signalRef.current = null
    },
    [cursor, paneRef, state, sampleTiming],
  )

  const onGo = useCallback(
    (mode: AnimationMode) => {
      const m = mode === 'sampling' ? samplingM : distM
      if (cursor >= 1000) return
      void runBatch(mode, m)
    },
    [cursor, distM, runBatch, samplingM],
  )

  const onPause = useCallback(() => {
    signalRef.current?.pause()
    setPhase('paused')
  }, [])

  const onResume = useCallback(() => {
    signalRef.current?.resume()
    setPhase('playing')
  }, [])

  const onStop = useCallback(() => {
    signalRef.current?.abort()
    signalRef.current = null
    setPhase('idle')
    const handle = paneRef.current
    if (handle) {
      clearSampleTransient(handle.sampleGroup)
      clearFlyLayer(handle.flyGroup)
      clearAllAnimationLayers(
        handle.popGroup,
        handle.sampleGroup,
        handle.distGroup,
        handle.flyGroup,
        true,
        handle.numCatMode,
      )
    }
  }, [paneRef])

  const onReset = useCallback(() => {
    resetLocal()
  }, [resetLocal])

  return {
    cursor,
    phase,
    samplingM,
    distM,
    sampleTiming,
    setSampleTiming,
    setSamplingM,
    setDistM,
    onGo,
    onPause,
    onResume,
    onStop,
    onReset,
  }
}
