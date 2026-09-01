export const READY_MARKER = '[head-tilt] ready'
export const STORAGE_KEY = 'head-tilt-bindings-v1'
export const CALIB_STORAGE_KEY = 'head-tilt-gravity-calib-v1'

export const CONTROL_IDS = ['tap', 'dbl', 'swipe-up', 'swipe-down'] as const
export type ControlId = (typeof CONTROL_IDS)[number]

export const GESTURE_TYPES = [
  'nod',
  'shake',
  'turn-L',
  'turn-R',
  'tilt-F',
  'tilt-B',
  'tilt-L',
  'tilt-R',
] as const
export type GestureType = (typeof GESTURE_TYPES)[number]

/**
 * Hub SDK sensing today: gravity-normalized accel only.
 * No magnetometer / reliable gyro → yaw (heading) is unavailable.
 * Keep yaw gesture ids in GESTURE_TYPES for forward compatibility, but do not
 * bind or emit them until heading input exists.
 */
export const SENSING = {
  accel: true,
  /** Angular rate — not in official Hub imuData today. */
  gyro: false,
  /** Geomagnetic / compass — not exposed to plugins today. */
  mag: false,
} as const

/** Gestures bindable + executable with accel-only sensing. */
export const ASSIGNABLE_GESTURES = [
  'nod',
  'tilt-F',
  'tilt-B',
  'tilt-L',
  'tilt-R',
] as const
export type AssignableGesture = (typeof ASSIGNABLE_GESTURES)[number]

/**
 * Yaw-axis gestures: reserved until gyro and/or mag reach the plugin.
 * shake was an interim roll (y) reciprocation proxy — disabled, not deleted.
 */
export const YAW_PENDING_GESTURES = ['shake', 'turn-L', 'turn-R'] as const

export const HOLD_GESTURES = [
  'turn-L',
  'turn-R',
  'tilt-F',
  'tilt-B',
  'tilt-L',
  'tilt-R',
] as const
export type HoldGesture = (typeof HOLD_GESTURES)[number]

/** Hold poses that accel can classify today (no yaw turns). */
export const ASSIGNABLE_HOLD_GESTURES = [
  'tilt-F',
  'tilt-B',
  'tilt-L',
  'tilt-R',
] as const

/** Old persisted ids → current (bindings v1). */
export const LEGACY_GESTURE_MAP: Record<string, GestureType> = {
  'face-L': 'tilt-L',
  'face-R': 'tilt-R',
  // Accel y-axis was briefly named turn-* but is physical roll / tilt-L/R.
  'turn-L': 'tilt-L',
  'turn-R': 'tilt-R',
}

export function isAssignableGesture(value: string): value is AssignableGesture {
  return (ASSIGNABLE_GESTURES as readonly string[]).includes(value)
}

export const EXEC_COOLDOWN_MS = 150
/** Reach window: hold vs oscillate decided inside this span from first reach. */
export const REACH_WINDOW_MS = 600
export const MOTION_WINDOW_MS = 1500

/** Settle time in neutral before held→return commits (hysteresis). */
export const SETTLE_MS = 280
/**
 * @deprecated Hold enter uses REACH_WINDOW_MS dwell, not stillness.
 */
export const STILL_HOLD_MS = 120
/** After return-to-neutral, ignore oscillate briefly (offsets already cleared). */
export const RETURN_SUPPRESS_MS = 100

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

/** Min forward (tilt-F, −x) peak vs neutral for nod: neutral↔tilt-F only. */
export const NOD_PEAK = 0.2
/**
 * Min |peak| on each yaw side for true shake (turn-L↔turn-R).
 * Unused while SENSING.gyro/mag are false; kept for the yaw-enabled path.
 */
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
  'turn-L': 'turn-L',
  'turn-R': 'turn-R',
  'tilt-F': 'tilt-F',
  'tilt-B': 'tilt-B',
  'tilt-L': 'tilt-L',
  'tilt-R': 'tilt-R',
}
