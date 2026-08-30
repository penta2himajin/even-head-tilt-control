export const READY_MARKER = '[head-tilt] ready'
export const STORAGE_KEY = 'head-tilt-bindings-v1'
export const CALIB_STORAGE_KEY = 'head-tilt-gravity-calib-v1'

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

export const HOLD_GESTURES = [
  'face-L',
  'face-R',
  'tilt-F',
  'tilt-B',
  'tilt-L',
  'tilt-R',
] as const
export type HoldGesture = (typeof HOLD_GESTURES)[number]

export const EXEC_COOLDOWN_MS = 150
export const MOTION_WINDOW_MS = 1500

/** Settle time inside a pose band before enter/return commits. */
export const SETTLE_MS = 280
/** After return-to-neutral, ignore oscillate this long. */
export const RETURN_SUPPRESS_MS = 450

/**
 * G2 IMU = gravity-normalized accel (~1g). Offsets are vs dynamic neutral n̂.
 */
/** |offset| below this ⇒ inside neutral band. */
export const NEUTRAL_BAND = 0.12
/** |offset| above this ⇒ candidate hold pose. */
export const HOLD_ENTER = 0.26
/** Sample-to-sample change below this counts as still (for EMA). */
export const STILL_EPS = 0.035
/** Must be still this long in neutral before n̂ EMA updates. */
export const STILL_BEFORE_EMA_MS = 900
/** EMA alpha when updating n̂ (slow personal zero). */
export const NEUTRAL_EMA_ALPHA = 0.025
/** Flat-desk calib: collect this many ms of samples. */
export const FLAT_CALIB_MS = 2000

/** Min peak |Δx| vs neutral for nod oscillate. */
export const NOD_PEAK = 0.2
/** Min peak |Δy| vs neutral for shake oscillate (bidirectional). */
export const SHAKE_PEAK = 0.07

/** @deprecated */
export const HOLD_MS = SETTLE_MS
/** @deprecated */
export const HOLD_THRESHOLD = HOLD_ENTER
/** @deprecated */
export const MOTION_RETURN = NEUTRAL_BAND
/** @deprecated */
export const MOTION_PEAK = NOD_PEAK

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
