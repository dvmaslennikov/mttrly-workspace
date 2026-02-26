#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

AUTH="${BIRD_AUTH_TOKEN:-${TWITTER_AUTH_TOKEN:-${X_AUTH_TOKEN:-}}}"
CT0="${BIRD_CT0:-${TWITTER_CT0:-${X_CT0:-}}}"

if [[ -z "$AUTH" || -z "$CT0" ]]; then
  echo "[bird.sh] Missing auth cookies." >&2
  echo "Set BIRD_AUTH_TOKEN and BIRD_CT0 in $ENV_FILE" >&2
  exit 1
fi

cd "$ROOT_DIR"
exec npx bird --auth-token "$AUTH" --ct0 "$CT0" "$@"
