export const READY_MARKER = '[head-tilt] ready'
export const STORAGE_KEY = 'head-tilt-bindings-v1'

export const CONTROL_IDS = ['tap', 'dbl', 'swipe-up', 'swipe-down'] as const
export type ControlId = (typeof CONTROL_IDS)[number]

export const GESTURE_TYPES = [
  'nod',
  'shake',
  'face-L',
  'face-R',
  'tilt-F',
  'tilt-B',
  'tilt-L',
  'tilt-R',
] as const
export type GestureType = (typeof GESTURE_TYPES)[number]

export const HOLD_MS = 250
export const EXEC_COOLDOWN_MS = 500
export const MOTION_WINDOW_MS = 1500
export const HOLD_THRESHOLD = 12
export const MOTION_THRESHOLD = 8

/** Glasses canvas */
export const W = 576
export const H = 288

export const CONTROL_LABELS: Record<ControlId, string> = {
  tap: 'tap',
  dbl: 'dbl',
  'swipe-up': 'swipe-up',
  'swipe-down': 'swipe-down',
}

export const GESTURE_LABELS: Record<GestureType, string> = {
  nod: 'nod',
  shake: 'shake',
  'face-L': 'face-L',
  'face-R': 'face-R',
  'tilt-F': 'tilt-F',
  'tilt-B': 'tilt-B',
  'tilt-L': 'tilt-L',
  'tilt-R': 'tilt-R',
}
