export type RserveConnectionStatus = 'connected' | 'connecting' | 'disconnected'

/** Normalise npm vs local `useRserve` return shapes (published 0.10.2 uses `loading`). */
export function normalizeRserveConnection(raw: {
  app?: unknown
  loading?: boolean
  error?: string
  connectionStatus?: RserveConnectionStatus
  everConnected?: boolean
  reconnectAttempt?: number
}) {
  const connectionStatus: RserveConnectionStatus =
    raw.connectionStatus ??
    (raw.loading
      ? 'connecting'
      : raw.app
        ? 'connected'
        : raw.error
          ? 'disconnected'
          : 'connecting')

  return {
    app: raw.app,
    error: raw.error,
    connectionStatus,
    everConnected: raw.everConnected ?? !!raw.app,
    reconnectAttempt: raw.reconnectAttempt ?? 0,
  }
}
