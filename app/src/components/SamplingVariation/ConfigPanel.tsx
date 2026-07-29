import {
  availableStatistics,
  parseSamplingStatistic,
  statOptionLabel,
} from './statistics'

type ConfigPanelProps = {
  allVariables: string[]
  xvar: string
  yvar: string
  loi: string
  xLevels: string[]
  sampleSize: number
  statistic: string
  statKindLabel: string
  proportionMode: boolean
  numCatMode: boolean
  nGroups: number
  minSampleSize: number
  status: string
  errorMessage: string
  maxSampleSize: number
  canConfirm: boolean
  onXvarChange: (v: string) => void
  onYvarChange: (v: string) => void
  onLoiChange: (v: string) => void
  onSampleSizeChange: (n: number) => void
  onStatisticChange: (s: string) => void
  onConfirm: () => void
  compact?: boolean
}

export function ConfigPanel({
  allVariables,
  xvar,
  yvar,
  loi,
  xLevels,
  sampleSize,
  statistic,
  statKindLabel,
  proportionMode,
  numCatMode,
  nGroups,
  minSampleSize,
  status,
  errorMessage,
  maxSampleSize,
  canConfirm,
  onXvarChange,
  onYvarChange,
  onLoiChange,
  onSampleSizeChange,
  onStatisticChange,
  onConfirm,
  compact = false,
}: ConfigPanelProps) {
  const computing = status === 'computing'
  const secondaryOptions = allVariables.filter((name) => name !== xvar)
  const effectiveLoi = loi || xLevels[0] || ''

  return (
    <div
      className={`flex min-h-full flex-col gap-2 ${
        compact
          ? 'p-0'
          : 'rounded-md border border-gray-200 bg-gray-50 p-4'
      }`}
    >
      {!compact && <h2 className="text-lg font-semibold">Configuration</h2>}

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1">
          <label className="flex flex-col gap-1 text-sm">
            Primary variable
            <select
              className="w-full rounded border border-gray-300 bg-white px-2 py-1"
              value={xvar}
              disabled={computing || allVariables.length === 0}
              onChange={(e) => onXvarChange(e.target.value)}
            >
              <option value="">
                {allVariables.length === 0
                  ? 'Load a dataset first'
                  : 'Select variable…'}
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
              className="w-full rounded border border-gray-300 bg-white px-2 py-1"
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
        </div>

        {proportionMode && xLevels.length > 0 && (
          <label className="flex flex-col gap-1 text-sm">
            Level of interest
            <select
              className="w-full rounded border border-gray-300 bg-white px-2 py-1"
              value={effectiveLoi}
              disabled={computing}
              onChange={(e) => onLoiChange(e.target.value)}
            >
              {xLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Sample size
          <input
            type="number"
            min={minSampleSize}
            max={maxSampleSize || minSampleSize}
            className="w-24 rounded border border-gray-300 bg-white px-2 py-1"
            value={sampleSize}
            disabled={computing}
            onChange={(e) => onSampleSizeChange(Number(e.target.value))}
          />
        </label>

        {!proportionMode && (
          <StatisticSelect
            statistic={statistic}
            numCatMode={numCatMode}
            nGroups={nGroups}
            computing={computing}
            onStatisticChange={onStatisticChange}
          />
        )}

        {proportionMode && (
          <p className="text-sm text-gray-700">
            Statistic: <span className="font-medium">Proportion</span>
          </p>
        )}

        {(numCatMode || proportionMode) && statKindLabel && (
          <p className="text-sm text-gray-700">
            Sample statistic:{' '}
            <span className="font-medium">{statKindLabel}</span>
          </p>
        )}

        <button
          type="button"
          className="w-full rounded bg-blue-600 px-4 py-1.5 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          Confirm
        </button>
      </div>

      <p className="min-h-[1.25rem] text-sm text-red-600" role="alert">
        {errorMessage || '\u00a0'}
      </p>
    </div>
  )
}

function StatisticSelect({
  statistic,
  numCatMode,
  nGroups,
  computing,
  onStatisticChange,
}: {
  statistic: string
  numCatMode: boolean
  nGroups: number
  computing: boolean
  onStatisticChange: (s: string) => void
}) {
  const statisticOptions = availableStatistics(numCatMode, nGroups)
  const selectedStatistic = statisticOptions.includes(
    parseSamplingStatistic(statistic),
  )
    ? parseSamplingStatistic(statistic)
    : 'mean'

  return (
    <label className="flex flex-col gap-1 text-sm">
      Statistic
      <select
        className="rounded border border-gray-300 bg-white px-2 py-1"
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
  )
}
