import type { ControlId, GestureType } from './constants.ts'

export interface ImuSample {
  x: number
  y: number
  z: number
  t: number
}

export type BindingsMap = Record<ControlId, GestureType | null>

export interface PersistedBindings {
  version: 1
  bindings: BindingsMap
}

export interface ControlLogEntry {
  at: number
  control: ControlId
  gesture: GestureType
}

export type AppMode = 'idle' | 'binding'

export interface AppSnapshot {
  bindings: BindingsMap
  focusedIndex: number
  mode: AppMode
  bindingControl: ControlId | null
  logs: ControlLogEntry[]
  /** Phone UI: pose / calib debug line */
  poseStatus: string
  /** Glasses title + user-facing pose label (neutral | in-pose (tilt-F) | …) */
  statusLabel: string
}

export function emptyBindings(): BindingsMap {
  return {
    tap: null,
    dbl: null,
    'swipe-up': null,
    'swipe-down': null,
  }
}
