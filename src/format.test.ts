import { describe, expect, it } from 'vitest'
import {
  formatControlLogLine,
  formatListItem,
  READY_MARKER,
} from './format.ts'

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
