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
  children,
}: {
  host: string
  connectionStatus: RserveConnectionStatus
  isReady: boolean
  error?: string
  children: ReactNode
}) {
  const value: RserveConnectionState = {
    host,
    connectionStatus,
    isReady,
    error,
  }

  return (
    <RserveConnectionContext.Provider value={value}>
      {children}
    </RserveConnectionContext.Provider>
  )
}
