#!/usr/bin/env bash
set -euo pipefail

API_URL="${OPS_TRAFFIC_API_URL:-https://web-info.cccy.fun/api/server-traffic}"
SERVER_KEY="${OPS_TRAFFIC_SERVER_KEY:-$(hostname -s)}"
SERVER_NAME="${OPS_TRAFFIC_SERVER_NAME:-${SERVER_KEY}}"
PROVIDER="${OPS_TRAFFIC_PROVIDER:-oracle}"
REGION="${OPS_TRAFFIC_REGION:-sg}"
IFACE="${OPS_TRAFFIC_INTERFACE:-}"
QUOTA_BYTES="${OPS_TRAFFIC_QUOTA_BYTES:-10995116277760}"

if [[ -f /etc/opspilot-api.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /etc/opspilot-api.env
  set +a
fi
if [[ -f /etc/opspilot-web.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /etc/opspilot-web.env
  set +a
fi

TOKEN="${OPS_TRAFFIC_TOKEN:-${OPSPILOT_TOKEN:-${NEXT_PUBLIC_INGEST_TOKEN:-}}}"
if [[ -z "${TOKEN}" && -n "${OPS_TRAFFIC_TOKEN_FILE:-}" && -f "${OPS_TRAFFIC_TOKEN_FILE}" ]]; then
  TOKEN="$(tr -d '\r\n' < "${OPS_TRAFFIC_TOKEN_FILE}")"
fi
DB_PATH="${OPSPILOT_DB:-/opt/opspilot/server/data/opspilot.sqlite}"
if [[ -z "${TOKEN}" && -f "${DB_PATH}" ]]; then
  TOKEN="$(python3 -c 'import sqlite3, sys
db = sqlite3.connect(sys.argv[1])
row = db.execute("SELECT value FROM settings WHERE key = ?", ("token",)).fetchone()
print(row[0] if row else "")
' "${DB_PATH}")"
fi
if [[ -z "${TOKEN}" ]]; then
  echo "missing OPS_TRAFFIC_TOKEN or OPSPILOT_TOKEN" >&2
  exit 1
fi

if [[ -z "${IFACE}" ]]; then
  IFACE="$(ip -o -4 route show to default | awk '{print $5; exit}')"
fi
if [[ -z "${IFACE}" ]]; then
  echo "cannot detect default network interface" >&2
  exit 1
fi

payload="$(
  vnstat --json m 1 -i "${IFACE}" | python3 -c '
import datetime as dt
import json
import sys

server_key, server_name, provider, region, iface_name, quota = sys.argv[1:]
data = json.load(sys.stdin)
interfaces = data.get("interfaces") or []
if not interfaces:
    raise SystemExit("vnstat returned no interfaces")

iface = interfaces[0]
months = iface.get("traffic", {}).get("month") or []
if not months:
    raise SystemExit(f"vnstat returned no monthly data for {iface_name}")

month = max(months, key=lambda x: x.get("timestamp", 0))
date = month["date"]
period = "{:04d}-{:02d}".format(date["year"], date["month"])
updated = iface.get("updated", {})
sample_ts = updated.get("timestamp") or month.get("timestamp")
sampled_at = dt.datetime.fromtimestamp(sample_ts, dt.timezone.utc).isoformat() if sample_ts else dt.datetime.now(dt.timezone.utc).isoformat()

print(json.dumps({
    "server_key": server_key,
    "server_name": server_name,
    "provider": provider,
    "region": region,
    "interface": iface.get("name") or iface_name,
    "period": period,
    "rx_bytes": int(month.get("rx") or 0),
    "tx_bytes": int(month.get("tx") or 0),
    "quota_bytes": int(quota),
    "source": "vnstat",
    "sampled_at": sampled_at,
}))
  ' "${SERVER_KEY}" "${SERVER_NAME}" "${PROVIDER}" "${REGION}" "${IFACE}" "${QUOTA_BYTES}"
)"

curl -fsS -X POST "${API_URL}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${payload}"
echo
