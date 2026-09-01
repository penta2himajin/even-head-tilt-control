import {
  CONTROL_IDS,
  FLAT_CALIB_MS,
  HOLD_ENTER,
  isAssignableGesture,
  NEUTRAL_BAND,
  NEUTRAL_EMA_ALPHA,
  NOD_PEAK,
  REACH_WINDOW_MS,
  RETURN_SUPPRESS_MS,
  SETTLE_MS,
  STILL_BEFORE_EMA_MS,
  STILL_EPS,
  type ControlId,
  type GestureType,
  type HoldGesture,
} from './constants.ts'
import {
  absMax,
  dist,
  fromSample,
  holdFromOffset,
  meanVec,
  reachZone,
  sub,
  type GravityCalib,
  type PoseRegion,
  type ReachZone,
  type Vec3,
} from './pose.ts'
import type { BindingsMap, ImuSample } from './types.ts'

export type PosePhase = 'neutral' | 'held'

export type PoseTransition =
  | { kind: 'enter'; gesture: HoldGesture }
  | { kind: 'return' }
  | { kind: 'oscillate'; gesture: 'nod' | 'shake' }

export interface PoseTrackerStatus {
  phase: PosePhase
  region: PoseRegion
  heldGesture: HoldGesture | null
  hasG0: boolean
  hasNeutral: boolean
  flatCalibActive: boolean
  suppressOscillateUntil: number
}

function isHoldZone(zone: ReachZone): zone is HoldGesture {
  return zone !== 'neutral' && zone !== 'motion'
}

/**
 * Neutral-relative pose machine (accel only — see SENSING in constants):
 * - flat calib → g₀; slow EMA → n̂ while still in neutral
 * - reach edge opens a window (REACH_WINDOW_MS)
 *   - neutral return inside window → oscillate (tilt-F → nod)
 *   - still at reach when window ends → hold (enter)
 * - held → neutral (settled) → return (silent)
 */
export class PoseTracker {
  private g0: Vec3 | null = null
  private neutral: Vec3 | null = null
  private phase: PosePhase = 'neutral'
  private heldGesture: HoldGesture | null = null
  private lastSample: Vec3 | null = null
  private stillSince: number | null = null
  private suppressOscillateUntil = 0
  private lastZone: ReachZone = 'neutral'
  private neutralSince: number | null = null

  private windowStart: number | null = null
  private windowGesture: HoldGesture | null = null
  private windowMaxForward = 0
  private windowMaxBack = 0
  private windowMaxY = 0

  private switchStart: number | null = null
  private switchGesture: HoldGesture | null = null

  private flatCollecting = false
  private flatStartedAt = 0
  private flatBuf: Vec3[] = []

  /** Optional: freeze EMA (binding windows). */
  allowEma = true

  constructor(calib?: GravityCalib | null) {
    if (calib?.g0) {
      this.g0 = { ...calib.g0 }
      this.neutral = { ...calib.g0 }
    }
  }

  getGravityCalib(): GravityCalib | null {
    if (!this.g0) return null
    return { g0: { ...this.g0 }, at: Date.now() }
  }

  loadCalib(calib: GravityCalib | null): void {
    if (!calib?.g0) return
    this.g0 = { ...calib.g0 }
    if (!this.neutral) this.neutral = { ...calib.g0 }
  }

  startFlatCalib(now = Date.now()): void {
    this.flatCollecting = true
    this.flatStartedAt = now
    this.flatBuf = []
  }

  cancelFlatCalib(): void {
    this.flatCollecting = false
    this.flatBuf = []
  }

  isFlatCalibActive(): boolean {
    return this.flatCollecting
  }

  status(_now = Date.now()): PoseTrackerStatus {
    const region = this.neutral && this.lastSample
      ? reachZone(sub(this.lastSample, this.neutral), NEUTRAL_BAND, HOLD_ENTER)
      : 'neutral'
    return {
      phase: this.phase,
      region,
      heldGesture: this.heldGesture,
      hasG0: !!this.g0,
      hasNeutral: !!this.neutral,
      flatCalibActive: this.flatCollecting,
      suppressOscillateUntil: this.suppressOscillateUntil,
    }
  }

  /**
   * Feed one IMU sample. Returns at most one transition to emit.
   */
  push(sample: ImuSample): PoseTransition | null {
    const v = fromSample(sample)
    const now = sample.t

    if (this.flatCollecting) {
      this.flatBuf.push(v)
      if (now - this.flatStartedAt >= FLAT_CALIB_MS && this.flatBuf.length >= 3) {
        this.g0 = meanVec(this.flatBuf)
        this.neutral = { ...this.g0 }
        this.flatCollecting = false
        this.flatBuf = []
        this.resetRuntime()
      }
      this.lastSample = v
      return null
    }

    if (!this.neutral) {
      this.neutral = { ...v }
      this.lastSample = v
      this.stillSince = now
      return null
    }

    const offset = sub(v, this.neutral)

    if (this.lastSample) {
      const step = dist(v, this.lastSample)
      if (step <= STILL_EPS) {
        this.stillSince = this.stillSince ?? now
      } else {
        this.stillSince = null
      }
    }
    this.lastSample = v

    if (
      this.allowEma &&
      this.phase === 'neutral' &&
      this.windowStart === null &&
      this.stillSince !== null &&
      now - this.stillSince >= STILL_BEFORE_EMA_MS &&
      absMax(offset) <= NEUTRAL_BAND
    ) {
      const a = NEUTRAL_EMA_ALPHA
      this.neutral = {
        x: this.neutral.x * (1 - a) + v.x * a,
        y: this.neutral.y * (1 - a) + v.y * a,
        z: this.neutral.z * (1 - a) + v.z * a,
      }
    }

    const zone = reachZone(offset, NEUTRAL_BAND, HOLD_ENTER)
    if (zone === 'neutral') {
      this.neutralSince = this.neutralSince ?? now
    } else {
      this.neutralSince = null
    }

    let transition: PoseTransition | null = null

    if (this.phase === 'held' && this.heldGesture !== null) {
      transition = this.handleHeldPhase(zone, now)
    } else if (this.phase === 'neutral') {
      transition = this.handleNeutralPhase(zone, now, offset)
    }

    this.lastZone = zone
    return transition
  }

  /**
   * End of a binding sample stream: if still at reach inside an open window,
   * commit hold (window did not expire naturally before release).
   */
  flushReachWindow(sample: ImuSample): PoseTransition | null {
    if (this.windowStart === null || !this.neutral) return null
    const zone = reachZone(sub(fromSample(sample), this.neutral), NEUTRAL_BAND, HOLD_ENTER)
    if (!isHoldZone(zone) || zone !== this.windowGesture) {
      this.closeReachWindow()
      return null
    }
    const gesture = zone
    this.closeReachWindow()
    this.phase = 'held'
    this.heldGesture = gesture
    return { kind: 'enter', gesture }
  }

  softReset(): void {
    this.resetRuntime()
  }

  private resetRuntime(): void {
    this.phase = 'neutral'
    this.heldGesture = null
    this.closeReachWindow()
    this.switchStart = null
    this.switchGesture = null
    this.suppressOscillateUntil = 0
    this.stillSince = null
    this.lastZone = 'neutral'
    this.neutralSince = null
  }

  private closeReachWindow(): void {
    this.windowStart = null
    this.windowGesture = null
    this.windowMaxForward = 0
    this.windowMaxBack = 0
    this.windowMaxY = 0
  }

  private trackWindowPeaks(offset: Vec3): void {
    const forward = -Math.min(0, offset.x)
    const back = Math.max(0, offset.x)
    const yPeak = Math.abs(offset.y)
    this.windowMaxForward = Math.max(this.windowMaxForward, forward)
    this.windowMaxBack = Math.max(this.windowMaxBack, back)
    this.windowMaxY = Math.max(this.windowMaxY, yPeak)
  }

  private nodOscillateAllowed(): boolean {
    return (
      this.windowMaxForward >= NOD_PEAK &&
      this.windowMaxBack < NOD_PEAK * 0.45 &&
      this.windowMaxForward >= this.windowMaxY
    )
  }

  private handleNeutralPhase(zone: ReachZone, now: number, offset: Vec3): PoseTransition | null {
    if (this.windowStart === null) {
      if (
        now >= this.suppressOscillateUntil &&
        isHoldZone(zone) &&
        !isHoldZone(this.lastZone)
      ) {
        this.windowStart = now
        this.windowGesture = zone
        this.windowMaxForward = 0
        this.windowMaxBack = 0
        this.windowMaxY = 0
        this.trackWindowPeaks(offset)
      }
      return null
    }

    const gesture = this.windowGesture!
    if (zone === 'neutral') {
      const osc =
        gesture === 'tilt-F' && this.nodOscillateAllowed()
          ? ('nod' as const)
          : null
      this.closeReachWindow()
      return osc ? { kind: 'oscillate', gesture: osc } : null
    }

    this.trackWindowPeaks(offset)

    if (now - this.windowStart >= REACH_WINDOW_MS && zone === gesture) {
      this.closeReachWindow()
      this.phase = 'held'
      this.heldGesture = gesture
      return { kind: 'enter', gesture }
    }

    if (isHoldZone(zone) && zone !== gesture) {
      this.windowStart = now
      this.windowGesture = zone
      // Keep peak stats across in-window axis changes (reject F/B reciprocation nod).
    }

    return null
  }

  private handleHeldPhase(zone: ReachZone, now: number): PoseTransition | null {
    const held = this.heldGesture!

    if (isHoldZone(zone) && zone !== held) {
      if (this.switchGesture !== zone) {
        this.switchStart = now
        this.switchGesture = zone
      } else if (
        this.switchStart !== null &&
        now - this.switchStart >= REACH_WINDOW_MS &&
        zone === this.switchGesture
      ) {
        this.switchStart = null
        this.switchGesture = null
        this.heldGesture = zone
        return { kind: 'enter', gesture: zone }
      }
    } else if (!isHoldZone(zone)) {
      this.switchStart = null
      this.switchGesture = null
    }

    if (
      zone === 'neutral' &&
      this.neutralSince !== null &&
      now - this.neutralSince >= SETTLE_MS
    ) {
      this.phase = 'neutral'
      this.heldGesture = null
      this.switchStart = null
      this.switchGesture = null
      this.suppressOscillateUntil = now + RETURN_SUPPRESS_MS
      return { kind: 'return' }
    }

    return null
  }
}

/** Classify a binding long-press window with a frozen local neutral. */
export function classifyBindingWindow(samples: ImuSample[]): GestureType | null {
  if (samples.length === 0) return null
  const tracker = new PoseTracker()
  tracker.allowEma = false
  const seed = fromSample(samples[0])
  tracker.loadCalib({ g0: seed, at: samples[0].t })

  let lastEnter: HoldGesture | null = null
  let lastOsc: 'nod' | 'shake' | null = null

  for (const s of samples) {
    const ev = tracker.push(s)
    if (!ev) continue
    if (ev.kind === 'enter') lastEnter = ev.gesture
    if (ev.kind === 'oscillate') lastOsc = ev.gesture
  }

  const flushed = tracker.flushReachWindow(samples[samples.length - 1])
  if (flushed?.kind === 'enter') lastEnter = flushed.gesture
  if (flushed?.kind === 'oscillate') lastOsc = flushed.gesture

  if (lastOsc && isAssignableGesture(lastOsc)) return lastOsc
  if (lastEnter && isAssignableGesture(lastEnter)) return lastEnter

  const last = samples[samples.length - 1]
  const offset = sub(fromSample(last), seed)
  const hold = holdFromOffset(offset, HOLD_ENTER * 0.9)
  return hold && isAssignableGesture(hold) ? hold : null
}

export function findControlForGesture(
  bindings: BindingsMap,
  gesture: GestureType,
): ControlId | null {
  if (!isAssignableGesture(gesture)) return null
  for (const id of CONTROL_IDS) {
    if (bindings[id] === gesture) return id
  }
  return null
}

/** @deprecated — kept for older call sites; prefer PoseTracker. */
export function detectMotionExecution(samples: ImuSample[]): GestureType | null {
  return classifyBindingWindow(samples)
}

/** @deprecated */
export function detectHoldExecution(
  sample: ImuSample,
  baseline: ImuSample,
  heldSince: number | null,
  now: number,
  _holdMs: number,
  threshold: number,
): { gesture: GestureType | null; heldSince: number | null } {
  const offset = sub(fromSample(sample), fromSample(baseline))
  const hold = holdFromOffset(offset, threshold)
  if (!hold) return { gesture: null, heldSince: null }
  const next = heldSince ?? now
  if (now - next < SETTLE_MS) return { gesture: null, heldSince: next }
  return { gesture: hold, heldSince: null }
}
