import type { HoldGesture } from './constants.ts'
import type { ImuSample } from './types.ts'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export type PoseRegion = 'neutral' | HoldGesture | 'motion'

export interface GravityCalib {
  g0: Vec3
  at: number
}

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z }
}

export function fromSample(s: ImuSample): Vec3 {
  return { x: s.x, y: s.y, z: s.z }
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

export function scale(a: Vec3, k: number): Vec3 {
  return { x: a.x * k, y: a.y * k, z: a.z * k }
}

export function absMax(v: Vec3): number {
  return Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z))
}

export function dist(a: Vec3, b: Vec3): number {
  return absMax(sub(a, b))
}

export function meanVec(samples: Vec3[]): Vec3 {
  const n = samples.length || 1
  let x = 0
  let y = 0
  let z = 0
  for (const s of samples) {
    x += s.x
    y += s.y
    z += s.z
  }
  return { x: x / n, y: y / n, z: z / n }
}

/**
 * Map offset-from-neutral to a hold pose using dominant axis.
 * Device rest ≈ gravity on z; pitch→x, turn/yaw lean→y, roll→z.
 */
export function holdFromOffset(offset: Vec3, enter: number): HoldGesture | null {
  const ax = Math.abs(offset.x)
  const ay = Math.abs(offset.y)
  const az = Math.abs(offset.z)
  const peak = Math.max(ax, ay, az)
  if (peak < enter) return null

  if (ay >= ax && ay >= az) {
    return offset.y >= 0 ? 'turn-R' : 'turn-L'
  }
  if (ax >= ay && ax >= az) {
    return offset.x < 0 ? 'tilt-F' : 'tilt-B'
  }
  return offset.z >= 0 ? 'tilt-R' : 'tilt-L'
}

export function classifyRegion(
  offset: Vec3,
  neutralBand: number,
  holdEnter: number,
): PoseRegion {
  const mag = absMax(offset)
  if (mag <= neutralBand) return 'neutral'
  const hold = holdFromOffset(offset, holdEnter)
  if (hold) return hold
  return 'motion'
}

export function parseGravityCalib(raw: string | null): GravityCalib | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as GravityCalib
    if (
      !parsed?.g0 ||
      typeof parsed.g0.x !== 'number' ||
      typeof parsed.g0.y !== 'number' ||
      typeof parsed.g0.z !== 'number'
    ) {
      return null
    }
    return { g0: parsed.g0, at: parsed.at ?? Date.now() }
  } catch {
    return null
  }
}

export function serializeGravityCalib(calib: GravityCalib): string {
  return JSON.stringify(calib)
}
