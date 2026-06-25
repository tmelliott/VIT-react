import { createContext } from 'react'
import type { RserveConnectionStatus } from '../lib/rserveConnection'

export type RserveConnectionState = {
  host: string
  connectionStatus: RserveConnectionStatus
  isReady: boolean
  error?: string
}

export const RserveConnectionContext =
  createContext<RserveConnectionState | null>(null)
