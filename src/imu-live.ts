/** Live IMU readout for the phone mirror (accel + optional angular rate). */

import type { ImuLiveView } from './types.ts'

const GYRO_KEY_SETS: Array<[string, string, string]> = [
  ['gx', 'gy', 'gz'],
  ['wx', 'wy', 'wz'],
  ['gyroX', 'gyroY', 'gyroZ'],
  ['gyro_x', 'gyro_y', 'gyro_z'],
  ['angularVelocityX', 'angularVelocityY', 'angularVelocityZ'],
  ['angular_velocity_x', 'angular_velocity_y', 'angular_velocity_z'],
  ['omegaX', 'omegaY', 'omegaZ'],
]

function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function pickTriple(
  raw: Record<string, unknown>,
  keys: [string, string, string],
): [number, number, number] | null {
  const a = asNum(raw[keys[0]])
  const b = asNum(raw[keys[1]])
  const c = asNum(raw[keys[2]])
  if (a === null || b === null || c === null) return null
  return [a, b, c]
}

/** Pull accel + any gyro-like fields from Even Hub imuData (or mock). */
export function parseImuLive(rawIn: unknown, t = Date.now()): ImuLiveView {
  const raw =
    rawIn && typeof rawIn === 'object'
      ? (rawIn as Record<string, unknown>)
      : {}
  const rawKeys = Object.keys(raw)
    .filter((k) => asNum(raw[k]) !== null)
    .sort()

  const accel =
    pickTriple(raw, ['x', 'y', 'z']) ??
    pickTriple(raw, ['ax', 'ay', 'az']) ??
    pickTriple(raw, ['accX', 'accY', 'accZ']) ??
    ([0, 0, 0] as [number, number, number])

  let gyro: [number, number, number] | null = null
  for (const keys of GYRO_KEY_SETS) {
    gyro = pickTriple(raw, keys)
    if (gyro) break
  }

  return {
    ax: accel[0],
    ay: accel[1],
    az: accel[2],
    wx: gyro ? gyro[0] : null,
    wy: gyro ? gyro[1] : null,
    wz: gyro ? gyro[2] : null,
    rawKeys,
    t,
  }
}

function fmt(n: number, digits = 3): string {
  const s = n.toFixed(digits)
  return n >= 0 ? ` ${s}` : s
}

export function formatImuLive(live: ImuLiveView | null): {
  accelLine: string
  gyroLine: string
} {
  if (!live) {
    return {
      accelLine: 'accel xyz: —',
      gyroLine: 'gyro ω: —',
    }
  }
  const accelLine = `accel xyz: ${fmt(live.ax)} ${fmt(live.ay)} ${fmt(live.az)}`
  if (live.wx !== null && live.wy !== null && live.wz !== null) {
    return {
      accelLine,
      gyroLine: `gyro  ωxyz: ${fmt(live.wx)} ${fmt(live.wy)} ${fmt(live.wz)}`,
    }
  }
  const keys = live.rawKeys.length > 0 ? live.rawKeys.join(',') : '(none)'
  return {
    accelLine,
    gyroLine: `gyro  ω: n/a (SDK payload keys: ${keys})`,
  }
}
