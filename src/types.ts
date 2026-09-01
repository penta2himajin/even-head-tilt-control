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

export interface ImuLiveView {
  ax: number
  ay: number
  az: number
  wx: number | null
  wy: number | null
  wz: number | null
  rawKeys: string[]
  t: number
}

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
  /** Phone UI: latest IMU sample under pose (null until first report) */
  imuLive: ImuLiveView | null
}

export function emptyBindings(): BindingsMap {
  return {
    tap: null,
    dbl: null,
    'swipe-up': null,
    'swipe-down': null,
  }
}
