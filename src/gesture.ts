import {
  CONTROL_IDS,
  GESTURE_TYPES,
  LEGACY_GESTURE_MAP,
  type GestureType,
} from './constants.ts'
import type { BindingsMap, ImuSample, PersistedBindings } from './types.ts'
import { emptyBindings } from './types.ts'

export {
  classifyBindingWindow,
  detectHoldExecution,
  detectMotionExecution,
  findControlForGesture,
  PoseTracker,
  type PoseTransition,
  type PoseTrackerStatus,
} from './pose-machine.ts'

function normalizeGestureId(value: unknown): GestureType | null {
  if (typeof value !== 'string') return null
  const mapped = LEGACY_GESTURE_MAP[value] ?? value
  return (GESTURE_TYPES as readonly string[]).includes(mapped)
    ? (mapped as GestureType)
    : null
}

export function parsePersisted(raw: string | null): BindingsMap {
  if (!raw) return emptyBindings()
  try {
    const parsed = JSON.parse(raw) as PersistedBindings
    if (parsed.version !== 1 || !parsed.bindings) return emptyBindings()
    const out = emptyBindings()
    for (const id of CONTROL_IDS) {
      out[id] = normalizeGestureId(parsed.bindings[id])
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

/** @deprecated leftover signature helper */
export type { ImuSample }
