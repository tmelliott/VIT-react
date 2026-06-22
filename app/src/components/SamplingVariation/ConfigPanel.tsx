type ConfigPanelProps = {
  variables: string[]
  xvar: string
  sampleSize: number
  statistic: string
  status: string
  errorMessage: string
  maxSampleSize: number
  onXvarChange: (v: string) => void
  onSampleSizeChange: (n: number) => void
  onStatisticChange: (s: string) => void
  onConfirm: () => void
}

export function ConfigPanel({
  variables,
  xvar,
  sampleSize,
  statistic,
  status,
  errorMessage,
  maxSampleSize,
  onXvarChange,
  onSampleSizeChange,
  onStatisticChange,
  onConfirm,
}: ConfigPanelProps) {
  const computing = status === 'computing'
  const canConfirm =
    variables.length > 0 &&
    xvar !== '' &&
    sampleSize >= 1 &&
    sampleSize <= maxSampleSize &&
    !computing

  return (
    <div className="flex flex-col gap-2 p-4 bg-gray-50 rounded-md border border-gray-200">
      <h2 className="text-lg font-semibold">Configuration</h2>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Variable
          <select
            className="border border-gray-300 rounded px-2 py-1 bg-white w-full"
            value={xvar}
            disabled={computing || variables.length === 0}
            onChange={(e) => onXvarChange(e.target.value)}
          >
            {variables.length === 0 ? (
              <option value="">Load a dataset first</option>
            ) : (
              variables.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Sample size
          <input
            type="number"
            min={1}
            max={maxSampleSize || 1}
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
            value={statistic}
            disabled={computing}
            onChange={(e) => onStatisticChange(e.target.value)}
          >
            <option value="mean">Mean</option>
            <option value="median">Median</option>
          </select>
        </label>

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
