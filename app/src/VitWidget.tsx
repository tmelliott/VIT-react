import { useState } from 'react'
import { useRserve, useWidget } from '@tmelliott/react-rserve'
import vitAppSchema from './rserve/vit.rserve'
import type { VitAppShape, VitWidgetHook } from './rserve/vit.types'
import { SamplingVariation } from './components/SamplingVariation'

const DEFAULT_DATA_URL =
  'https://vincentarelbundock.github.io/Rdatasets/csv/datasets/iris.csv'

export function VitWidget() {
  const rserveHost =
    import.meta.env.VITE_RSERVE_HOST ?? 'http://127.0.0.1:6311'

  const { app, loading, error } = useRserve(vitAppSchema, {
    host: rserveHost,
  })

  return (
    <section className="vit-widget flex min-h-0 flex-1 flex-col gap-2">
      <h1 className="shrink-0 text-lg font-bold">VIT</h1>

      {loading && <p>Connecting to Rserve…</p>}
      {error && (
        <p role="alert">
          Rserve: {error} (is <code>Rscript server/main.R</code> running?)
        </p>
      )}

      {app && <VITApp app={app as VitAppShape} />}
    </section>
  )
}

function VITApp({ app }: { app: VitAppShape }) {
  const { state, methods, children } = useWidget(
    app.vitWidget,
  ) as VitWidgetHook
  const [urlInput, setUrlInput] = useState(DEFAULT_DATA_URL)

  const [module, setModule] = useState<'samplingVariation' | null>(null)

  if (!state) return <>Loading ...</>

  return (
    <div
      className={`flex flex-col gap-3 ${module ? 'min-h-0 flex-1' : ''}`}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md bg-gray-100 p-3">
        <label
          htmlFor="dataset-url"
          className="text-sm font-medium text-gray-700"
        >
          Dataset
        </label>
        <input
          id="dataset-url"
          type="url"
          className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          spellCheck={false}
        />
        <button
          type="button"
          className="cursor-pointer rounded bg-gray-200 px-2 py-1 shadow hover:bg-gray-300"
          onClick={() => void methods?.load_dataset?.(urlInput)}
        >
          Load
        </button>
        {state.dsInfo.nrows > 0 && (
          <span className="text-sm text-gray-600">
            {state.dsInfo.nrows} rows × {state.dsInfo.ncols} cols
          </span>
        )}
        {module === 'samplingVariation' && (
          <button
            type="button"
            className="ml-auto text-sm text-blue-600 hover:underline"
            onClick={() => setModule(null)}
          >
            ← Modules
          </button>
        )}
      </div>

      {module === null && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">Modules</h2>
          <ul>
            <li
              className="cursor-pointer rounded-md bg-gray-100 p-2 hover:text-blue-500"
              onClick={() => setModule('samplingVariation')}
            >
              Sampling Variation
            </li>
          </ul>
        </div>
      )}

      {module === 'samplingVariation' && children && (
        <div className="flex min-h-0 flex-1">
          <SamplingVariation
            module={children.samplingVariation}
            maxRows={state.dsInfo.nrows}
          />
        </div>
      )}
    </div>
  )
}
