import {
  availableStatistics,
  parseSamplingStatistic,
  statOptionLabel,
} from './statistics'

type ConfigPanelProps = {
  allVariables: string[]
  xvar: string
  yvar: string
  sampleSize: number
  statistic: string
  statKindLabel: string
  numCatMode: boolean
  nGroups: number
  status: string
  errorMessage: string
  maxSampleSize: number
  canConfirm: boolean
  onXvarChange: (v: string) => void
  onYvarChange: (v: string) => void
  onSampleSizeChange: (n: number) => void
  onStatisticChange: (s: string) => void
  onConfirm: () => void
}

export function ConfigPanel({
  allVariables,
  xvar,
  yvar,
  sampleSize,
  statistic,
  statKindLabel,
  numCatMode,
  nGroups,
  status,
  errorMessage,
  maxSampleSize,
  canConfirm,
  onXvarChange,
  onYvarChange,
  onSampleSizeChange,
  onStatisticChange,
  onConfirm,
}: ConfigPanelProps) {
  const computing = status === 'computing'
  const minSampleSize = numCatMode ? 2 : 1
  const secondaryOptions = allVariables.filter((name) => name !== xvar)
  const statisticOptions = availableStatistics(numCatMode, nGroups)
  const selectedStatistic = statisticOptions.includes(parseSamplingStatistic(statistic))
    ? parseSamplingStatistic(statistic)
    : 'mean'

  return (
    <div className="flex flex-col gap-2 p-4 bg-gray-50 rounded-md border border-gray-200">
      <h2 className="text-lg font-semibold">Configuration</h2>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Primary variable
          <select
            className="border border-gray-300 rounded px-2 py-1 bg-white w-full"
            value={xvar}
            disabled={computing || allVariables.length === 0}
            onChange={(e) => onXvarChange(e.target.value)}
          >
            <option value="">
              {allVariables.length === 0 ? 'Load a dataset first' : 'Select variable…'}
            </option>
            {allVariables.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Secondary variable (optional)
          <select
            className="border border-gray-300 rounded px-2 py-1 bg-white w-full"
            value={yvar}
            disabled={computing || allVariables.length === 0 || !xvar}
            onChange={(e) => onYvarChange(e.target.value)}
          >
            <option value="">None</option>
            {secondaryOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Sample size
          <input
            type="number"
            min={minSampleSize}
            max={maxSampleSize || minSampleSize}
            className="border border-gray-300 rounded px-2 py-1 w-24 bg-white"
            value={sampleSize}
            disabled={computing}
            onChange={(e) => onSampleSizeChange(Number(e.target.value))}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Statistic
          <select
            className="border border-gray-300 rounded px-2 py-1 bg-white"
            value={selectedStatistic}
            disabled={computing}
            onChange={(e) => onStatisticChange(e.target.value)}
          >
            {statisticOptions.map((option) => (
              <option key={option} value={option}>
                {statOptionLabel(option)}
              </option>
            ))}
          </select>
        </label>

        {numCatMode && statKindLabel && (
          <p className="text-sm text-gray-700">
            Sample statistic:{' '}
            <span className="font-medium">{statKindLabel}</span>
          </p>
        )}

        <button
          type="button"
          className="px-4 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 w-full"
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          Confirm
        </button>
      </div>

      {errorMessage && (
        <p className="text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
