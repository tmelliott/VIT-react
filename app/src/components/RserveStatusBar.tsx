import type { RserveConnectionStatus } from '../lib/rserveConnection'

type RserveStatusBarProps = {
  status: RserveConnectionStatus
  host: string
  error?: string
  reconnectAttempt: number
}

const statusStyles: Record<RserveConnectionStatus, string> = {
  connected: 'bg-emerald-600 text-white',
  connecting: 'bg-amber-500 text-white',
  disconnected: 'bg-red-600 text-white',
}

function statusMessage(
  status: RserveConnectionStatus,
  reconnectAttempt: number,
  error?: string,
): string {
  switch (status) {
    case 'connected':
      return 'Connected to Rserve'
    case 'connecting':
      return reconnectAttempt > 0
        ? `Reconnecting to Rserve (attempt ${reconnectAttempt + 1})…`
        : 'Connecting to Rserve…'
    case 'disconnected':
      return error
        ? `Connection lost — ${error}`
        : 'Connection lost — retrying shortly…'
  }
}

export function RserveStatusBar({
  status,
  host,
  error,
  reconnectAttempt,
}: RserveStatusBarProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-between gap-3 px-3 py-1 text-xs ${statusStyles[status]}`}
      role="status"
      aria-live="polite"
    >
      <span>{statusMessage(status, reconnectAttempt, error)}</span>
      <span className="truncate opacity-80">{host}</span>
    </div>
  )
}
