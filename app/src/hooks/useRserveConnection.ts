import { useContext } from 'react'
import { RserveConnectionContext } from '../context/rserveConnectionContext'

export function useRserveConnection() {
  const ctx = useContext(RserveConnectionContext)
  if (!ctx) {
    throw new Error(
      'useRserveConnection must be used within RserveConnectionProvider',
    )
  }
  return ctx
}
