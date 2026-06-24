import { useContext } from 'react'
import { VitAppContext } from '../context/vitAppContext'
import type { VitWidgetHook } from '../rserve/vit.types'

export function useVitApp(): VitWidgetHook {
  const ctx = useContext(VitAppContext)
  if (!ctx) {
    throw new Error('useVitApp must be used within VitAppProvider')
  }
  return ctx
}
