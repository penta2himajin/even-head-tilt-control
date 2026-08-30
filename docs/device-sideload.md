# Device sideload (QR + tunnel)

How to run this plugin on real G2 glasses from a Cloud Agent / remote VM, or from a laptop that the phone cannot reach on `localhost`.

## Why a tunnel is required

`npm run qr` alone prints a QR for `http://127.0.0.1:5173`. That URL is only reachable on the machine running Vite.

- **Cloud Agent / remote VM**: the phone has no route to that loopback → scan fails or loads nothing.
- **Same LAN laptop**: you can often use `http://<lan-ip>:5173` instead of a tunnel (see [LAN alternative](#lan-alternative-no-tunnel)).

For Cloud Agent sessions, use a **public HTTPS tunnel** (Cloudflare quick tunnel is the default recipe here), then generate the QR against that URL.

Vite already sets `server.allowedHosts: true` so Cloudflare hostnames are accepted.

## Prerequisites

- Node 20+
- Even Realities app on the phone (developer / sideload QR flow)
- G2 paired and wearing
- `evenhub` CLI available via `npm` scripts (`@evenrealities/evenhub-cli`)
- One-time: `npx evenhub login` (or `evenhub login`) if the CLI asks for auth

```bash
npm ci
```

## End-to-end (Cloud Agent / remote)

Open **three terminals** (or three tmux panes) in the repo root.

### 1. Start the Vite dev server

```bash
npm run dev
```

Leave it running. Confirm locally:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/
# expect 200
```

### 2. Start a Cloudflare quick tunnel

Install `cloudflared` if needed, then:

```bash
# Linux example — download once, then reuse
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

cloudflared tunnel --url http://127.0.0.1:5173 2>&1 | tee /tmp/cf-tunnel.log
```

Or use the helper (same log path the npm scripts expect):

```bash
bash scripts/dev-tunnel.sh
```

Wait until the log shows a URL like:

```text
https://<random-words>.trycloudflare.com
```

Quick tunnels get a **new hostname every restart**. Re-run the QR step after each tunnel restart.

### 3. Print the sideload QR

With the tunnel still running:

```bash
npm run qr:tunnel
```

This reads the first `*.trycloudflare.com` URL from `/tmp/cf-tunnel.log` and runs `evenhub qr --url <that-https-url>`.

Manual equivalent:

```bash
URL=$(grep -Eo 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' /tmp/cf-tunnel.log | head -1)
echo "$URL"
evenhub qr --url "$URL"
```

### 4. Scan on the phone

1. Open the **Even Realities** app.
2. Use the developer / sideload QR scanner (same flow as other Even Hub plugins).
3. Scan the terminal QR.
4. The phone WebView should load the tunnel URL (plugin UI + phone mirror).

### 5. On the glasses

1. Wear the G2; confirm connected in the app.
2. Launch this plugin from the glasses / Hub menu (package id `com.pentalab.head-tilt-control`).
3. You should see the control list (`tap` / `dbl` / …). Phone mirror shows bindings and `debug-ws` status when the tunnel reaches this Vite instance.

### 6. Optional: flat gravity calib

On the phone mirror UI, use **平面キャリブ開始** / flat calib: place the glasses on a flat surface for ~2 seconds so `g₀` is stored. Then wear them and bind gestures as usual (long-press row + head gesture).

## What each npm script does

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite on `127.0.0.1:5173` |
| `npm run qr` | QR for **localhost only** — phone must reach that host |
| `npm run qr:tunnel` | QR for the Cloudflare URL in `/tmp/cf-tunnel.log` |
| `bash scripts/dev-tunnel.sh` | Starts `cloudflared` → Vite, tees log to `/tmp/cf-tunnel.log` |

## LAN alternative (no tunnel)

If the phone and the machine running Vite share a LAN:

1. Bind Vite so it listens on the LAN interface (this repo defaults to `127.0.0.1`; change `vite.config.ts` `server.host` to `true` / `0.0.0.0` if needed).
2. Find the machine IP (e.g. `192.168.x.x`).
3. `evenhub qr --url http://192.168.x.x:5173`
4. Scan with the Even app.

Do **not** use `npm run qr` (localhost) in that case unless the phone is somehow port-forwarded to the same machine.

## Troubleshooting

| Symptom | Check |
|---------|--------|
| QR opens nothing / timeout | Tunnel down, or QR still points at `127.0.0.1`. Re-run `npm run qr:tunnel` after tunnel is up. |
| Vite “Blocked request” / host not allowed | Ensure `server.allowedHosts: true` (already set in `vite.config.ts`). |
| `qr:tunnel` prints empty URL | `/tmp/cf-tunnel.log` missing or no `trycloudflare.com` line yet — wait for tunnel ready, or wrong log path. |
| Old UI after code change | Hard-refresh WebView / re-scan QR; Vite HMR may need a full reload on the phone. |
| Glasses list empty / no IMU | Glasses connected + wearing; plugin foreground; IMU opens after Hub bridge ready (`[head-tilt] ready` in logs). |
| Tunnel URL changed | Quick tunnels rotate hostnames — new QR required. |

## Related

- Deskless (no glasses): `npm run verify:deskless` and `?mockImu=1` — see root [README.md](../README.md).
- Pose / binding behaviour: phone mirror + long-press binding on the glasses list.
