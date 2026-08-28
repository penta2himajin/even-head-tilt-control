import './style.css'
import {
  ImuReportPace,
  OsEventTypeList,
  waitForEvenAppBridge,
  type EvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk'
import {
  EXEC_COOLDOWN_MS,
  HOLD_MS,
  HOLD_THRESHOLD,
  MOTION_WINDOW_MS,
  STORAGE_KEY,
  type ControlId,
  type GestureType,
} from './constants.ts'
import { READY_MARKER, controlIdFromIndex } from './format.ts'
import {
  classifyBindingWindow,
  detectHoldExecution,
  detectMotionExecution,
  findControlForGesture,
  parsePersisted,
  serializeBindings,
} from './gesture.ts'
import { buildRebuildPage, buildStartupPage } from './hub-page.ts'
import { createPhoneUi, formatBindingsSummary } from './phone-ui.ts'
import { mockImuEnabled, startMockImu, type MockImuHandle } from './mock-imu.ts'
import type { AppSnapshot, ControlLogEntry, ImuSample } from './types.ts'
import { emptyBindings } from './types.ts'

function evenHubHostPresent(): boolean {
  const w = window as unknown as { flutter_inappwebview?: { callHandler?: unknown } }
  return typeof w.flutter_inappwebview?.callHandler === 'function'
}

async function waitForHost(timeoutMs = 8000): Promise<boolean> {
  if (evenHubHostPresent()) return true
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50))
    if (evenHubHostPresent()) return true
  }
  return evenHubHostPresent()
}

function rawEventType(event: EvenHubEvent): number | undefined {
  const e = event as Record<string, unknown>
  const listEvt = e.listEvent as { eventType?: number } | undefined
  const textEvt = e.textEvent as { eventType?: number } | undefined
  const sysEvt = e.sysEvent as { eventType?: number } | undefined
  const fromContainer = listEvt?.eventType ?? textEvt?.eventType
  if (fromContainer !== undefined && fromContainer !== null) return fromContainer
  return sysEvt?.eventType
}

function listFocusIndex(event: EvenHubEvent): number | undefined {
  const e = event as Record<string, unknown>
  const listEvt = e.listEvent as
    | { currentSelectItemIndex?: number; list_select_item_id?: number }
    | undefined
  return listEvt?.currentSelectItemIndex ?? listEvt?.list_select_item_id
}

async function loadBindings(bridge: EvenAppBridge) {
  const raw = await bridge.getLocalStorage(STORAGE_KEY)
  return parsePersisted(raw)
}

async function saveBindings(bridge: EvenAppBridge, snapshot: AppSnapshot) {
  await bridge.setLocalStorage(STORAGE_KEY, serializeBindings(snapshot.bindings))
  console.info('[head-tilt] bindings:', formatBindingsSummary(snapshot))
}

async function main() {
  const root = document.getElementById('app')!
  const phone = createPhoneUi(root)

  let snapshot: AppSnapshot = {
    bindings: emptyBindings(),
    focusedIndex: 0,
    mode: 'idle',
    bindingControl: null,
    logs: [],
  }

  const bindingSamples: ImuSample[] = []
  const execMotionBuffer: ImuSample[] = []
  let execBaseline: ImuSample | null = null
  let holdSince: number | null = null
  let lastControlAt = 0
  let imuOpen = false
  let mockHandle: MockImuHandle | null = null

  const paint = () => phone.refresh(snapshot)

  const rebuildGlasses = async (hub: EvenAppBridge) => {
    await hub.rebuildPageContainer(buildRebuildPage(snapshot))
  }

  const emitControl = async (
    hub: EvenAppBridge,
    control: ControlId,
    gesture: GestureType,
    via: 'gesture' | 'temple',
  ) => {
    const entry: ControlLogEntry = { at: Date.now(), control, gesture }
    snapshot.logs.push(entry)
    const suffix = via === 'gesture' ? 'via' : 'temple'
    console.info(`[control] ${control} ${suffix} ${gesture}`)
    paint()
    await rebuildGlasses(hub)
  }

  const onImuSample = async (hub: EvenAppBridge, sample: ImuSample) => {
    if (snapshot.mode === 'binding') {
      bindingSamples.push(sample)
      return
    }

    execMotionBuffer.push(sample)
    const cutoff = sample.t - MOTION_WINDOW_MS
    while (execMotionBuffer.length > 0 && execMotionBuffer[0].t < cutoff) {
      execMotionBuffer.shift()
    }

    if (!execBaseline) execBaseline = sample

    const now = sample.t
    if (now - lastControlAt < EXEC_COOLDOWN_MS) return

    const motion = detectMotionExecution(execMotionBuffer)
    if (motion) {
      const control = findControlForGesture(snapshot.bindings, motion)
      if (control) {
        lastControlAt = now
        execMotionBuffer.length = 0
        execBaseline = null
        holdSince = null
        await emitControl(hub, control, motion, 'gesture')
        return
      }
    }

    const hold = detectHoldExecution(
      sample,
      execBaseline,
      holdSince,
      now,
      HOLD_MS,
      HOLD_THRESHOLD,
    )
    holdSince = hold.heldSince
    if (hold.gesture) {
      const control = findControlForGesture(snapshot.bindings, hold.gesture)
      if (control) {
        lastControlAt = now
        execBaseline = null
        holdSince = null
        await emitControl(hub, control, hold.gesture, 'gesture')
      }
    }
  }

  const ensureImu = async (hub: EvenAppBridge) => {
    if (imuOpen) return
    await hub.imuControl(true, ImuReportPace.P500)
    imuOpen = true
  }

  const stopImu = async (hub: EvenAppBridge) => {
    if (!imuOpen) return
    await hub.imuControl(false)
    imuOpen = false
  }

  paint()

  const hasHost = await waitForHost()
  if (!hasHost) {
    console.info(READY_MARKER)
    console.info('[head-tilt] bindings:', formatBindingsSummary(snapshot))
    if (mockImuEnabled()) {
      mockHandle = startMockImu(() => undefined)
    }
    return
  }

  const hub = await waitForEvenAppBridge()
  snapshot.bindings = await loadBindings(hub)
  paint()

  await hub.createStartUpPageContainer(buildStartupPage(snapshot))
  console.info(READY_MARKER)
  console.info('[head-tilt] bindings:', formatBindingsSummary(snapshot))

  await ensureImu(hub)

  if (mockImuEnabled()) {
    mockHandle = startMockImu((sample) => {
      void onImuSample(hub, sample)
    })
  }

  hub.onEvenHubEvent((event) => {
    void (async () => {
      const sysType = event.sysEvent?.eventType

      if (sysType === OsEventTypeList.IMU_DATA_REPORT && event.sysEvent?.imuData) {
        const { x = 0, y = 0, z = 0 } = event.sysEvent.imuData
        await onImuSample(hub, { x, y, z, t: Date.now() })
        return
      }

      if (sysType === OsEventTypeList.LONG_PRESS_EVENT) {
        await ensureImu(hub)
        snapshot.mode = 'binding'
        snapshot.bindingControl = controlIdFromIndex(snapshot.focusedIndex)
        bindingSamples.length = 0
        paint()
        await rebuildGlasses(hub)
        return
      }

      if (sysType === OsEventTypeList.LONG_PRESS_RELEASE_EVENT) {
        const control = snapshot.bindingControl
        const gesture = classifyBindingWindow(bindingSamples)
        if (control && gesture) {
          snapshot.bindings[control] = gesture
          await saveBindings(hub, snapshot)
        }
        snapshot.mode = 'idle'
        snapshot.bindingControl = null
        bindingSamples.length = 0
        execBaseline = null
        holdSince = null
        paint()
        await rebuildGlasses(hub)
        return
      }

      const focus = listFocusIndex(event)
      if (focus !== undefined) {
        snapshot.focusedIndex = focus
        paint()
        return
      }

      const type = rawEventType(event)
      if (type === OsEventTypeList.CLICK_EVENT || type === undefined || type === null) {
        const control = controlIdFromIndex(snapshot.focusedIndex)
        const bound = snapshot.bindings[control]
        if (bound) {
          await emitControl(hub, control, bound, 'temple')
        }
      }
    })()
  })

  window.addEventListener('beforeunload', () => {
    mockHandle?.stop()
    void stopImu(hub)
  })
}

void main()
