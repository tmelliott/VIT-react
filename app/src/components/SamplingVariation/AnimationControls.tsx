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
    <div className="flex items-center gap-3">
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
}: AnimationControlsProps) {
  const playing = phase === 'playing'
  const paused = phase === 'paused'

  return (
    <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-md border border-gray-200">
      <h2 className="text-lg font-semibold">Animation</h2>
      <p className="text-sm text-gray-600">Next sample index: {cursor}</p>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Sampling</span>
          <MRadioGroup
            name="sampling-m"
            value={samplingM}
            onChange={onSamplingMChange}
            disabled={playing}
          />
          <button
            type="button"
            className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50 w-full"
            disabled={playing}
            onClick={() => onGo('sampling')}
          >
            Go
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Sampling distribution</span>
          <MRadioGroup
            name="dist-m"
            value={distM}
            onChange={onDistMChange}
            disabled={playing}
          />
          <button
            type="button"
            className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50 w-full"
            disabled={playing}
            onClick={() => onGo('distribution')}
          >
            Go
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {playing && (
          <button
            type="button"
            className="px-3 py-1 rounded bg-amber-500 text-white"
            onClick={onPause}
          >
            Pause
          </button>
        )}
        {paused && (
          <button
            type="button"
            className="px-3 py-1 rounded bg-amber-500 text-white"
            onClick={onResume}
          >
            Resume
          </button>
        )}
        <button
          type="button"
          className="px-3 py-1 rounded bg-gray-600 text-white disabled:opacity-50"
          disabled={phase === 'idle'}
          onClick={onStop}
        >
          Stop
        </button>
        <button
          type="button"
          className="px-3 py-1 rounded bg-gray-400 text-white"
          onClick={onReset}
        >
          Reset
        </button>
      </div>
    </div>
  )
}
