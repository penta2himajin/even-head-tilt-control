import {
  CONTROL_IDS,
  FLAT_CALIB_MS,
  HOLD_ENTER,
  NEUTRAL_BAND,
  NEUTRAL_EMA_ALPHA,
  NOD_PEAK,
  RETURN_SUPPRESS_MS,
  SETTLE_MS,
  SHAKE_PEAK,
  STILL_BEFORE_EMA_MS,
  STILL_EPS,
  MOTION_WINDOW_MS,
  type ControlId,
  type GestureType,
  type HoldGesture,
} from './constants.ts'
import {
  absMax,
  classifyRegion,
  dist,
  fromSample,
  holdFromOffset,
  meanVec,
  sub,
  type GravityCalib,
  type PoseRegion,
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

interface OffsetSample {
  t: number
  dx: number
  dy: number
  dz: number
}

/**
 * Neutral-relative pose machine:
 * - flat calib → g₀ (gravity reference / seed)
 * - slow EMA → n̂ while still in neutral
 * - enter hold emits once; return never emits; oscillate = nod/shake
 */
export class PoseTracker {
  private g0: Vec3 | null = null
  private neutral: Vec3 | null = null
  private phase: PosePhase = 'neutral'
  private heldGesture: HoldGesture | null = null
  private candidate: PoseRegion = 'neutral'
  private candidateSince: number | null = null
  private lastSample: Vec3 | null = null
  private stillSince: number | null = null
  private suppressOscillateUntil = 0
  private offsets: OffsetSample[] = []
  private lastEmitAt = 0

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

  status(now = Date.now()): PoseTrackerStatus {
    const region = this.neutral && this.lastSample
      ? classifyRegion(sub(this.lastSample, this.neutral), NEUTRAL_BAND, HOLD_ENTER)
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
        this.phase = 'neutral'
        this.heldGesture = null
        this.candidate = 'neutral'
        this.candidateSince = null
        this.offsets = []
      }
      this.lastSample = v
      return null
    }

    if (!this.neutral) {
      // Fallback: first still moments seed provisional neutral.
      this.neutral = { ...v }
      this.lastSample = v
      this.stillSince = now
      return null
    }

    const offset = sub(v, this.neutral)
    this.offsets.push({ t: now, dx: offset.x, dy: offset.y, dz: offset.z })
    const cutoff = now - MOTION_WINDOW_MS
    while (this.offsets.length > 0 && this.offsets[0].t < cutoff) {
      this.offsets.shift()
    }

    // Stillness for EMA (neutral only).
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

    const region = classifyRegion(offset, NEUTRAL_BAND, HOLD_ENTER)

    // Candidate settle tracking.
    if (region !== this.candidate) {
      this.candidate = region
      this.candidateSince = now
    }

    const settled =
      this.candidateSince !== null && now - this.candidateSince >= SETTLE_MS

    // --- return: held → neutral ---
    if (this.phase === 'held' && region === 'neutral' && settled) {
      this.phase = 'neutral'
      this.heldGesture = null
      this.suppressOscillateUntil = now + RETURN_SUPPRESS_MS
      this.offsets = []
      return { kind: 'return' }
    }

    // --- enter: neutral → hold ---
    if (this.phase === 'neutral' && region !== 'neutral' && region !== 'motion' && settled) {
      const gesture = region as HoldGesture
      this.phase = 'held'
      this.heldGesture = gesture
      this.offsets = []
      return { kind: 'enter', gesture }
    }

    // --- oscillate while not held (and not in return suppress) ---
    if (this.phase === 'neutral' && now >= this.suppressOscillateUntil) {
      const osc = detectOscillate(this.offsets)
      if (osc) {
        this.offsets = []
        this.candidate = 'neutral'
        this.candidateSince = now
        return { kind: 'oscillate', gesture: osc }
      }
    }

    return null
  }

  /** Reset runtime pose (keep g₀ / n̂). */
  softReset(): void {
    this.phase = 'neutral'
    this.heldGesture = null
    this.candidate = 'neutral'
    this.candidateSince = null
    this.offsets = []
    this.suppressOscillateUntil = 0
    this.stillSince = null
  }
}

function detectOscillate(offsets: OffsetSample[]): 'nod' | 'shake' | null {
  if (offsets.length < 4) return null
  const xs = offsets.map((o) => o.dx)
  const ys = offsets.map((o) => o.dy)
  const xPeak = Math.max(...xs.map((v) => Math.abs(v)))
  const yPeak = Math.max(...ys.map((v) => Math.abs(v)))
  const last = offsets[offsets.length - 1]
  const nearNeutral = absMax({ x: last.dx, y: last.dy, z: last.dz }) <= NEUTRAL_BAND * 1.25

  const yHi = Math.max(...ys)
  const yLo = Math.min(...ys)
  const shakeBoth = yHi >= SHAKE_PEAK * 0.7 && yLo <= -SHAKE_PEAK * 0.7
  if (shakeBoth && yPeak >= SHAKE_PEAK && yPeak >= xPeak * 0.75 && nearNeutral) {
    return 'shake'
  }

  // Nod: one-sided pitch excursion then return to neutral (not a sustained hold).
  const xHi = Math.max(...xs)
  const xLo = Math.min(...xs)
  const nodOneWay = xPeak >= NOD_PEAK && nearNeutral
  const nodBoth = xHi >= NOD_PEAK * 0.45 && xLo <= -NOD_PEAK * 0.45
  if ((nodOneWay || nodBoth) && xPeak >= yPeak && nearNeutral) {
    return 'nod'
  }
  return null
}

/** Classify a binding long-press window with a frozen local neutral. */
export function classifyBindingWindow(samples: ImuSample[]): GestureType | null {
  if (samples.length === 0) return null
  const tracker = new PoseTracker()
  tracker.allowEma = false
  // Seed from the pose at press start only (not the motion that follows).
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

  if (lastOsc) return lastOsc
  if (lastEnter) return lastEnter

  // Fallback: end-of-window hold vs press-start neutral.
  const last = samples[samples.length - 1]
  const offset = sub(fromSample(last), seed)
  return holdFromOffset(offset, HOLD_ENTER * 0.9)
}

export function findControlForGesture(
  bindings: BindingsMap,
  gesture: GestureType,
): ControlId | null {
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