import { CONTROL_IDS, GESTURE_LABELS } from './constants.ts'
import {
  formatControlLogLine,
  formatListItems,
} from './format.ts'
import { onDebugStatus, type DebugWsStatus } from './debug-telemetry.ts'
import type { AppSnapshot } from './types.ts'

export interface PhoneUi {
  root: HTMLElement
  refresh(snapshot: AppSnapshot): void
  appendLog(snapshot: AppSnapshot, index: number): void
  setDebugStatus(status: DebugWsStatus): void
}

export interface PhoneUiOptions {
  onSelectIndex?: (index: number) => void
  onStartFlatCalib?: () => void
}

export function createPhoneUi(
  root: HTMLElement,
  options: PhoneUiOptions = {},
): PhoneUi {
  root.innerHTML = `
    <header class="phone-header">
      <h1>Head Tilt Control</h1>
      <p class="phone-sub">Phone mirror — bindings &amp; control log</p>
      <p id="phone-debug-ws" class="phone-debug">debug-ws: …</p>
    </header>
    <section class="phone-panel">
      <h2>Neutral / calib</h2>
      <p class="phone-hint">グラスを平面に置いてから開始（重力平衡 g₀）</p>
      <button type="button" id="phone-calib" class="phone-calib-btn">平面キャリブ開始</button>
      <p id="phone-pose" class="phone-mode"></p>
    </section>
    <section class="phone-panel">
      <h2>Bindings</h2>
      <p class="phone-hint">Tap a row to move glasses focus (&gt;)</p>
      <div id="phone-bindings" class="phone-bindings"></div>
    </section>
    <section class="phone-panel">
      <h2>Mode</h2>
      <p id="phone-mode" class="phone-mode"></p>
    </section>
    <section class="phone-panel">
      <h2>Control log</h2>
      <pre id="phone-log" class="phone-pre phone-log"></pre>
    </section>
  `

  const bindingsEl = root.querySelector('#phone-bindings') as HTMLDivElement
  const modeEl = root.querySelector('#phone-mode') as HTMLParagraphElement
  const poseEl = root.querySelector('#phone-pose') as HTMLParagraphElement
  const logEl = root.querySelector('#phone-log') as HTMLPreElement
  const debugEl = root.querySelector('#phone-debug-ws') as HTMLParagraphElement
  const calibBtn = root.querySelector('#phone-calib') as HTMLButtonElement

  calibBtn.addEventListener('click', () => options.onStartFlatCalib?.())

  const setDebugStatus = (next: DebugWsStatus) => {
    debugEl.textContent = `debug-ws: ${next}`
  }

  onDebugStatus(setDebugStatus)

  const refresh = (snapshot: AppSnapshot) => {
    const lines = formatListItems(
      snapshot.bindings,
      snapshot.focusedIndex,
      snapshot.bindingControl,
    )
    bindingsEl.innerHTML = ''
    for (const [index, line] of lines.entries()) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className =
        index === snapshot.focusedIndex
          ? 'phone-bind-row is-focused'
          : 'phone-bind-row'
      btn.textContent = line
      btn.addEventListener('click', () => options.onSelectIndex?.(index))
      bindingsEl.appendChild(btn)
    }

    poseEl.textContent = snapshot.poseStatus || 'pose: —'
    calibBtn.disabled = snapshot.poseStatus.includes('calib…')
    calibBtn.textContent = snapshot.poseStatus.includes('calib…')
      ? 'キャリブ中…'
      : '平面キャリブ開始'

    if (snapshot.mode === 'binding' && snapshot.bindingControl) {
      modeEl.textContent = `Binding — hold a head gesture for ${snapshot.bindingControl}`
    } else {
      modeEl.textContent =
        'Idle — reach window: return=oscillate, dwell=hold, held return=silent'
    }

    logEl.textContent =
      snapshot.logs.length === 0
        ? '(no control events yet)'
        : snapshot.logs
            .slice(-12)
            .reverse()
            .map((e) => formatControlLogLine(e.control, e.gesture, e.at))
            .join('\n')
  }

  const appendLog = (snapshot: AppSnapshot, index: number) => {
    refresh(snapshot)
    void index
  }

  return { root, refresh, appendLog, setDebugStatus }
}

export function formatBindingsSummary(snapshot: AppSnapshot): string {
  return CONTROL_IDS.map((id) => {
    const g = snapshot.bindings[id]
    return `${id}=${g ? GESTURE_LABELS[g] : '-'}`
  }).join(',')
}
