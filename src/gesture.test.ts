import { describe, expect, it } from 'vitest'
import {
  classifyBindingWindow,
  findControlForGesture,
  parsePersisted,
  serializeBindings,
  PoseTracker,
} from './gesture.ts'
import type { ImuSample } from './types.ts'

function seq(
  points: Array<[number, number, number]>,
  startMs = 0,
  stepMs = 100,
): ImuSample[] {
  return points.map(([x, y, z], i) => ({
    x,
    y,
    z,
    t: startMs + i * stepMs,
  }))
}

describe('classifyBindingWindow', () => {
  it('detects tilt-R hold from roll / y axis', () => {
    const samples = seq([
      [0, 0, 1],
      [0, 0.2, 1],
      [0, 0.35, 0.92],
      [0, 0.4, 0.9],
      [0, 0.4, 0.9],
      [0, 0.4, 0.9],
    ])
    expect(classifyBindingWindow(samples)).toBe('tilt-R')
  })

  it('detects nod from tilt-F round-trip to neutral', () => {
    const samples = seq([
      [0, 0, 1],
      [-0.25, 0, 0.97],
      [-0.4, 0.02, 0.9],
      [-0.15, 0, 0.98],
      [-0.02, 0, 1],
    ])
    expect(classifyBindingWindow(samples)).toBe('nod')
  })

  it('does not treat tilt-B round-trip as nod', () => {
    const samples = seq([
      [0, 0, 1],
      [0.25, 0, 0.97],
      [0.4, 0, 0.9],
      [0.15, 0, 0.98],
      [0.02, 0, 1],
    ])
    expect(classifyBindingWindow(samples)).not.toBe('nod')
  })

  it('does not treat tilt-F/B reciprocation as nod', () => {
    const samples = seq([
      [0, 0, 1],
      [-0.35, 0, 0.9],
      [0.35, 0, 0.9],
      [-0.3, 0, 0.92],
      [0.02, 0, 1],
    ])
    expect(classifyBindingWindow(samples)).not.toBe('nod')
  })

  it('does not bind yaw-pending shake (y-reciprocation proxy)', () => {
    const samples = seq([
      [0, 0, 1],
      [0, 0.1, 1],
      [0, -0.1, 1],
      [0, 0.09, 1],
      [0, -0.02, 1],
    ])
    expect(classifyBindingWindow(samples)).toBeNull()
  })

  it('classifies real G2 nod window as nod', () => {
    const samples = seq([
      [-0.083, -0.061, 1.0],
      [-0.085, -0.06, 1.001],
      [-0.211, -0.002, 0.98],
      [-0.456, 0.038, 0.888],
      [-0.444, 0.036, 0.903],
      [-0.224, -0.031, 0.974],
      [-0.086, -0.06, 0.999],
      [-0.072, -0.052, 1.001],
    ])
    expect(classifyBindingWindow(samples)).toBe('nod')
  })

  it('does not bind real G2 shake window while yaw is unavailable', () => {
    const samples = seq([
      [-0.08, -0.043, 0.994],
      [-0.099, 0.006, 0.983],
      [-0.033, 0.05, 1.009],
      [-0.082, 0.011, 0.985],
      [-0.119, -0.113, 0.991],
      [-0.062, -0.107, 1.0],
      [-0.151, -0.054, 0.996],
    ])
    expect(classifyBindingWindow(samples)).toBeNull()
  })
})

describe('PoseTracker enter/return', () => {
  it('emits tilt-R on enter and does not emit shake on return', () => {
    const tracker = new PoseTracker({ g0: { x: 0, y: 0, z: 1 }, at: 0 })
    const events: string[] = []
    const push = (x: number, y: number, z: number, t: number) => {
      const ev = tracker.push({ x, y, z, t })
      if (ev) events.push(ev.kind === 'oscillate' ? ev.gesture : ev.kind === 'enter' ? ev.gesture : 'return')
    }
    // settle neutral
    for (let i = 0; i < 5; i++) push(0, 0, 1, i * 100)
    // move to tilt-R and hold past REACH_WINDOW_MS
    for (let i = 0; i < 14; i++) push(0, 0.35, 0.94, 500 + i * 100)
    // return to neutral
    for (let i = 0; i < 8; i++) push(0, 0.02, 1, 1400 + i * 100)
    expect(events).toContain('tilt-R')
    expect(events).toContain('return')
    expect(events).not.toContain('shake')
  })

  it('switches held tilt-L to opposite tilt-R without a long neutral dwell', () => {
    const tracker = new PoseTracker({ g0: { x: 0, y: 0, z: 1 }, at: 0 })
    const events: string[] = []
    let t = 0
    const push = (x: number, y: number, z: number, step = 50) => {
      t += step
      const ev = tracker.push({ x, y, z, t })
      if (ev) {
        events.push(
          ev.kind === 'oscillate' ? ev.gesture : ev.kind === 'enter' ? ev.gesture : 'return',
        )
      }
    }

    // settle neutral
    for (let i = 0; i < 8; i++) push(0, 0, 1)
    // enter tilt-L (roll / y-) and hold past REACH_WINDOW_MS
    for (let i = 0; i < 14; i++) push(0, -0.35, 0.94)
    // brief transit through near-neutral (shorter than SETTLE_MS), then opposite tilt-R
    push(0, -0.05, 1, 80)
    push(0, 0.02, 1, 80)
    for (let i = 0; i < 14; i++) push(0, 0.35, 0.94)

    expect(events.filter((e) => e === 'tilt-L')).toHaveLength(1)
    expect(events.filter((e) => e === 'tilt-R')).toHaveLength(1)
    // Must not require a settled return between opposite holds
    const l = events.indexOf('tilt-L')
    const r = events.indexOf('tilt-R')
    expect(r).toBeGreaterThan(l)
    expect(events.slice(l + 1, r)).not.toContain('return')
  })


  it('detects nod soon after returning from tilt (no long return suppress)', () => {
    const tracker = new PoseTracker({ g0: { x: 0, y: 0, z: 1 }, at: 0 })
    const events: string[] = []
    let t = 0
    const push = (x: number, y: number, z: number, step = 50) => {
      t += step
      const ev = tracker.push({ x, y, z, t })
      if (ev) {
        events.push(
          ev.kind === 'oscillate' ? ev.gesture : ev.kind === 'enter' ? ev.gesture : 'return',
        )
      }
    }

    for (let i = 0; i < 8; i++) push(0, 0, 1)
    for (let i = 0; i < 14; i++) push(0, -0.35, 0.94) // tilt-L
    for (let i = 0; i < 8; i++) push(0, 0, 1) // return
    expect(events).toContain('tilt-L')
    expect(events).toContain('return')
    const afterReturn = t

    // Nod peak + return to neutral, finishing well under the old 450ms suppress.
    push(-0.15, 0, 0.98, 50)
    push(-0.35, 0, 0.9, 50)
    push(-0.4, 0.01, 0.88, 50)
    push(-0.2, 0, 0.96, 50)
    push(-0.05, 0, 1, 50)
    push(0, 0, 1, 50)

    expect(t - afterReturn).toBeLessThan(450)
    expect(events).toContain('nod')
  })

  it('does not emit yaw-pending shake after returning from tilt', () => {
    const tracker = new PoseTracker({ g0: { x: 0, y: 0, z: 1 }, at: 0 })
    const events: string[] = []
    let t = 0
    const push = (x: number, y: number, z: number, step = 50) => {
      t += step
      const ev = tracker.push({ x, y, z, t })
      if (ev) {
        events.push(
          ev.kind === 'oscillate' ? ev.gesture : ev.kind === 'enter' ? ev.gesture : 'return',
        )
      }
    }

    for (let i = 0; i < 8; i++) push(0, 0, 1)
    for (let i = 0; i < 14; i++) push(0, 0.35, 0.94) // tilt-R
    for (let i = 0; i < 8; i++) push(0, 0, 1)
    expect(events).toContain('tilt-R')
    expect(events).toContain('return')

    push(0, 0.12, 1, 50)
    push(0, -0.12, 1, 50)
    push(0, 0.1, 1, 50)
    push(0, -0.08, 1, 50)
    push(0, 0.02, 1, 50)
    push(0, 0, 1, 50)

    expect(events).not.toContain('shake')
  })

  it('classifies a quick pitch dip as nod, not tilt-F enter', () => {
    const tracker = new PoseTracker({ g0: { x: 0, y: 0, z: 1 }, at: 0 })
    const events: string[] = []
    let t = 0
    const push = (x: number, y: number, z: number, step = 20) => {
      t += step
      const ev = tracker.push({ x, y, z, t })
      if (ev) {
        events.push(
          ev.kind === 'oscillate' ? ev.gesture : ev.kind === 'enter' ? ev.gesture : 'return',
        )
      }
    }

    for (let i = 0; i < 8; i++) push(0, 0, 1)
    // Return to neutral within REACH_WINDOW_MS (200ms) after reach so nod wins over hold.
    const dip = [-0.2, -0.3, -0.38, -0.42, -0.4, -0.35, -0.28, -0.18, -0.08, -0.02, 0, 0]
    for (const x of dip) push(x, 0, Math.sqrt(Math.max(0.01, 1 - x * x)))

    expect(events).toContain('nod')
    expect(events).not.toContain('tilt-F')
  })


})

describe('persistence helpers', () => {
  it('round-trips bindings json', () => {
    const bindings = {
      tap: 'nod' as const,
      dbl: null,
      'swipe-up': 'tilt-L' as const,
      'swipe-down': null,
    }
    const raw = serializeBindings(bindings)
    expect(parsePersisted(raw)).toEqual(bindings)
  })


  it('migrates legacy face-*/turn-* bindings to tilt-*', () => {
    const raw = JSON.stringify({
      version: 1,
      bindings: {
        tap: 'nod',
        dbl: null,
        'swipe-up': 'face-L',
        'swipe-down': 'turn-R',
      },
    })
    expect(parsePersisted(raw)).toEqual({
      tap: 'nod',
      dbl: null,
      'swipe-up': 'tilt-L',
      'swipe-down': 'tilt-R',
    })
  })

  it('clears yaw-pending shake and does not keep raw turn-* as bindings', () => {
    const raw = JSON.stringify({
      version: 1,
      bindings: {
        tap: 'shake',
        dbl: 'turn-L',
        'swipe-up': 'tilt-F',
        'swipe-down': null,
      },
    })
    // turn-L was briefly the roll id → migrates to tilt-L; shake is yaw-pending → cleared.
    expect(parsePersisted(raw)).toEqual({
      tap: null,
      dbl: 'tilt-L',
      'swipe-up': 'tilt-F',
      'swipe-down': null,
    })
  })

  it('maps gesture back to control', () => {
    const bindings = {
      tap: 'nod' as const,
      dbl: null,
      'swipe-up': 'tilt-L' as const,
      'swipe-down': null,
    }
    expect(findControlForGesture(bindings, 'nod')).toBe('tap')
    expect(findControlForGesture(bindings, 'shake')).toBeNull()
    expect(findControlForGesture(bindings, 'turn-R')).toBeNull()
  })
})
