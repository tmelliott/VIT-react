/** Layout constants shared between ThreePaneDisplay and animation code. */
export const PANE = { DATA: 0, SAMPLE: 1, DIST: 2 } as const

export type PaneLayout = {
  marginLeft: number
  plotTop: number
  paneHeight: number
  innerWidth: number
}

export function paneOrigin(layout: PaneLayout, paneIndex: number) {
  return {
    x: layout.marginLeft,
    y: paneIndex * layout.paneHeight + layout.plotTop,
  }
}

/** Local plot coords → absolute SVG coords (single coordinate system for all panes). */
export function toAbsolute(
  layout: PaneLayout,
  paneIndex: number,
  localX: number,
  localY: number,
) {
  const origin = paneOrigin(layout, paneIndex)
  return { x: origin.x + localX, y: origin.y + localY }
}

/** Absolute SVG coords → local plot coords for a pane. */
export function toLocal(
  layout: PaneLayout,
  paneIndex: number,
  absX: number,
  absY: number,
) {
  const origin = paneOrigin(layout, paneIndex)
  return { x: absX - origin.x, y: absY - origin.y }
}
