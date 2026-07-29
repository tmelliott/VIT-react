import type { AnimationMode, AnimationPhase, MValue } from './types'

const M_VALUES: MValue[] = [1, 5, 20, 1000]

type AnimationControlsProps = {
  phase: AnimationPhase
  samplingM: MValue
  distM: MValue
  onSamplingMChange: (m: MValue) => void
  onDistMChange: (m: MValue) => void
  onGo: (mode: AnimationMode) => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onReset: () => void
  cursor: number
  compact?: boolean
}

function MRadioGroup({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string
  value: MValue
  onChange: (m: MValue) => void
  disabled: boolean
}) {
  return (
    <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1">
      {M_VALUES.map((m) => (
        <label key={m} className="flex items-center gap-1 text-sm">
          <input
            type="radio"
            name={name}
            value={m}
            checked={value === m}
            disabled={disabled}
            onChange={() => onChange(m)}
          />
          {m}
        </label>
      ))}
    </div>
  )
}

function MGoRow({
  label,
  name,
  value,
  onChange,
  onGo,
  disabled,
}: {
  label: string
  name: string
  value: MValue
  onChange: (m: MValue) => void
  onGo: () => void
  disabled: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <MRadioGroup
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
        <button
          type="button"
          className="shrink-0 rounded bg-green-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          disabled={disabled}
          onClick={onGo}
        >
          Go
        </button>
      </div>
    </div>
  )
}

export function AnimationControls({
  phase,
  samplingM,
  distM,
  onSamplingMChange,
  onDistMChange,
  onGo,
  onPause,
  onResume,
  onStop,
  onReset,
  cursor,
  compact = false,
}: AnimationControlsProps) {
  const playing = phase === 'playing'
  const paused = phase === 'paused'

  return (
    <div
      className={`flex flex-col gap-3 bg-gray-50 ${
        compact
          ? 'gap-2 p-0'
          : 'rounded-md border border-gray-200 p-4'
      }`}
    >
      {!compact && <h2 className="text-lg font-semibold">Animation</h2>}
      {!compact && (
        <p className="text-sm text-gray-600">Next sample index: {cursor}</p>
      )}

      <div className="flex flex-col gap-3">
        <MGoRow
          label="Sampling"
          name="sampling-m"
          value={samplingM}
          onChange={onSamplingMChange}
          onGo={() => onGo('sampling')}
          disabled={playing}
        />
        <MGoRow
          label="Sampling distribution"
          name="dist-m"
          value={distM}
          onChange={onDistMChange}
          onGo={() => onGo('distribution')}
          disabled={playing}
        />
      </div>

      <div className="flex gap-2">
        {playing && (
          <button
            type="button"
            className="rounded bg-amber-500 px-2 py-1 text-xs text-white md:px-3 md:text-sm"
            onClick={onPause}
          >
            Pause
          </button>
        )}
        {paused && (
          <button
            type="button"
            className="rounded bg-amber-500 px-2 py-1 text-xs text-white md:px-3 md:text-sm"
            onClick={onResume}
          >
            Resume
          </button>
        )}
        <button
          type="button"
          className="rounded bg-gray-600 px-2 py-1 text-xs text-white disabled:opacity-50 md:px-3 md:text-sm"
          disabled={phase === 'idle'}
          onClick={onStop}
        >
          Stop
        </button>
        <button
          type="button"
          className="rounded bg-gray-400 px-2 py-1 text-xs text-white md:px-3 md:text-sm"
          onClick={onReset}
        >
          Reset
        </button>
      </div>
    </div>
  )
}
