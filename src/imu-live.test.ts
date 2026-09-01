import { describe, expect, it } from 'vitest'
import { formatImuLive, parseImuLive } from './imu-live.ts'

describe('parseImuLive', () => {
  it('reads accel xyz from Hub-style imuData', () => {
    const live = parseImuLive({ x: 0.1, y: -0.2, z: 0.98 }, 1000)
    expect(live.ax).toBeCloseTo(0.1)
    expect(live.ay).toBeCloseTo(-0.2)
    expect(live.az).toBeCloseTo(0.98)
    expect(live.wx).toBeNull()
    expect(live.wy).toBeNull()
    expect(live.wz).toBeNull()
    expect(live.rawKeys).toEqual(['x', 'y', 'z'])
    expect(live.t).toBe(1000)
  })

  it('picks gyro-like triples when present (gx/gy/gz)', () => {
    const live = parseImuLive({
      x: 0,
      y: 0,
      z: 1,
      gx: 0.01,
      gy: -0.02,
      gz: 0.03,
    })
    expect(live.wx).toBeCloseTo(0.01)
    expect(live.wy).toBeCloseTo(-0.02)
    expect(live.wz).toBeCloseTo(0.03)
  })

  it('accepts wx/wy/wz as angular rate aliases', () => {
    const live = parseImuLive({ x: 0, y: 0, z: 1, wx: 1, wy: 2, wz: 3 })
    expect(live.wx).toBe(1)
    expect(live.wy).toBe(2)
    expect(live.wz).toBe(3)
  })
})

describe('formatImuLive', () => {
  it('shows placeholders when no sample yet', () => {
    expect(formatImuLive(null)).toEqual({
      accelLine: 'accel xyz: —',
      gyroLine: 'gyro ω: —',
    })
  })

  it('shows accel and n/a gyro with discovered keys when gyro absent', () => {
    const live = parseImuLive({ x: 0.12, y: -0.34, z: 0.95 })
    const lines = formatImuLive(live)
    expect(lines.accelLine).toMatch(/accel xyz:/)
    expect(lines.accelLine).toContain('0.120')
    expect(lines.accelLine).toContain('-0.340')
    expect(lines.accelLine).toContain('0.950')
    expect(lines.gyroLine).toContain('n/a')
    expect(lines.gyroLine).toContain('x,y,z')
  })

  it('shows gyro ω when angular rate is present', () => {
    const live = parseImuLive({
      x: 0,
      y: 0,
      z: 1,
      gx: 0.1,
      gy: 0.2,
      gz: -0.3,
    })
    const lines = formatImuLive(live)
    expect(lines.gyroLine).toMatch(/gyro\s+ωxyz:/)
    expect(lines.gyroLine).toContain('0.100')
    expect(lines.gyroLine).toContain('0.200')
    expect(lines.gyroLine).toContain('-0.300')
  })
})
