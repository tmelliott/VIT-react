export type SamplingStatus = 'idle' | 'computing' | 'ready' | 'error'

export type AnimationMode = 'sampling' | 'distribution'

export type AnimationPhase = 'idle' | 'playing' | 'paused'

export type MValue = 1 | 5 | 20 | 1000

export type StatKind = 'difference' | 'ratio' | 'average_deviation' | ''

export function toNumberArray(
  data: Float64Array | number[] | undefined | null,
): number[] {
  if (data == null) return []
  return Array.from(data)
}

export function toIntArray(
  data: Int32Array | number[] | undefined | null,
): number[] {
  if (data == null) return []
  return Array.from(data)
}

export function toStringArray(
  data: string[] | undefined | null,
): string[] {
  if (data == null) return []
  return Array.from(data)
}

export function isNumCatMode(nGroups: number, yvar: string): boolean {
  return yvar !== '' && nGroups >= 2
}

export function statKindLabel(
  kind: StatKind,
  nGroups: number,
  statistic?: string,
): string {
  if (kind === 'ratio' || (nGroups === 2 && statistic === 'iqr')) {
    return 'IQR ratio'
  }
  if (kind === 'difference' || nGroups === 2) return 'Difference'
  if (kind === 'average_deviation' || nGroups > 2) return 'Average deviation'
  return ''
}

export function scaleDomain(
  domain: Float64Array | number[] | undefined | null,
): [number, number] {
  const arr = toNumberArray(domain)
  if (arr.length >= 2) return [arr[0], arr[1]]
  if (arr.length === 1) return [arr[0], arr[0]]
  return [0, 1]
}

export function getSampleIndices(
  indices: Int32Array | undefined | null,
  sampleSize: number,
  replicate: number,
): number[] {
  if (!indices || sampleSize <= 0) return []
  const poolReps = Math.floor(indices.length / sampleSize)
  if (poolReps <= 0) return []
  const poolRep = replicate % poolReps
  const start = poolRep * sampleSize
  return Array.from(indices.slice(start, start + sampleSize))
}

export function sampleIndexPoolSize(
  indices: Int32Array | undefined | null,
  sampleSize: number,
): number {
  if (!indices || sampleSize <= 0) return 0
  return Math.floor(indices.length / sampleSize)
}

export const M1000_TARGET_MS = 5000
export const M1000_BATCH = 10

export function m1000StepCount(start: number, end: number): number {
  const reps = end - start
  if (reps <= 0) return 0
  return Math.ceil(reps / M1000_BATCH)
}

export function m1000StepMs(start: number, end: number): number {
  const steps = m1000StepCount(start, end)
  if (steps <= 0) return 0
  const reps = end - start
  const duration = (M1000_TARGET_MS * reps) / 1000
  return Math.max(1, Math.round(duration / steps))
}

export function timingForM(m: MValue): number {
  if (m === 1) return 1000
  if (m === 5) return 500
  if (m === 20) return 100
  return m1000StepMs(0, 1000)
}

/** Per-step durations for the full P1→P2 sampling animation (user-adjustable later). */
export type SampleAnimationTiming = {
  /** Fade all population dots before highlighting the sample. */
  popFadeMs: number
  /** Interval between highlighting each sampled point in P1 (first few points). */
  pointHighlightMs: number
  /** Faster interval after the first {@link POINT_HIGHLIGHT_SLOW_COUNT} points. */
  pointHighlightFastMs: number
  /** Pause after the full sample is highlighted, before sliding to P2. */
  sampleCompletePauseMs: number
  /** Duration of the slide from P1 down to P2. */
  slideToSampleMs: number
  /** Pause after showing sample statistic(s) in P2. */
  statDisplayPauseMs: number
  /** K=2: animate dotted drop lines to the diff axis. */
  twoGroupDropLineMs: number
  /** K=2: pause after drop lines before drawing the diff arrow. */
  twoGroupPreArrowPauseMs: number
  /** K=2: draw the diff arrow. */
  twoGroupArrowMs: number
  /** K≥3: draw deviation arrows toward the grand-mean line. */
  multiGroupArrowsMs: number
  /** Hold completed P2 before P2→P3 (M=1 and M=5). */
  distPreSlidePauseMs: number
  /** Pause after arrow reaches the axis before fading in the dist dot. */
  distPostArrowPauseMs: number
  /** Fade in the sampling-distribution dot. */
  distDotFadeInMs: number
  /** Fade out transient P2→P3 arrow overlays. */
  distArrowFadeOutMs: number
  /** K≥3: pause with endpoint dots on deviation lines. */
  distDevPointPauseMs: number
  /** K≥3: fade out per-group deviation lines. */
  distDevLineFadeOutMs: number
  /** K≥3: align endpoint dots to a common row. */
  distAvgDevStageMs: number
  /** K≥3: pause after triangle marker at the mean. */
  distTrianglePauseMs: number
  /** Drop the summary arrow onto the sampling-distribution axis. */
  distArrowDropMs: number
}

export const DEFAULT_SAMPLE_ANIMATION_TIMING: SampleAnimationTiming = {
  popFadeMs: 300,
  pointHighlightMs: 500,
  pointHighlightFastMs: 50,
  sampleCompletePauseMs: 1000,
  slideToSampleMs: 2000,
  statDisplayPauseMs: 1000,
  twoGroupDropLineMs: 1000,
  twoGroupPreArrowPauseMs: 500,
  twoGroupArrowMs: 500,
  multiGroupArrowsMs: 1000,
  distPreSlidePauseMs: 1000,
  distPostArrowPauseMs: 500,
  distDotFadeInMs: 400,
  distArrowFadeOutMs: 400,
  distDevPointPauseMs: 500,
  distDevLineFadeOutMs: 300,
  distAvgDevStageMs: 500,
  distTrianglePauseMs: 500,
  distArrowDropMs: 1000,
}
