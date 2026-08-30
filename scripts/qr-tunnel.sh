#!/usr/bin/env bash
# Print an Even Hub sideload QR for the active Cloudflare quick tunnel.
set -euo pipefail

LOG="${CF_TUNNEL_LOG:-/tmp/cf-tunnel.log}"

if [[ ! -f "${LOG}" ]]; then
  echo "Tunnel log not found: ${LOG}" >&2
  echo "Start the tunnel first: npm run tunnel   (or bash scripts/dev-tunnel.sh)" >&2
  exit 1
fi

URL="$(grep -Eo 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "${LOG}" | head -1 || true)"

if [[ -z "${URL}" ]]; then
  echo "No trycloudflare.com URL in ${LOG} yet." >&2
  echo "Wait until cloudflared prints the tunnel URL, then retry." >&2
  exit 1
fi

echo "Sideload URL: ${URL}"
exec evenhub qr --url "${URL}"
