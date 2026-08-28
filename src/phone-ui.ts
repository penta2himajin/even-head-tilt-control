import { CONTROL_IDS, GESTURE_LABELS } from './constants.ts'
import {
  formatControlLogLine,
  formatListItems,
} from './format.ts'
import type { AppSnapshot } from './types.ts'

export interface PhoneUi {
  root: HTMLElement
  refresh(snapshot: AppSnapshot): void
  appendLog(snapshot: AppSnapshot, index: number): void
}

export function createPhoneUi(root: HTMLElement): PhoneUi {
  root.innerHTML = `
    <header class="phone-header">
      <h1>Head Tilt Control</h1>
      <p class="phone-sub">Phone mirror — bindings &amp; control log</p>
    </header>
    <section class="phone-panel">
      <h2>Bindings</h2>
      <pre id="phone-bindings" class="phone-pre"></pre>
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

  const bindingsEl = root.querySelector('#phone-bindings') as HTMLPreElement
  const modeEl = root.querySelector('#phone-mode') as HTMLParagraphElement
  const logEl = root.querySelector('#phone-log') as HTMLPreElement

  const refresh = (snapshot: AppSnapshot) => {
    bindingsEl.textContent = formatListItems(
      snapshot.bindings,
      snapshot.focusedIndex,
      snapshot.bindingControl,
    ).join('\n')

    if (snapshot.mode === 'binding' && snapshot.bindingControl) {
      modeEl.textContent = `Binding — hold a head gesture for ${snapshot.bindingControl}`
    } else {
      modeEl.textContent = 'Idle — perform a bound gesture to fire control'
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

  return { root, refresh, appendLog }
}

export function formatBindingsSummary(snapshot: AppSnapshot): string {
  return CONTROL_IDS.map((id) => {
    const g = snapshot.bindings[id]
    return `${id}=${g ? GESTURE_LABELS[g] : '-'}`
  }).join(',')
}
