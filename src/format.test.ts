import { describe, expect, it } from 'vitest'
import {
  formatControlLogLine,
  formatGlassesTitleLine,
  formatListItem,
  formatStatusLabel,
  READY_MARKER,
} from './format.ts'
import type { AppSnapshot } from './types.ts'
import { emptyBindings } from './types.ts'
import type { PoseTrackerStatus } from './gesture.ts'

function poseStatus(overrides: Partial<PoseTrackerStatus> = {}): PoseTrackerStatus {
  return {
    phase: 'neutral',
    region: 'neutral',
    heldGesture: null,
    hasG0: true,
    hasNeutral: true,
    flatCalibActive: false,
    suppressOscillateUntil: 0,
    ...overrides,
  }
}

function snapshot(overrides: Partial<AppSnapshot> = {}): AppSnapshot {
  return {
    bindings: emptyBindings(),
    focusedIndex: 0,
    mode: 'idle',
    bindingControl: null,
    logs: [],
    poseStatus: 'pose: —',
    statusLabel: 'neutral',
    ...overrides,
  }
}

describe('formatStatusLabel', () => {
  it('returns neutral when upright', () => {
    expect(formatStatusLabel(poseStatus())).toBe('neutral')
  })

  it('returns in-pose with hold gesture when held', () => {
    expect(
      formatStatusLabel(
        poseStatus({ phase: 'held', heldGesture: 'tilt-F', region: 'tilt-F' }),
      ),
    ).toBe('in-pose (tilt-F)')
  })

  it('returns in-pose from region while reaching before hold commits', () => {
    expect(formatStatusLabel(poseStatus({ region: 'tilt-R' }))).toBe(
      'in-pose (tilt-R)',
    )
  })
})

describe('formatGlassesTitleLine', () => {
  it('shows control and live status after a fire', () => {
    expect(
      formatGlassesTitleLine(
        snapshot({
          statusLabel: 'neutral',
          logs: [{ at: 0, control: 'tap', gesture: 'nod' }],
        }),
      ),
    ).toBe('control: tap / status: neutral')
  })

  it('shows in-pose status while held', () => {
    expect(
      formatGlassesTitleLine(
        snapshot({
          statusLabel: 'in-pose (tilt-F)',
          logs: [{ at: 0, control: 'tap', gesture: 'tilt-F' }],
        }),
      ),
    ).toBe('control: tap / status: in-pose (tilt-F)')
  })

  it('shows bind mode with status', () => {
    expect(
      formatGlassesTitleLine(
        snapshot({
          mode: 'binding',
          bindingControl: 'dbl',
          statusLabel: 'neutral',
        }),
      ),
    ).toBe('Bind: dbl / status: neutral')
  })

  it('shows status only before any control', () => {
    expect(formatGlassesTitleLine(snapshot({ statusLabel: 'neutral' }))).toBe(
      'status: neutral',
    )
  })
})

describe('formatListItem', () => {
  it('marks focused row and binding suffix', () => {
    expect(
      formatListItem('tap', 'nod', { focused: true, recording: false }),
    ).toBe('> tap → nod')
    expect(
      formatListItem('dbl', null, { focused: false, recording: true }),
    ).toBe('  dbl → (none) …rec')
  })
})

describe('formatControlLogLine', () => {
  it('includes control and gesture', () => {
    const line = formatControlLogLine('tap', 'nod', Date.parse('2026-01-02T12:04:01Z'))
    expect(line).toContain('control: tap')
    expect(line).toContain('via nod')
  })
})

describe('READY_MARKER', () => {
  it('matches evenDeskless config', () => {
    expect(READY_MARKER).toBe('[head-tilt] ready')
  })
})
