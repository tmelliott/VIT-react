import { createContext } from 'react'
import type { VitWidgetHook } from '../rserve/vit.types'

export const VitAppContext = createContext<VitWidgetHook | null>(null)
