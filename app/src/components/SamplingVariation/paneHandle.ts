import type { ThreePaneHandle } from '../ThreePaneDisplay'
import type { ProportionThreePaneHandle } from '../ProportionThreePaneDisplay'

export type PaneHandle = ThreePaneHandle | ProportionThreePaneHandle

export function isProportionHandle(
  handle: PaneHandle,
): handle is ProportionThreePaneHandle {
  return 'proportionMode' in handle && handle.proportionMode === true
}
