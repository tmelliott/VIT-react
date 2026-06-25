import { useEffect, useId, useRef, type ReactNode } from 'react'

type PaneHelpModalProps = {
  paneLabel: string
  summary: ReactNode
  details: ReactNode
  style?: React.CSSProperties
}

export function PaneHelpModal({
  paneLabel,
  summary,
  details,
  style,
}: PaneHelpModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const onCancel = (event: Event) => {
      event.preventDefault()
      dialog.close()
    }
    dialog.addEventListener('cancel', onCancel)
    return () => dialog.removeEventListener('cancel', onCancel)
  }, [])

  return (
    <>
      <button
        type="button"
        aria-label={`Help: ${paneLabel}`}
        className="absolute z-10 flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-semibold text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900"
        style={style}
        onClick={() => dialogRef.current?.showModal()}
      >
        i
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] max-h-[min(85vh,640px)] overflow-hidden rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-black/30 open:flex open:flex-col"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <h2 id={titleId} className="text-sm font-semibold text-gray-900">
            {paneLabel}
          </h2>
          <button
            type="button"
            aria-label="Close help"
            className="rounded px-2 py-0.5 text-lg leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3 text-sm leading-relaxed text-gray-700">
          <div className="space-y-3">{summary}</div>
          <details className="mt-4 rounded border border-gray-200 bg-gray-50/80">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100">
              More detail
            </summary>
            <div className="space-y-3 border-t border-gray-200 px-3 py-3 text-sm text-gray-700">
              {details}
            </div>
          </details>
        </div>
      </dialog>
    </>
  )
}
