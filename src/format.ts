import {
  CONTROL_IDS,
  CONTROL_LABELS,
  GESTURE_LABELS,
  READY_MARKER,
  type ControlId,
  type GestureType,
} from './constants.ts'
import type { BindingsMap } from './types.ts'
import type { PoseTrackerStatus } from './gesture.ts'

export { READY_MARKER }

/** Pad control / bind id so `status:` stays at a fixed column on the glasses title. */
export const GLASSES_TITLE_FIELD_WIDTH = 10

function padTitleField(label: string): string {
  return label.padEnd(GLASSES_TITLE_FIELD_WIDTH)
}

/** Live pose for the title — uses current region, not committed hold phase. */
export function formatStatusLabel(status: PoseTrackerStatus): string {
  if (status.flatCalibActive) return 'calibrating'
  if (status.region !== 'neutral' && status.region !== 'motion') {
    return `in-pose (${status.region})`
  }
  return 'neutral'
}

export function formatGlassesTitleLine(snapshot: {
  mode: 'idle' | 'binding'
  bindingControl: ControlId | null
  logs: { control: ControlId }[]
  statusLabel: string
}): string {
  const status = `status: ${snapshot.statusLabel}`
  if (snapshot.mode === 'binding' && snapshot.bindingControl) {
    return `Bind: ${padTitleField(snapshot.bindingControl)} / ${status}`
  }
  const last = snapshot.logs.at(-1)
  const control = last ? CONTROL_LABELS[last.control] : '—'
  return `control: ${padTitleField(control)} / ${status}`
}

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
