import type { ThreePaneHandle } from '../ThreePaneDisplay'
import type { ProportionThreePaneHandle } from '../ProportionThreePaneDisplay'
import type { SlopeThreePaneHandle } from '../SlopeThreePaneDisplay'

export type PaneHandle =
  | ThreePaneHandle
  | ProportionThreePaneHandle
  | SlopeThreePaneHandle

export function isProportionHandle(
  handle: PaneHandle,
): handle is ProportionThreePaneHandle {
  return 'proportionMode' in handle && handle.proportionMode === true
}

export function isSlopeHandle(
  handle: PaneHandle,
): handle is SlopeThreePaneHandle {
  return 'variableSupport' in handle && handle.variableSupport === 'num_num'
}
