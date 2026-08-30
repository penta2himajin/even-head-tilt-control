import {
  CONTROL_IDS,
  GESTURE_TYPES,
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

/** @deprecated leftover signature helper */
export type { ImuSample }
