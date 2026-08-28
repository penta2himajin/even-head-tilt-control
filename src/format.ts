import {
  CONTROL_IDS,
  CONTROL_LABELS,
  GESTURE_LABELS,
  READY_MARKER,
  type ControlId,
  type GestureType,
} from './constants.ts'
import type { BindingsMap } from './types.ts'

export { READY_MARKER }

export function controlIdFromIndex(index: number): ControlId {
  return CONTROL_IDS[index] ?? 'tap'
}

export function formatBindingSuffix(gesture: GestureType | null): string {
  if (!gesture) return '(none)'
  return GESTURE_LABELS[gesture]
}

export function formatListItem(
  control: ControlId,
  gesture: GestureType | null,
  opts: { focused: boolean; recording: boolean },
): string {
  const prefix = opts.focused ? '> ' : '  '
  const bind = formatBindingSuffix(gesture)
  const rec = opts.recording ? ' …rec' : ''
  const label = CONTROL_LABELS[control]
  return `${prefix}${label} → ${bind}${rec}`
}

export function formatListItems(
  bindings: BindingsMap,
  focusedIndex: number,
  bindingControl: ControlId | null,
): string[] {
  return CONTROL_IDS.map((id, index) =>
    formatListItem(id, bindings[id], {
      focused: index === focusedIndex,
      recording: bindingControl === id,
    }),
  )
}

export function formatControlLogLine(
  control: ControlId,
  gesture: GestureType,
  at: number,
): string {
  const time = new Date(at).toISOString().slice(11, 19)
  return `${time} control: ${CONTROL_LABELS[control]} (via ${GESTURE_LABELS[gesture]})`
}
