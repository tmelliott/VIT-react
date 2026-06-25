/** Runtime override injected by deploy/entrypoint.sh (see public/rserve-config.js). */
declare global {
  interface Window {
    __RSERVE_HOST__?: string
  }
}

const LOCAL_DEV_HOST = 'http://127.0.0.1:6311'

/**
 * Rserve WebSocket URL.
 *
 * Resolution order:
 * 1. `window.__RSERVE_HOST__` — set at container startup from `RSERVE_HOST`
 * 2. `VITE_RSERVE_HOST` — Vite/.env at build time (local dev)
 * 3. `http://127.0.0.1:6311`
 */
export function getRserveHost(): string {
  if (typeof window !== 'undefined' && window.__RSERVE_HOST__) {
    return window.__RSERVE_HOST__
  }

  const fromEnv = import.meta.env.VITE_RSERVE_HOST
  if (fromEnv) return fromEnv

  return LOCAL_DEV_HOST
}

export {}
