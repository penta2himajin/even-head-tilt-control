# Device sideload (QR + tunnel)

How to run this plugin on real G2 glasses from a Cloud Agent / remote VM, or from a laptop that the phone cannot reach on `localhost`.

Tunnel + QR is delegated to [`@penta2himajin/even-deskless`](https://github.com/penta2himajin/even-deskless) (`npm run qr:tunnel`). Kit docs: `node_modules/@penta2himajin/even-deskless/docs/cloud-agent-qr.md`.

## Why a tunnel is required

`npm run qr` alone prints a QR for `http://127.0.0.1:5173`. That URL is only reachable on the machine running Vite.

- **Cloud Agent / remote VM**: the phone has no route to that loopback → scan fails or loads nothing.
- **Same LAN laptop**: you can often use `http://<lan-ip>:5173` instead of a tunnel (see [LAN alternative](#lan-alternative-no-tunnel)).

For Cloud Agent sessions, use a **public HTTPS tunnel** (Cloudflare quick tunnel via even-deskless), then scan the QR.

Vite already sets `server.allowedHosts: true` so Cloudflare hostnames are accepted.

## Prerequisites

- Node 20+
- Even Realities app on the phone (developer / sideload QR flow)
- G2 paired and wearing
- `evenhub` CLI via `@evenrealities/evenhub-cli` (on PATH when using `npm run`)
- `cloudflared` on PATH (or `/tmp/cloudflared`)
- One-time: `npx evenhub login` if the CLI asks for auth

```bash
npm ci
```

## End-to-end (Cloud Agent / remote)

Open **two terminals** (or tmux panes) in the repo root.

### 1. Start the Vite dev server

```bash
npm run dev
```

Leave it running. Confirm locally:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/
# expect 200
```

### 2. Tunnel + sideload QR

```bash
npm run qr:tunnel
```

This runs `node_modules/@penta2himajin/even-deskless/scripts/qr-tunnel.sh`, which:

1. Checks Vite is up on `http://127.0.0.1:5173/`
2. Reuses a **live** `*.trycloudflare.com` URL from the log if HTTPS still responds
3. Otherwise starts `cloudflared` in the background and waits for a URL
4. Prints an `evenhub qr` for that HTTPS URL

Default log: `/tmp/even-deskless-cf-tunnel.log` (override with `CF_TUNNEL_LOG`).

Quick tunnels get a **new hostname every restart**. Re-run `npm run qr:tunnel` after the tunnel dies.

Manual equivalent (kit script):

```bash
bash node_modules/@penta2himajin/even-deskless/scripts/qr-tunnel.sh
```

### 3. Scan on the phone

1. Open the **Even Realities** app.
2. Use the developer / sideload QR scanner (same flow as other Even Hub plugins).
3. Scan the terminal QR.
4. The phone WebView should load the tunnel URL (plugin UI + phone mirror).

### 4. On the glasses

1. Wear the G2; confirm connected in the app.
2. Launch this plugin from the glasses / Hub menu (package id `com.pentalab.head-tilt-control`).
3. You should see the control list (`tap` / `dbl` / …). Phone mirror shows bindings, live IMU, and `debug-ws` status when the tunnel reaches this Vite instance.

### 5. Optional: flat gravity calib

On the phone mirror UI, use **平面キャリブ開始** / flat calib: place the glasses on a flat surface for ~2 seconds so `g₀` is stored. Then wear them and bind gestures as usual (long-press row + head gesture).

## What each npm script does

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite on `127.0.0.1:5173` |
| `npm run qr` | QR for **localhost only** — phone must reach that host |
| `npm run qr:tunnel` | even-deskless: quick tunnel (start or reuse) + `evenhub qr` |

## LAN alternative (no tunnel)

If the phone and the machine running Vite share a LAN:

1. Bind Vite so it listens on the LAN interface (this repo defaults to `127.0.0.1`; change `vite.config.ts` `server.host` to `true` / `0.0.0.0` if needed).
2. Find the machine IP (e.g. `192.168.x.x`).
3. `evenhub qr --url http://192.168.x.x:5173`

Do **not** use `npm run qr` (localhost) in that case unless the phone is somehow port-forwarded to the same machine.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| QR opens nothing / timeout | Vite down, or tunnel URL stale. Run `npm run dev`, then `npm run qr:tunnel` again. |
| Vite 403 on tunnel hostname | Missing `allowedHosts: true` in `vite.config.ts` (already set in this repo). |
| `qr:tunnel` cannot parse URL | Wait for cloudflared; check `/tmp/even-deskless-cf-tunnel.log` (or `CF_TUNNEL_LOG`). |
| Old UI after code change | Hard-refresh WebView / re-scan QR; Vite HMR may need a full reload on the phone. |
| Tunnel URL changed | Quick tunnels rotate hostnames — run `npm run qr:tunnel` again. |
