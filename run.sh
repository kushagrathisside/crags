#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACTION="${1:-up}"
COMPOSE_CMD=()

usage() {
  cat <<'EOF'
Usage: ./run.sh [action]

Actions:
  up      Build and start full stack in foreground (default)
  upd     Build and start full stack in detached mode
  down    Stop and remove containers
  logs    Follow service logs
  ps      Show service status
  reset   Stop stack and remove database volume
EOF
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: docker command not found." >&2
    exit 1
  fi
}

select_compose() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
    return
  fi

  echo "ERROR: neither 'docker compose' plugin nor 'docker-compose' binary is available." >&2
  echo "Install Docker Compose v2 plugin (recommended) or docker-compose binary." >&2
  exit 1
}

cd "${ROOT_DIR}"
require_docker
select_compose

case "${ACTION}" in
  up)
    "${COMPOSE_CMD[@]}" up --build
    ;;
  upd)
    "${COMPOSE_CMD[@]}" up --build -d
    ;;
  down)
    "${COMPOSE_CMD[@]}" down --remove-orphans
    ;;
  logs)
    "${COMPOSE_CMD[@]}" logs -f
    ;;
  ps)
    "${COMPOSE_CMD[@]}" ps
    ;;
  reset)
    "${COMPOSE_CMD[@]}" down --remove-orphans --volumes
    ;;
  *)
    usage
    exit 1
    ;;
esac
