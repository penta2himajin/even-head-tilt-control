import {
  CONTROL_IDS,
  GESTURE_TYPES,
  type ControlId,
  type GestureType,
} from './constants.ts'
import type { BindingsMap, ImuSample, PersistedBindings } from './types.ts'
import { emptyBindings } from './types.ts'

type Axis = 'x' | 'y' | 'z'

interface AxisPeak {
  axis: Axis
  value: number
}

function delta(sample: ImuSample, baseline: ImuSample): ImuSample {
  return {
    x: sample.x - baseline.x,
    y: sample.y - baseline.y,
    z: sample.z - baseline.z,
    t: sample.t,
  }
}

function peaks(sample: ImuSample): AxisPeak[] {
  return (
    [
      { axis: 'x' as const, value: sample.x },
      { axis: 'y' as const, value: sample.y },
      { axis: 'z' as const, value: sample.z },
    ] as AxisPeak[]
  ).sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
}

function holdFromPeak(peak: AxisPeak): GestureType | null {
  const { axis, value } = peak
  const sign = Math.sign(value)
  if (Math.abs(value) < 8) return null

  if (axis === 'y') {
    return sign >= 0 ? 'face-R' : 'face-L'
  }
  if (axis === 'z') {
    return sign >= 0 ? 'tilt-F' : 'tilt-B'
  }
  return sign >= 0 ? 'tilt-R' : 'tilt-L'
}

function detectMotion(samples: ImuSample[], baseline: ImuSample): GestureType | null {
  if (samples.length < 3) return null

  const deltas = samples.map((s) => delta(s, baseline))
  const yaw = deltas.map((d) => d.y)
  const pitch = deltas.map((d) => d.z)

  const yawSwing = Math.max(...yaw) - Math.min(...yaw)
  const pitchSwing = Math.max(...pitch) - Math.min(...pitch)

  const yawCrosses =
    Math.max(...yaw) > 8 &&
    Math.min(...yaw) < -8 &&
    yawSwing >= 16
  const pitchCrosses =
    Math.max(...pitch) > 8 &&
    Math.min(...pitch) < -8 &&
    pitchSwing >= 16

  if (yawCrosses && yawSwing >= pitchSwing) return 'shake'
  if (pitchCrosses) return 'nod'
  return null
}

/** Classify a binding window (long-press samples). */
export function classifyBindingWindow(samples: ImuSample[]): GestureType | null {
  if (samples.length === 0) return null
  const baseline = samples[0]
  const motion = detectMotion(samples, baseline)
  if (motion) return motion

  const last = delta(samples[samples.length - 1], baseline)
  const peak = peaks(last)[0]
  return holdFromPeak(peak)
}

/** Hold execution: true when delta stays above threshold long enough. */
export function detectHoldExecution(
  sample: ImuSample,
  baseline: ImuSample,
  heldSince: number | null,
  now: number,
  holdMs: number,
  threshold: number,
): { gesture: GestureType | null; heldSince: number | null } {
  const d = delta(sample, baseline)
  const peak = peaks(d)[0]
  if (Math.abs(peak.value) < threshold) {
    return { gesture: null, heldSince: null }
  }

  const nextHeld = heldSince ?? now
  if (now - nextHeld < holdMs) {
    return { gesture: null, heldSince: nextHeld }
  }

  return { gesture: holdFromPeak(peak), heldSince: null }
}

/** Motion execution over a rolling buffer. */
export function detectMotionExecution(samples: ImuSample[]): GestureType | null {
  if (samples.length < 3) return null
  const baseline = samples[0]
  return detectMotion(samples, baseline)
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

export function parsePersisted(raw: string | null): BindingsMap {
  if (!raw) return emptyBindings()
  try {
    const parsed = JSON.parse(raw) as PersistedBindings
    if (parsed.version !== 1 || !parsed.bindings) return emptyBindings()
    const out = emptyBindings()
    for (const id of CONTROL_IDS) {
      const g = parsed.bindings[id]
      out[id] = g && GESTURE_TYPES.includes(g) ? g : null
    }
    return out
  } catch {
    return emptyBindings()
  }
}

export function serializeBindings(bindings: BindingsMap): string {
  const payload: PersistedBindings = { version: 1, bindings }
  return JSON.stringify(payload)
}

export function isGestureType(value: string): value is GestureType {
  return (GESTURE_TYPES as readonly string[]).includes(value)
}
