import { useState, type ReactNode } from 'react'

type DockTab = 'dataset' | 'config' | 'animation'

type Slot = (opts: { compact: boolean }) => ReactNode

type ControlPanelDockProps = {
  className?: string
  hasData: boolean
  inferenceActive: boolean
  dataset: Slot
  config: Slot
  progress: () => ReactNode
  animation: Slot
}

const TABS: { id: DockTab; label: string }[] = [
  { id: 'dataset', label: 'Dataset' },
  { id: 'config', label: 'Config' },
  { id: 'animation', label: 'Animation' },
]

function suggestedTab(hasData: boolean, inferenceActive: boolean): DockTab {
  if (inferenceActive) return 'animation'
  if (hasData) return 'config'
  return 'dataset'
}

function isTabVisible(
  id: DockTab,
  hasData: boolean,
  inferenceActive: boolean,
): boolean {
  if (id === 'dataset') return true
  if (id === 'config') return hasData
  return inferenceActive
}

export function ControlPanelDock({
  className = '',
  hasData,
  inferenceActive,
  dataset,
  config,
  progress,
  animation,
}: ControlPanelDockProps) {
  const suggested = suggestedTab(hasData, inferenceActive)
  const [override, setOverride] = useState<DockTab | null>(null)
  const [suggestedSnap, setSuggestedSnap] = useState(suggested)

  if (suggested !== suggestedSnap) {
    setSuggestedSnap(suggested)
    setOverride(null)
  }

  const activeTab =
    override && isTabVisible(override, hasData, inferenceActive)
      ? override
      : suggested

  const visibleTabs = TABS.filter((t) =>
    isTabVisible(t.id, hasData, inferenceActive),
  )

  const mobileContent =
    activeTab === 'dataset' ? (
      dataset({ compact: true })
    ) : activeTab === 'config' ? (
      <>
        {config({ compact: true })}
        {progress()}
      </>
    ) : (
      animation({ compact: true })
    )

  return (
    <aside className={className}>
      {/* Desktop: stacked sidebar */}
      <div className="hidden min-h-0 flex-col gap-4 overflow-y-auto md:flex">
        {dataset({ compact: false })}
        {hasData && config({ compact: false })}
        {hasData && progress()}
        {inferenceActive && animation({ compact: false })}
      </div>

      {/* Mobile: tabbed fixed-height dock */}
      <div className="border-t border-gray-200 bg-gray-50 md:hidden">
        <div
          className="flex border-b border-gray-200"
          role="tablist"
          aria-label="Control panel"
        >
          {visibleTabs.map((tab) => {
            const selected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`flex-1 px-2 py-1.5 text-xs font-medium ${
                  selected
                    ? 'border-b-2 border-blue-600 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setOverride(tab.id)}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        <div
          className="overflow-y-auto px-3 py-2"
          style={{
            height: hasData
              ? 'var(--control-panel-tab-h)'
              : 'var(--control-panel-tab-h-compact)',
          }}
          role="tabpanel"
        >
          {mobileContent}
        </div>
      </div>
    </aside>
  )
}
