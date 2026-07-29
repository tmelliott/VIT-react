import type { ReactNode } from 'react'
import type { RserveConnectionStatus } from '../lib/rserveConnection'
import {
  RserveConnectionContext,
  type RserveConnectionState,
} from './rserveConnectionContext'

export function RserveConnectionProvider({
  host,
  connectionStatus,
  isReady,
  error,
  reconnectAttempt = 0,
  children,
}: {
  host: string
  connectionStatus: RserveConnectionStatus
  isReady: boolean
  error?: string
  reconnectAttempt?: number
  children: ReactNode
}) {
  const value: RserveConnectionState = {
    host,
    connectionStatus,
    isReady,
    error,
    reconnectAttempt,
  }

  return (
    <RserveConnectionContext.Provider value={value}>
      {children}
    </RserveConnectionContext.Provider>
  )
}
