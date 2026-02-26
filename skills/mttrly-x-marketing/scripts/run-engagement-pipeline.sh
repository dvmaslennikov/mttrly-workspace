#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-morning}"
if [[ "$MODE" != "morning" && "$MODE" != "evening" ]]; then
  echo "Usage: $0 [morning|evening]" >&2
  exit 1
fi

ROOT="/home/openclaw/.openclaw/workspace"
SKILL_DIR="$ROOT/skills/mttrly-x-marketing"
DIGEST_SCRIPT="$SKILL_DIR/scripts/bird-digest.sh"
AGENT_SCRIPT="$ROOT/playbooks/twitter/x-search-and-reply-bird.js"
LOG_DIR="$ROOT/logs/twitter"
LOCK_FILE="/tmp/mttrly-x-${MODE}.lock"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/pipeline-${MODE}-$(date +%Y%m%d).log"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[$(date -Is)] ${MODE}: already running, skip" | tee -a "$LOG_FILE"
  exit 0
fi

{
  echo "[$(date -Is)] START pipeline mode=$MODE"

  echo "[$(date -Is)] STEP 1: crawl via bird-digest"
  bash "$DIGEST_SCRIPT" "$MODE"

  echo "[$(date -Is)] STEP 2: rank/generate digest (timeout 1200s)"
  cd "$ROOT"
  timeout 1200s env SKIP_CRAWL=1 node "$AGENT_SCRIPT" "$MODE"

  echo "[$(date -Is)] DONE mode=$MODE"
} >> "$LOG_FILE" 2>&1
