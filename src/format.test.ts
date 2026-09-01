import { describe, expect, it } from 'vitest'
import {
  formatControlLogLine,
  formatGlassesTitleLine,
  formatListItem,
  formatStatusLabel,
  GLASSES_TITLE_LEFT_ANCHOR,
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
    imuLive: null,
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

  it('returns neutral when region is upright even if hold phase is not cleared', () => {
    expect(
      formatStatusLabel(
        poseStatus({ phase: 'held', heldGesture: 'tilt-F', region: 'neutral' }),
      ),
    ).toBe('neutral')
  })

  it('returns in-pose from region while reaching before hold commits', () => {
    expect(formatStatusLabel(poseStatus({ region: 'tilt-R' }))).toBe(
      'in-pose (tilt-R)',
    )
  })
})

describe('formatGlassesTitleLine', () => {
  const statusAt = (line: string) => line.indexOf('status:')

  it('shows control and live status after a fire', () => {
    const line = formatGlassesTitleLine(
      snapshot({
        statusLabel: 'neutral',
        logs: [{ at: 0, control: 'tap', gesture: 'nod' }],
      }),
    )
    expect(line).toBe(
      `${'control: tap'.padEnd(GLASSES_TITLE_LEFT_ANCHOR.length)} / status: neutral`,
    )
    expect(statusAt(line)).toBe(GLASSES_TITLE_LEFT_ANCHOR.length + 3)
  })

  it('shows in-pose status while held', () => {
    expect(
      formatGlassesTitleLine(
        snapshot({
          statusLabel: 'in-pose (tilt-F)',
          logs: [{ at: 0, control: 'tap', gesture: 'tilt-F' }],
        }),
      ),
    ).toBe(
      `${'control: tap'.padEnd(GLASSES_TITLE_LEFT_ANCHOR.length)} / status: in-pose (tilt-F)`,
    )
  })

  it('keeps status at the swipe-down anchor column for every control', () => {
    const anchorAt = statusAt(
      formatGlassesTitleLine(
        snapshot({
          statusLabel: 'neutral',
          logs: [{ at: 0, control: 'swipe-down', gesture: 'tilt-L' }],
        }),
      ),
    )
    for (const control of ['tap', 'dbl', 'swipe-up', 'swipe-down'] as const) {
      const line = formatGlassesTitleLine(
        snapshot({
          statusLabel: 'neutral',
          logs: [{ at: 0, control, gesture: 'nod' }],
        }),
      )
      expect(statusAt(line)).toBe(anchorAt)
    }
  })

  it('aligns bind mode to the same status column', () => {
    const controlLine = formatGlassesTitleLine(
      snapshot({
        statusLabel: 'neutral',
        logs: [{ at: 0, control: 'swipe-down', gesture: 'nod' }],
      }),
    )
    const bindLine = formatGlassesTitleLine(
      snapshot({
        mode: 'binding',
        bindingControl: 'dbl',
        statusLabel: 'neutral',
      }),
    )
    expect(statusAt(bindLine)).toBe(statusAt(controlLine))
  })

  it('shows padded control slot before any fire', () => {
    expect(formatGlassesTitleLine(snapshot({ statusLabel: 'neutral' }))).toBe(
      `${'control: —'.padEnd(GLASSES_TITLE_LEFT_ANCHOR.length)} / status: neutral`,
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
