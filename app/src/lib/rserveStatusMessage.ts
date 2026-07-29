import type { RserveConnectionStatus } from './rserveConnection'

export function rserveStatusMessage(
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
