import { useRserve } from '@tmelliott/react-rserve'
import vitAppSchema from '../rserve/vit.rserve'
import { normalizeRserveConnection } from '../lib/rserveConnection'

export function useVitRserve(host: string) {
  const raw = useRserve(vitAppSchema, { host })
  return normalizeRserveConnection(raw)
}
