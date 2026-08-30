import './style.css'
import {
  ImuReportPace,
  OsEventTypeList,
  waitForEvenAppBridge,
  type EvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk'
import {
  CALIB_STORAGE_KEY,
  CONTROL_IDS,
  EXEC_COOLDOWN_MS,
  STORAGE_KEY,
  type ControlId,
  type GestureType,
} from './constants.ts'
import {
  debugSend,
  debugSendImu,
  startDebugTelemetry,
  summarizeEvenHubEvent,
} from './debug-telemetry.ts'
import { READY_MARKER, controlIdFromIndex, formatStatusLabel } from './format.ts'
import {
  PoseTracker,
  classifyBindingWindow,
  findControlForGesture,
  parsePersisted,
  serializeBindings,
} from './gesture.ts'
import {
  buildListUpgrade,
  buildRebuildPage,
  buildStartupPage,
  buildTitleUpgrade,
} from './hub-page.ts'
import { createPhoneUi, formatBindingsSummary } from './phone-ui.ts'
import { parseImuLive } from './imu-live.ts'
import { mockImuEnabled, startMockImu, type MockImuHandle } from './mock-imu.ts'
import {
  parseGravityCalib,
  serializeGravityCalib,
} from './pose.ts'
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
  const fromList = listEvt?.currentSelectItemIndex ?? listEvt?.list_select_item_id
  if (typeof fromList === 'number' && Number.isFinite(fromList)) return fromList

  const json = e.jsonData as Record<string, unknown> | undefined
  const raw =
    json?.currentSelectItemIndex ??
    json?.CurrentSelect_ItemIndex ??
    json?.currentselectitemindex
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) {
    return Number(raw)
  }
  return undefined
}

function clampFocus(index: number): number {
  return Math.max(0, Math.min(CONTROL_IDS.length - 1, index))
}

function eventChannel(event: EvenHubEvent): 'glasses' | 'phone' {
  const src = event.sysEvent?.eventSource
  if (src === 1 || src === 2 || src === 3) return 'glasses'
  if (event.listEvent || event.textEvent) return 'glasses'
  if (event.sysEvent?.eventType === OsEventTypeList.IMU_DATA_REPORT) return 'glasses'
  return 'phone'
}

function formatPoseStatus(s: ReturnType<PoseTracker['status']>): string {
  if (s.flatCalibActive) return 'pose: flat calib… (keep glasses still on desk)'
  const g = s.hasG0 ? 'g0✓' : 'g0✗'
  const n = s.hasNeutral ? 'n̂✓' : 'n̂✗'
  const held = s.heldGesture ? ` held=${s.heldGesture}` : ''
  return `pose: ${s.phase}/${s.region} ${g} ${n}${held}`
}

async function loadBindings(bridge: EvenAppBridge) {
  const raw = await bridge.getLocalStorage(STORAGE_KEY)
  return parsePersisted(raw)
}

async function saveBindings(bridge: EvenAppBridge, snapshot: AppSnapshot) {
  await bridge.setLocalStorage(STORAGE_KEY, serializeBindings(snapshot.bindings))
  console.info('[head-tilt] bindings:', formatBindingsSummary(snapshot))
  debugSend('app', 'bindings_saved', snapshot.bindings)
}

async function loadCalib(bridge: EvenAppBridge) {
  const raw = await bridge.getLocalStorage(CALIB_STORAGE_KEY)
  return parseGravityCalib(raw)
}

async function saveCalib(bridge: EvenAppBridge, tracker: PoseTracker) {
  const calib = tracker.getGravityCalib()
  if (!calib) return
  await bridge.setLocalStorage(CALIB_STORAGE_KEY, serializeGravityCalib(calib))
  debugSend('app', 'calib_saved', calib)
}

async function main() {
  startDebugTelemetry()
  debugSend('app', 'boot', {
    href: location.href,
    hostPresentHint: evenHubHostPresent(),
  })

  const root = document.getElementById('app')!

  let snapshot: AppSnapshot = {
    bindings: emptyBindings(),
    focusedIndex: 0,
    mode: 'idle',
    bindingControl: null,
    logs: [],
    poseStatus: 'pose: —',
    statusLabel: 'neutral',
    imuLive: null,
  }

  const bindingSamples: ImuSample[] = []
  let lastControlAt = 0
  let lastScrollAt = 0
  let imuOpen = false
  let mockHandle: MockImuHandle | null = null
  let hubRef: EvenAppBridge | null = null
  const tracker = new PoseTracker()

  const phone = createPhoneUi(root, {
    onSelectIndex: (index) => {
      void setFocusedIndex(hubRef, index, 'phone')
    },
    onStartFlatCalib: () => {
      tracker.startFlatCalib()
      debugSend('app', 'flat_calib_start', {})
      console.info('[head-tilt] flat calib start — place glasses on a flat surface')
      paint(hubRef)
    },
  })

  const refreshGlassesTitle = async (hub: EvenAppBridge) => {
    try {
      await hub.textContainerUpgrade(buildTitleUpgrade(snapshot))
    } catch (err) {
      debugSend('glasses', 'title_upgrade_error', { err: String(err) })
    }
  }

  const syncPoseStatus = (hub: EvenAppBridge | null): boolean => {
    const status = tracker.status()
    snapshot.poseStatus = formatPoseStatus(status)
    const nextLabel = formatStatusLabel(status)
    const changed = nextLabel !== snapshot.statusLabel
    if (changed) {
      snapshot.statusLabel = nextLabel
      debugSend('app', 'pose_status', {
        label: nextLabel,
        ...tracker.telemetryForStatus(),
      })
      if (hub) void refreshGlassesTitle(hub)
    }
    return changed
  }

  const paint = (hub: EvenAppBridge | null = null) => {
    syncPoseStatus(hub)
    phone.refresh(snapshot)
  }

  const rebuildGlasses = async (hub: EvenAppBridge) => {
    await hub.rebuildPageContainer(buildRebuildPage(snapshot))
    debugSend('glasses', 'rebuild_page', {
      mode: snapshot.mode,
      focusedIndex: snapshot.focusedIndex,
      bindingControl: snapshot.bindingControl,
    })
  }

  const refreshGlassesText = async (hub: EvenAppBridge) => {
    try {
      await hub.textContainerUpgrade(buildTitleUpgrade(snapshot))
      await hub.textContainerUpgrade(buildListUpgrade(snapshot))
      debugSend('glasses', 'text_upgrade', {
        focusedIndex: snapshot.focusedIndex,
        mode: snapshot.mode,
        bindingControl: snapshot.bindingControl,
      })
    } catch (err) {
      debugSend('glasses', 'text_upgrade_fallback', { err: String(err) })
      await rebuildGlasses(hub)
    }
  }

  const setFocusedIndex = async (
    hub: EvenAppBridge | null,
    index: number,
    via: string,
  ) => {
    const next = clampFocus(index)
    if (next === snapshot.focusedIndex) return
    snapshot.focusedIndex = next
    debugSend('glasses', 'focus', { index: next, via })
    paint(hub)
    if (hub) await refreshGlassesText(hub)
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
    debugSend('app', 'control', { control, gesture, via })
    paint(hub)
    await rebuildGlasses(hub)
  }

  const onImuSample = async (
    hub: EvenAppBridge,
    sample: ImuSample,
    /** Prefer raw Hub imuData so gyro-like keys (if any) survive. */
    rawPayload?: unknown,
  ) => {
    snapshot.imuLive = parseImuLive(rawPayload ?? sample, sample.t)
    phone.updateImuLive(snapshot.imuLive)
    debugSendImu(sample)

    // Flat calib may run anytime (including before binding).
    if (tracker.isFlatCalibActive()) {
      tracker.push(sample)
      if (!tracker.isFlatCalibActive()) {
        await saveCalib(hub, tracker)
        console.info('[head-tilt] flat calib done')
        debugSend('app', 'flat_calib_done', tracker.getGravityCalib())
      }
      paint(hub)
      return
    }

    if (snapshot.mode === 'binding') {
      bindingSamples.push(sample)
      return
    }

    const transition = tracker.push(sample)
    const statusChanged = syncPoseStatus(hub)
    if (!transition) {
      if (statusChanged || sample.t % 500 < 120) phone.refresh(snapshot)
      return
    }

    debugSend('glasses', 'pose_transition', transition)

    if (transition.kind === 'return') {
      paint(hub)
      return
    }

    const gesture: GestureType = transition.gesture
    const now = sample.t
    if (now - lastControlAt < EXEC_COOLDOWN_MS) {
      paint(hub)
      return
    }
    const control = findControlForGesture(snapshot.bindings, gesture)
    if (control) {
      lastControlAt = now
      await emitControl(hub, control, gesture, 'gesture')
    } else {
      debugSend('glasses', 'pose_unbound', { gesture, transition: transition.kind })
      paint(hub)
    }
  }

  const ensureImu = async (hub: EvenAppBridge) => {
    await hub.imuControl(true, ImuReportPace.P100)
    imuOpen = true
    debugSend('glasses', 'imu_control', { open: true, pace: 'P100' })
  }

  const stopImu = async (hub: EvenAppBridge) => {
    if (!imuOpen) return
    await hub.imuControl(false)
    imuOpen = false
    debugSend('glasses', 'imu_control', { open: false })
  }

  paint(null)

  const hasHost = await waitForHost()
  debugSend('app', 'host_wait', { hasHost })
  if (!hasHost) {
    console.info(READY_MARKER)
    console.info('[head-tilt] bindings:', formatBindingsSummary(snapshot))
    if (mockImuEnabled()) {
      mockHandle = startMockImu(() => undefined)
    }
    return
  }

  const hub = await waitForEvenAppBridge()
  hubRef = hub
  debugSend('phone', 'bridge_ready', {})

  try {
    const info = await hub.getDeviceInfo()
    debugSend('glasses', 'device_info', info)
  } catch (err) {
    debugSend('glasses', 'device_info_error', { err: String(err) })
  }

  try {
    const user = await hub.getUserInfo()
    debugSend('phone', 'user_info', user)
  } catch (err) {
    debugSend('phone', 'user_info_error', { err: String(err) })
  }

  snapshot.bindings = await loadBindings(hub)
  const calib = await loadCalib(hub)
  if (calib) {
    tracker.loadCalib(calib)
    debugSend('app', 'calib_loaded', calib)
  }
  debugSend('app', 'bindings_loaded', snapshot.bindings)
  paint(hub)

  await hub.createStartUpPageContainer(buildStartupPage(snapshot))
  console.info(READY_MARKER)
  console.info('[head-tilt] bindings:', formatBindingsSummary(snapshot))
  debugSend('glasses', 'startup_page', {
    bindings: snapshot.bindings,
  })

  await ensureImu(hub)

  if (mockImuEnabled()) {
    mockHandle = startMockImu((sample) => {
      void onImuSample(hub, sample)
    })
    debugSend('app', 'mock_imu', { enabled: true })
  }

  try {
    hub.onDeviceStatusChanged((status) => {
      debugSend('glasses', 'device_status', status)
    })
  } catch (err) {
    debugSend('glasses', 'device_status_error', { err: String(err) })
  }

  hub.onEvenHubEvent((event) => {
    void (async () => {
      const channel = eventChannel(event)
      const sysType = event.sysEvent?.eventType
      const type = rawEventType(event)

      if (sysType === OsEventTypeList.IMU_DATA_REPORT && event.sysEvent?.imuData) {
        const raw = event.sysEvent.imuData as unknown as Record<string, unknown>
        const now = Date.now()
        const live = parseImuLive(raw, now)
        await onImuSample(
          hub,
          { x: live.ax, y: live.ay, z: live.az, t: now },
          raw,
        )
        return
      }

      debugSend(channel, 'even_hub_event', summarizeEvenHubEvent(event))

      if (
        type === OsEventTypeList.LONG_PRESS_EVENT ||
        sysType === OsEventTypeList.LONG_PRESS_EVENT
      ) {
        await ensureImu(hub)
        snapshot.mode = 'binding'
        snapshot.bindingControl = controlIdFromIndex(snapshot.focusedIndex)
        bindingSamples.length = 0
        tracker.softReset()
        debugSend('glasses', 'binding_start', {
          control: snapshot.bindingControl,
          focusedIndex: snapshot.focusedIndex,
        })
        paint(hub)
        await refreshGlassesText(hub)
        return
      }

      if (
        type === OsEventTypeList.LONG_PRESS_RELEASE_EVENT ||
        sysType === OsEventTypeList.LONG_PRESS_RELEASE_EVENT
      ) {
        const control = snapshot.bindingControl
        const gesture = classifyBindingWindow(bindingSamples)
        debugSend('glasses', 'binding_end', {
          control,
          gesture,
          samples: bindingSamples.length,
          focusedIndex: snapshot.focusedIndex,
        })
        if (control && gesture) {
          snapshot.bindings[control] = gesture
          await saveBindings(hub, snapshot)
        }
        snapshot.mode = 'idle'
        snapshot.bindingControl = null
        bindingSamples.length = 0
        tracker.softReset()
        paint(hub)
        await refreshGlassesText(hub)
        return
      }

      const focus = listFocusIndex(event)
      if (focus !== undefined) {
        await setFocusedIndex(hub, focus, 'listEvent')
        return
      }

      if (
        type === OsEventTypeList.SCROLL_TOP_EVENT ||
        type === OsEventTypeList.SCROLL_BOTTOM_EVENT
      ) {
        if (snapshot.mode === 'binding') return
        const now = Date.now()
        if (now - lastScrollAt < 280) return
        lastScrollAt = now
        const delta = type === OsEventTypeList.SCROLL_TOP_EVENT ? -1 : 1
        await setFocusedIndex(hub, snapshot.focusedIndex + delta, 'scroll')
        return
      }

      if (type === OsEventTypeList.CLICK_EVENT || type === undefined || type === null) {
        const control = controlIdFromIndex(snapshot.focusedIndex)
        const bound = snapshot.bindings[control]
        if (bound) {
          await emitControl(hub, control, bound, 'temple')
        } else {
          debugSend('glasses', 'click_unbound', { control })
        }
      }
    })()
  })

  window.addEventListener('beforeunload', () => {
    debugSend('app', 'beforeunload', {})
    mockHandle?.stop()
    void stopImu(hub)
  })
}

void main()
