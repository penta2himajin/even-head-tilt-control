#!/usr/bin/env bash
# Start a Cloudflare quick tunnel to the Vite dev server and tee the log
# path expected by `npm run qr:tunnel`.
set -euo pipefail

PORT="${VITE_PORT:-5173}"
LOG="${CF_TUNNEL_LOG:-/tmp/cf-tunnel.log}"
TARGET="http://127.0.0.1:${PORT}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found on PATH." >&2
  echo "Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/" >&2
  exit 1
fi

if ! curl -sf -o /dev/null "${TARGET}/"; then
  echo "Vite does not look up at ${TARGET}" >&2
  echo "Start it in another terminal: npm run dev" >&2
  exit 1
fi

echo "Tunneling ${TARGET} → (log: ${LOG})"
echo "When the trycloudflare.com URL appears, run: npm run qr:tunnel"
exec cloudflared tunnel --url "${TARGET}" 2>&1 | tee "${LOG}"
