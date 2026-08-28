import type { ImuSample } from './types.ts'

export type ImuListener = (sample: ImuSample) => void

export interface MockImuHandle {
  stop(): void
  inject(x: number, y: number, z: number): void
}

declare global {
  interface Window {
    __headTiltInjectImu?: (x: number, y: number, z: number) => void
  }
}

/** Deskless helper: synthetic IMU when hardware/simulator provides none. */
export function startMockImu(onSample: ImuListener): MockImuHandle {
  let t = Date.now()
  const tick = () => {
    t += 100
    onSample({ x: 0, y: 0, z: 0, t })
  }
  const id = setInterval(tick, 100)

  const inject = (x: number, y: number, z: number) => {
    t += 100
    onSample({ x, y, z, t })
  }

  window.__headTiltInjectImu = inject

  return {
    stop: () => {
      clearInterval(id)
      delete window.__headTiltInjectImu
    },
    inject,
  }
}

export function mockImuEnabled(): boolean {
  return new URLSearchParams(location.search).get('mockImu') === '1'
}

/** Play a short nod-like series through the listener (tests / manual). */
export function playNodSequence(inject: (x: number, y: number, z: number) => void): void {
  const steps: Array<[number, number, number]> = [
    [0, 0, 0],
    [0, 0, 12],
    [0, 0, -10],
    [0, 0, 0],
  ]
  for (const [x, y, z] of steps) inject(x, y, z)
}
