#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_PORT="${API_PORT:-8080}"
WEB_PORT="${WEB_PORT:-3000}"
API_BASE="${NEXT_PUBLIC_API_BASE:-http://localhost:${API_PORT}}"

usage() {
  cat <<EOF
Usage: ./dev.sh

Starts OpsPilot API and web dev server together.

Environment:
  API_PORT              Go API port (default: 8080)
  WEB_PORT              Next.js port (default: 3000)
  OPSPILOT_TOKEN        API bearer token (default handled by server)
  NEXT_PUBLIC_API_BASE  Frontend API URL (default: http://localhost:\$API_PORT)
EOF
}

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd go
require_cmd npm

if [[ ! -d "$ROOT_DIR/web/node_modules" ]]; then
  echo "[web] node_modules not found; running npm install"
  (cd "$ROOT_DIR/web" && npm install)
fi

pids=()

cleanup() {
  local code=$?
  trap - INT TERM EXIT
  if ((${#pids[@]})); then
    echo
    echo "Stopping OpsPilot..."
    kill "${pids[@]}" >/dev/null 2>&1 || true
    wait "${pids[@]}" >/dev/null 2>&1 || true
  fi
  exit "$code"
}
trap cleanup INT TERM EXIT

echo "[api] http://localhost:${API_PORT}"
(cd "$ROOT_DIR/server" && OPSPILOT_ADDR=":${API_PORT}" go run .) &
pids+=("$!")

echo "[web] http://localhost:${WEB_PORT}"
(cd "$ROOT_DIR/web" && NEXT_PUBLIC_API_BASE="$API_BASE" npm run dev -- --port "$WEB_PORT") &
pids+=("$!")

echo
echo "OpsPilot is starting."
echo "  API: $API_BASE"
echo "  Web: http://localhost:${WEB_PORT}"
echo "Press Ctrl+C to stop both."

while true; do
  for pid in "${pids[@]}"; do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      exit_code=1
      wait "$pid" || exit_code=$?
      exit "$exit_code"
    fi
  done
  sleep 1
done
