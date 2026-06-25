import { useEffect, useRef, useState } from 'react'
import { useRserve } from '@tmelliott/react-rserve'
import vitAppSchema from './rserve/vit.rserve'
import type { VitAppShape } from './rserve/vit.types'
import { VitAppProvider } from './context/VitAppProvider'
import { RserveConnectionProvider } from './context/RserveConnectionProvider'
import { AppRouter } from './AppRouter'
import { RserveStatusBar } from './components/RserveStatusBar'
import { RserveDisconnectOverlay } from './components/RserveDisconnectOverlay'
import { getRserveHost } from './lib/rserveHost'

export function VitWidget() {
  const rserveHost = getRserveHost()

  const {
    app,
    connectionStatus,
    everConnected,
    reconnectAttempt,
    error,
  } = useRserve(vitAppSchema, {
    host: rserveHost,
  })

  const shouldReloadAfterReconnect = useRef(false)
  const [pendingReload, setPendingReload] = useState(false)

  useEffect(() => {
    if (everConnected && connectionStatus === 'disconnected') {
      shouldReloadAfterReconnect.current = true
      setPendingReload(true)
    }
    if (
      shouldReloadAfterReconnect.current &&
      connectionStatus === 'connected'
    ) {
      window.location.reload()
    }
  }, [connectionStatus, everConnected])

  const isReady = connectionStatus === 'connected' && !!app
  const showOverlay =
    pendingReload || (everConnected && connectionStatus !== 'connected')

  const appShell = app ? (
    <VitAppProvider app={app as VitAppShape}>
      <AppRouter />
    </VitAppProvider>
  ) : (
    <AppRouter />
  )

  return (
    <RserveConnectionProvider
      host={rserveHost}
      connectionStatus={connectionStatus}
      isReady={isReady}
      error={error}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div
          className="relative flex min-h-0 flex-1 flex-col"
          {...(showOverlay ? { inert: true } : {})}
        >
          {appShell}
        </div>
        {showOverlay ? <RserveDisconnectOverlay /> : null}
        <RserveStatusBar
          status={connectionStatus}
          host={rserveHost}
          error={error}
          reconnectAttempt={reconnectAttempt}
        />
      </div>
    </RserveConnectionProvider>
  )
}
