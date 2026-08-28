export type DebugChannel = 'phone' | 'glasses' | 'app' | 'server'

export interface DebugEnvelope {
  t: number
  kind: 'client'
  channel: DebugChannel
  type: string
  payload?: unknown
}

export type DebugWsStatus = 'connecting' | 'open' | 'closed' | 'error'

type Listener = (status: DebugWsStatus) => void

let socket: WebSocket | null = null
let status: DebugWsStatus = 'closed'
const listeners = new Set<Listener>()
const queue: string[] = []
const MAX_QUEUE = 100
let lastImuSentAt = 0
const IMU_MIN_INTERVAL_MS = 200

function setStatus(next: typeof status) {
  status = next
  for (const l of listeners) l(next)
}

function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/__debug_ws`
}

function flush() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return
  while (queue.length > 0) {
    const line = queue.shift()
    if (line) socket.send(line)
  }
}

function enqueue(line: string) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(line)
    return
  }
  queue.push(line)
  if (queue.length > MAX_QUEUE) queue.shift()
}

export function debugSend(
  channel: DebugChannel,
  type: string,
  payload?: unknown,
): void {
  const env: DebugEnvelope = {
    t: Date.now(),
    kind: 'client',
    channel,
    type,
    payload,
  }
  enqueue(JSON.stringify(env))
}

export function debugSendImu(sample: { x: number; y: number; z: number; t: number }): void {
  const now = sample.t
  if (now - lastImuSentAt < IMU_MIN_INTERVAL_MS) return
  lastImuSentAt = now
  debugSend('glasses', 'imu', sample)
}

export function onDebugStatus(listener: Listener): () => void {
  listeners.add(listener)
  listener(status)
  return () => listeners.delete(listener)
}

export function getDebugStatus(): typeof status {
  return status
}

function hookConsole() {
  const levels = ['log', 'info', 'warn', 'error'] as const
  for (const level of levels) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      try {
        debugSend('phone', `console.${level}`, {
          args: args.map((a) => {
            if (typeof a === 'string') return a
            try {
              return JSON.parse(JSON.stringify(a))
            } catch {
              return String(a)
            }
          }),
        })
      } catch {
        // ignore telemetry failures
      }
    }
  }
}

export function startDebugTelemetry(): void {
  if (socket) return
  hookConsole()
  setStatus('connecting')

  const connect = () => {
    const url = wsUrl()
    debugSend('app', 'ws_connect_attempt', { url })
    const ws = new WebSocket(url)
    socket = ws

    ws.onopen = () => {
      setStatus('open')
      debugSend('app', 'ws_open', {
        href: location.href,
        ua: navigator.userAgent,
      })
      flush()
    }

    ws.onclose = () => {
      setStatus('closed')
      socket = null
      setTimeout(connect, 1500)
    }

    ws.onerror = () => {
      setStatus('error')
    }
  }

  connect()

  window.addEventListener('error', (ev) => {
    debugSend('phone', 'window.error', {
      message: ev.message,
      filename: ev.filename,
      lineno: ev.lineno,
      colno: ev.colno,
    })
  })
  window.addEventListener('unhandledrejection', (ev) => {
    debugSend('phone', 'unhandledrejection', {
      reason: String(ev.reason),
    })
  })
}

/** Best-effort JSON-safe snapshot of an EvenHubEvent. */
export function summarizeEvenHubEvent(event: unknown): unknown {
  try {
    return JSON.parse(
      JSON.stringify(event, (_k, v) => {
        if (v instanceof Uint8Array) return { __uint8: v.length }
        return v
      }),
    )
  } catch {
    return { error: 'unserializable_event' }
  }
}
