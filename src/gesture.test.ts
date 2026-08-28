import { describe, expect, it } from 'vitest'
import {
  classifyBindingWindow,
  detectMotionExecution,
  findControlForGesture,
  parsePersisted,
  serializeBindings,
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
  it('detects face-R hold from yaw axis', () => {
    const samples = seq([
      [0, 0, 0],
      [0, 10, 0],
      [0, 18, 0],
    ])
    expect(classifyBindingWindow(samples)).toBe('face-R')
  })

  it('detects nod from pitch reversal', () => {
    const samples = seq([
      [0, 0, 0],
      [0, 0, 14],
      [0, 0, -12],
    ])
    expect(classifyBindingWindow(samples)).toBe('nod')
  })

  it('detects shake from yaw reversal', () => {
    const samples = seq([
      [0, 0, 0],
      [0, 14, 0],
      [0, -12, 0],
    ])
    expect(classifyBindingWindow(samples)).toBe('shake')
  })
})

describe('detectMotionExecution', () => {
  it('fires nod on pitch swing in rolling window', () => {
    const samples = seq([
      [0, 0, 0],
      [0, 0, 12],
      [0, 0, -10],
    ])
    expect(detectMotionExecution(samples)).toBe('nod')
  })
})

describe('persistence helpers', () => {
  it('round-trips bindings json', () => {
    const bindings = {
      tap: 'nod' as const,
      dbl: null,
      'swipe-up': 'face-L' as const,
      'swipe-down': null,
    }
    const raw = serializeBindings(bindings)
    expect(parsePersisted(raw)).toEqual(bindings)
  })

  it('maps gesture back to control', () => {
    const bindings = {
      tap: 'nod' as const,
      dbl: null,
      'swipe-up': 'face-L' as const,
      'swipe-down': null,
    }
    expect(findControlForGesture(bindings, 'nod')).toBe('tap')
    expect(findControlForGesture(bindings, 'shake')).toBeNull()
  })
})
