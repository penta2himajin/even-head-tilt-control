# even-head-tilt-control

Even G2 plugin to test assigning head gestures (nod, shake, face turn, head tilt) to touch controls (`tap`, `dbl`, `swipe-up`, `swipe-down`).

Long-press a list row while performing a head gesture to bind; after release, the same gesture fires the bound control. Bindings persist via Even Hub local storage. The phone WebView mirrors bindings and control logs.

**Package ID:** `com.pentalab.head-tilt-control`

## Setup

```bash
npm ci
git config core.hooksPath git-hooks
```

## Develop

```bash
npm run dev          # Vite on http://127.0.0.1:5173
npm run sim          # Hub Simulator + automation port 9898
```

Deskless IMU mock (simulator has no IMU):

```bash
npm run dev -- --open '/?mockImu=1'
# In browser console: __headTiltInjectImu(0, 0, 12)
```

## Verify

```bash
npm run verify:deskless   # L0 unit tests + L2a simulator smoke
```

Uses [`@penta2himajin/even-deskless`](https://github.com/penta2himajin/even-deskless). The app logs `[head-tilt] ready` after startup and `[head-tilt] bindings: …` when bindings load or change.

## Desk / device testing

**QR alone is not enough on a Cloud Agent.** `npm run qr` points at `127.0.0.1`, which the phone cannot reach. Use a public tunnel, then `npm run qr:tunnel`.

Full steps (tunnel → QR → phone scan → glasses): **[docs/device-sideload.md](./docs/device-sideload.md)** · [日本語](./docs/device-sideload.ja.md)

```bash
npm run dev                          # terminal 1
bash scripts/dev-tunnel.sh           # terminal 2 — writes /tmp/cf-tunnel.log
npm run qr:tunnel                    # terminal 3 — QR for the Cloudflare URL
```

IMU / pose thresholds in `src/constants.ts` are starting points — tune on real glasses.

## License

MIT. See `LICENSE`.
