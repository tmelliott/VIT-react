import { useState } from 'react'
import { useRserve, useWidget } from '@tmelliott/react-rserve'
import vitAppSchema, { type TVitApp } from './rserve/vit.rserve'
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
    <section className="vit-widget">
      <h1>VIT skeleton</h1>

      {loading && <p>Connecting to Rserve…</p>}
      {error && (
        <p role="alert">
          Rserve: {error} (is <code>Rscript server/main.R</code> running?)
        </p>
      )}

      {app && <VITApp app={app} />}
    </section>
  )
}

function VITApp({app}: {app: TVitApp}) {
  const { state, methods, children } = useWidget(app.vitWidget)
  const [urlInput, setUrlInput] = useState(DEFAULT_DATA_URL)

  const [module, setModule] = useState<"samplingVariation" | null>(null);

  if (!state) return <>Loading ...</>;

  return (
    <div className="flex flex-col gap-4">
       <>
         <div className="p-4 bg-gray-100 rounded-md flex items-center gap-2">
          <label htmlFor="dataset-url" className="block text-sm font-medium text-gray-700">Dataset URL</label>
          <input
            type="url"
            className="border border-gray-300 px-2 py-1 rounded bg-white"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            spellCheck={false}
            size={72}
            />
          <button
            type="button"
            className="px-2 py-1 bg-gray-200 rounded shadow cursor-pointer hover:bg-gray-300"
            onClick={() =>
              methods?.load_dataset?.(urlInput)
            }
          >
            Load
          </button>
        </div>

        <div className="p-4 bg-gray-100 rounded-md">
          {state.dsInfo.nrows > 0 ? ( <>
          <h2 className="text-lg font-bold">Dataset Information</h2>
          <p>Number of rows: {state.dsInfo.nrows}</p>
          <p>Number of columns: {state.dsInfo.ncols}</p>
          </>) : (
            <p>No dataset loaded</p>
          )}
        </div>

        {module === null && (
          <div className="flex flex-col gap-2 mx-4">
            <h2 className="text-lg font-bold">Modules</h2>
            <ul>
              <li className="cursor-pointer hover:text-blue-500 bg-gray-100 rounded-md p-2" onClick={() => setModule("samplingVariation")}>
                Sampling Variation
              </li>
            </ul>
          </div>
        )}

        {module === "samplingVariation" && children && (
          <SamplingVariation module={children.samplingVariation} />
        )}
      </>
    </div>
  )
}
