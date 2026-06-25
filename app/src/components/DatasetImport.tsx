type DatasetImportProps = {
  urlInput: string
  placeholder: string
  onUrlInputChange: (url: string) => void
  onLoad: () => void
  onUseExample: () => void
  exampleLabel: string
  loading: boolean
  nrows: number
  ncols: number
}

export function DatasetImport({
  urlInput,
  placeholder,
  onUrlInputChange,
  onLoad,
  onUseExample,
  exampleLabel,
  loading,
  nrows,
  ncols,
}: DatasetImportProps) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-4">
      <h2 className="text-lg font-semibold">Dataset</h2>
      <label className="flex flex-col gap-1 text-sm" htmlFor="dataset-url">
        URL
        <input
          id="dataset-url"
          type="url"
          className="w-full rounded border border-gray-300 bg-white px-2 py-1"
          value={urlInput}
          placeholder={placeholder}
          onChange={(e) => onUrlInputChange(e.target.value)}
          spellCheck={false}
        />
      </label>
      <button
        type="button"
        className="cursor-pointer rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={loading || urlInput.trim() === ''}
        onClick={onLoad}
      >
        {loading ? 'Loading…' : 'Load dataset'}
      </button>
      <button
        type="button"
        className="cursor-pointer self-start rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={loading}
        onClick={onUseExample}
      >
        Use example ({exampleLabel})
      </button>
      {nrows > 0 && (
        <p className="text-sm text-gray-600">
          {nrows} rows × {ncols} cols
        </p>
      )}
    </div>
  )
}
