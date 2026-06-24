export type SamplingStatus = 'idle' | 'computing' | 'ready' | 'error'

export type AnimationMode = 'sampling' | 'distribution'

export type AnimationPhase = 'idle' | 'playing' | 'paused'

export type MValue = 1 | 5 | 20 | 1000

export type StatKind = 'difference' | 'average_deviation' | ''

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

export function statKindLabel(kind: StatKind, nGroups: number): string {
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
