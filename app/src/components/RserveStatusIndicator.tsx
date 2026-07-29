import { useEffect, useId, useRef, useState } from 'react'
import type { RserveConnectionStatus } from '../lib/rserveConnection'
import { rserveStatusMessage } from '../lib/rserveStatusMessage'
import { useRserveConnection } from '../hooks/useRserveConnection'

const dotStyles: Record<RserveConnectionStatus, string> = {
  connected: 'bg-emerald-500',
  connecting: 'bg-amber-500 animate-pulse',
  disconnected: 'bg-red-500',
}

export function RserveStatusIndicator() {
  const { host, connectionStatus, error, reconnectAttempt } =
    useRserveConnection()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const tooltipId = useId()
  const message = rserveStatusMessage(
    connectionStatus,
    reconnectAttempt ?? 0,
    error,
  )

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className="flex items-center justify-center rounded-full p-1.5 hover:bg-gray-100"
        aria-label={message}
        aria-expanded={open}
        aria-controls={tooltipId}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${dotStyles[connectionStatus]}`}
          role="status"
          aria-live="polite"
        />
      </button>
      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute right-0 top-full z-50 mt-1 w-max max-w-[min(18rem,calc(100vw-2rem))] rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-xs text-gray-800 shadow-md"
        >
          <p className="font-medium">{message}</p>
          <p className="mt-0.5 truncate text-gray-500">{host}</p>
        </div>
      )}
    </div>
  )
}
