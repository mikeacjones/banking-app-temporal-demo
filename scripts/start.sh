#!/bin/bash
set -e

# Banking Transfer Demo — Launcher
# Usage: ./scripts/start.sh [--encrypt]
#
# Prefers Docker for backend/worker/frontend.
# Falls back to running everything locally if Docker isn't available.
# Temporal CLI dev server always runs on the host.
#
# Options:
#   --encrypt   Enable AES-GCM payload encryption + codec server

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MISSING=()
ENCRYPT=""

# -- Parse flags --
for arg in "$@"; do
  case "$arg" in
    --encrypt) ENCRYPT=1 ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

# -- Check Temporal CLI (always required) --
command -v temporal >/dev/null 2>&1 || MISSING+=("temporal CLI  — brew install temporal")

# -- Determine mode --
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  MODE="docker"
else
  command -v uv >/dev/null 2>&1 || MISSING+=("uv           — https://docs.astral.sh/uv/")
  command -v npm >/dev/null 2>&1 || MISSING+=("node/npm     — https://nodejs.org/")
  MODE="local"
fi

# -- Bail if anything is missing --
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "Missing required tools:"
  echo ""
  for m in "${MISSING[@]}"; do
    echo "  x $m"
  done
  echo ""
  echo "Install the above and try again."
  exit 1
fi

cd "$ROOT_DIR"
PIDS=()

cleanup() {
  echo ""
  echo "Shutting down..."
  if [ "$MODE" = "docker" ]; then
    docker compose --profile encrypt down --remove-orphans 2>/dev/null || true
  fi
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null
  echo "Done."
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "======================================"
echo "  Banking Transfer Demo Launcher"
if [ "$ENCRYPT" = "1" ]; then
  echo "  (encryption enabled)"
fi
echo "======================================"
echo ""

# -- Clean up stale containers --
if [ "$MODE" = "docker" ]; then
  docker compose --profile encrypt down --remove-orphans 2>/dev/null || true
fi

# -- Start Temporal dev server (always on host) --
echo "Starting Temporal dev server..."
temporal server start-dev --log-level warn --db-filename "/tmp/banking-demo-temporal-$$.db" &
PIDS+=($!)

echo "Waiting for Temporal..."
for i in $(seq 1 15); do
  if temporal operator namespace describe default >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Register search attribute for Advanced Visibility scenario
echo "Registering search attributes..."
temporal operator search-attribute create --name Step --type Keyword 2>/dev/null || true

# =============================================
if [ "$MODE" = "docker" ]; then
# =============================================

  DOCKER_PROFILES=""
  if [ "$ENCRYPT" = "1" ]; then
    DOCKER_PROFILES="--profile encrypt"
  fi

  echo "Starting Docker containers..."
  BANKING_ENCRYPT="${ENCRYPT}" docker compose $DOCKER_PROFILES up --build -d

  BANNER_EXTRA=""
  if [ "$ENCRYPT" = "1" ]; then
    BANNER_EXTRA="\n  Encryption: ON (AES-GCM)"
    BANNER_EXTRA="$BANNER_EXTRA\n  Codec:      http://localhost:8081"
    BANNER_EXTRA="$BANNER_EXTRA\n              (set as codec endpoint in Temporal UI)"
  fi

  echo ""
  echo "======================================"
  echo "  Banking Transfer Demo is running!"
  echo ""
  echo "  App:        http://localhost:5173"
  echo "  API:        http://localhost:8000"
  echo "  Temporal:   http://localhost:8233"
  echo -e "$BANNER_EXTRA"
  echo ""
  echo "  Ctrl+C to stop everything"
  echo "======================================"

  while true; do sleep 1; done

# =============================================
else
# =============================================

  echo "Installing dependencies..."
  uv sync --all-packages --quiet 2>/dev/null || uv sync --all-packages
  (cd frontend && npm install --silent 2>/dev/null) || (cd frontend && npm install)

  echo "Starting backend..."
  uv run --package banking-demo-backend server &
  PIDS+=($!)

  echo "Waiting for backend..."
  for i in $(seq 1 15); do
    if curl -s http://localhost:8000/api/health >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  echo "Starting worker..."
  BANKING_ENCRYPT="${ENCRYPT}" BANKING_BACKEND_URL=http://localhost:8000 uv run --package banking-demo-workflows worker &
  PIDS+=($!)

  # Start codec server if encryption is enabled
  if [ "$ENCRYPT" = "1" ]; then
    echo "Starting codec server on :8081..."
    uv run python -m banking_workflows.codec_server &
    PIDS+=($!)
  fi

  echo "Starting frontend..."
  (cd "$ROOT_DIR/frontend" && npm run dev -- --open) &
  PIDS+=($!)

  BANNER_EXTRA=""
  if [ "$ENCRYPT" = "1" ]; then
    BANNER_EXTRA="  Encryption: ON (AES-GCM)\n  Codec:      http://localhost:8081\n              (set as codec endpoint in Temporal UI)\n"
  fi

  echo ""
  echo "======================================"
  echo "  Banking Transfer Demo is running!"
  echo ""
  echo "  App:        http://localhost:5173"
  echo "  API:        http://localhost:8000"
  echo "  Temporal:   http://localhost:8233"
  if [ -n "$BANNER_EXTRA" ]; then
    echo -e "$BANNER_EXTRA"
  fi
  echo ""
  echo "  Ctrl+C to stop all services"
  echo "======================================"

  wait
fi
