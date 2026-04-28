import { useMemo, useState } from 'react'
import { useOcap, useRserve } from '@tmelliott/react-rserve'
import vitAppSchema from './rserve/vit.rserve'

const DEFAULT_DATA_URL =
  'https://vincentarelbundock.github.io/Rdatasets/csv/datasets/iris.csv'

export function VitWidget() {
  const rserveHost =
    import.meta.env.VITE_RSERVE_HOST ?? 'http://127.0.0.1:6311'

  const { app, loading, error } = useRserve(vitAppSchema, {
    host: rserveHost,
  })

  const modules = useOcap(app?.list_modules, [], { enabled: !!app })

  const [urlInput, setUrlInput] = useState(DEFAULT_DATA_URL)
  const [urlToLoad, setUrlToLoad] = useState<string | null>(null)

  const loadArgs = useMemo(
    () => (urlToLoad === null ? [''] : [urlToLoad]) as [string],
    [urlToLoad],
  )

  const columns = useOcap(app?.load_dataset, loadArgs, {
    enabled: !!app && urlToLoad !== null,
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

      {app && (
        <>
          <div className="vit-field">
            <label htmlFor="dataset-url">Dataset URL</label>
            <input
              id="dataset-url"
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              spellCheck={false}
              size={72}
            />
            <button
              type="button"
              onClick={() => setUrlToLoad(urlInput.trim() || null)}
            >
              Load
            </button>
          </div>

          <div className="vit-panel">
            <h2>Columns after load</h2>
            {urlToLoad === null && (
              <p className="vit-muted">Click Load to run smart_read().</p>
            )}
            {columns.loading && <p>Loading dataset…</p>}
            {columns.error && (
              <p role="alert">load_dataset: {columns.error}</p>
            )}
            {columns.result && columns.result.length > 0 && (
              <ul>
                {columns.result.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="vit-panel">
            <h2>Modules</h2>
            {modules.loading && <p>…</p>}
            {modules.error && (
              <p role="alert">list_modules: {modules.error}</p>
            )}
            {modules.result && (
              <ul>
                {modules.result.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}
