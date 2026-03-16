#!/bin/bash

# run-scout.sh
# Wrapper for cron execution with logging and error handling
# Usage: ./run-scout.sh fire-patrol|brand-building

set -euo pipefail

MODE="${1:-fire-patrol}"

# Prevent parallel execution of the same mode
LOCK_FILE="/tmp/scout-${MODE}.lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] Another $MODE instance is running, skipping"
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="${SKILL_DIR}/logs"
TIMESTAMP=$(date -u +%Y-%m-%d_%H-%M-%S)
LOG_FILE="${LOG_DIR}/scout-${MODE}-${TIMESTAMP}.log"

# Create log directory
mkdir -p "$LOG_DIR"

# Load environment
export_env() {
  if [ -f ~/.openclaw/.env.bird ]; then
    source ~/.openclaw/.env.bird
  else
    echo "ERROR: ~/.openclaw/.env.bird not found" | tee -a "$LOG_FILE"
    return 1
  fi
}

# Log wrapper
log() {
  echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] $*" | tee -a "$LOG_FILE"
}

# Telegram alert for failures
send_telegram_alert() {
  local alert_msg="$1"
  local WORKSPACE_DIR
  WORKSPACE_DIR="$(cd "$SKILL_DIR/../.." && pwd)"
  local OPENCLAW_DIR
  OPENCLAW_DIR="$(dirname "$WORKSPACE_DIR")"
  local CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"

  if [ ! -f "$CONFIG_FILE" ]; then
    log "WARN: Cannot send Telegram alert — openclaw.json not found"
    return 1
  fi

  local BOT_TOKEN
  BOT_TOKEN=$(node -e "const c=require('$CONFIG_FILE'); console.log(c.channels?.telegram?.botToken||'')" 2>/dev/null)
  local CHAT_ID
  CHAT_ID=$(node -e "const a=require('$OPENCLAW_DIR/credentials/telegram-default-allowFrom.json'); const ids=a.allowFrom||a; console.log(Array.isArray(ids)?ids[0]:'')" 2>/dev/null)

  if [ -z "$BOT_TOKEN" ] || [ -z "$CHAT_ID" ]; then
    log "WARN: Cannot send Telegram alert — missing bot token or chat ID"
    return 1
  fi

  curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "$(node -e "console.log(JSON.stringify({chat_id:'${CHAT_ID}',text:'${alert_msg}',parse_mode:'HTML'}))")" \
    > /dev/null 2>&1

  log "Telegram failure alert sent"
}

# Main execution
main() {
  log "=== twitter-scout $MODE run started ==="
  log "Script dir: $SCRIPT_DIR"
  log "Log file: $LOG_FILE"
  log ""
  
  # Load env
  if ! export_env; then
    log "ERROR: Failed to load environment"
    return 1
  fi
  log "Environment loaded"
  
  # Select script
  local scout_script
  case "$MODE" in
    fire-patrol)
      scout_script="${SCRIPT_DIR}/scout-fire-patrol.sh"
      ;;
    brand-building)
      scout_script="${SCRIPT_DIR}/scout-brand-building.sh"
      ;;
    influencer-monitor)
      scout_script="${SCRIPT_DIR}/scout-influencer-monitor.sh"
      ;;
    *)
      log "ERROR: Unknown mode: $MODE (use fire-patrol, brand-building, or influencer-monitor)"
      return 1
      ;;
  esac
  
  # Check script exists
  if [ ! -f "$scout_script" ]; then
    log "ERROR: Script not found: $scout_script"
    return 1
  fi
  
  # Execute
  log "Executing: $scout_script"
  log ""
  
  if bash "$scout_script" >> "$LOG_FILE" 2>&1; then
    log ""
    log "✅ Scan completed successfully"
  else
    local exit_code=$?
    log ""
    log "❌ Scan failed with exit code: $exit_code"

    # Determine failure reason from log
    local fail_reason="unknown error (exit code $exit_code)"
    if grep -qi "401\|403\|auth" "$LOG_FILE" 2>/dev/null; then
      fail_reason="Auth failure (cookies expired?). Update ~/.openclaw/.env.bird"
    elif grep -qi "429\|rate.limit" "$LOG_FILE" 2>/dev/null; then
      fail_reason="Rate limited by Twitter. Will retry next scheduled run."
    elif grep -qi "All.*queries failed" "$LOG_FILE" 2>/dev/null; then
      fail_reason="All queries failed. Check bird CLI and auth."
    fi

    send_telegram_alert "⚠️ <b>Scout ${MODE} FAILED</b>\n\nReason: ${fail_reason}\nTime: $(date -u +%Y-%m-%d\ %H:%M\ UTC)"

    return $exit_code
  fi

  # Find latest candidates file from bird scan
  local WORKSPACE_DIR
  WORKSPACE_DIR="$(cd "$SKILL_DIR/../.." && pwd)"
  local BIRD_FILE
  BIRD_FILE=$(ls -t "$WORKSPACE_DIR"/daily-packs/${MODE}-candidates-*.json 2>/dev/null | head -1)

  if [ -z "$BIRD_FILE" ]; then
    log "⚠️ No candidates file found for $MODE"
    return 0
  fi

  # Grok supplementary search (optional — needs XAI_API_KEY)
  local DIGEST_INPUT="$BIRD_FILE"
  if [ -n "${XAI_API_KEY:-}" ]; then
    log ""
    log "Running Grok supplementary search..."
    local GROK_FILE="$WORKSPACE_DIR/daily-packs/${MODE}-grok-$(date -u +%Y-%m-%dT%H:%M:%SZ).json"
    local MERGED_FILE="$WORKSPACE_DIR/daily-packs/${MODE}-merged-$(date -u +%Y-%m-%dT%H:%M:%SZ).json"

    if node "$SCRIPT_DIR/grok-search.js" "$MODE" "$GROK_FILE" >> "$LOG_FILE" 2>&1; then
      log "✅ Grok search completed"
      # Merge bird + grok results
      if node "$SCRIPT_DIR/merge-candidates.js" "$BIRD_FILE" "$GROK_FILE" -o "$MERGED_FILE" >> "$LOG_FILE" 2>&1; then
        log "✅ Candidates merged"
        DIGEST_INPUT="$MERGED_FILE"
      else
        log "⚠️ Merge failed, using bird-only results"
      fi
    else
      log "⚠️ Grok search failed (non-fatal), using bird-only results"
    fi
  else
    log "Grok search: skipped (no XAI_API_KEY)"
  fi

  # Process digest (pass 1)
  log ""
  log "Processing digest: $DIGEST_INPUT"
  if node "$SCRIPT_DIR/process-digest.js" "$DIGEST_INPUT" >> "$LOG_FILE" 2>&1; then
    log "✅ Digest processed and sent"
  else
    log "⚠️ Digest processing failed (non-fatal)"
    send_telegram_alert "⚠️ <b>Digest processing failed</b> (${MODE})\nCheck log: ${LOG_FILE}"
  fi

  # If result is weak (<=3 tweets) or empty, run one extra Grok pass and re-process
  local NEED_RETRY=0
  local TOP_COUNT=-1
  local DIGEST_FILE="$WORKSPACE_DIR/daily-packs/${MODE}-digest-$(date -u +%Y-%m-%d).json"

  if grep -q "No tweets passed filters" "$LOG_FILE" 2>/dev/null; then
    NEED_RETRY=1
  fi

  if [ -f "$DIGEST_FILE" ]; then
    TOP_COUNT=$(node -e "const fs=require('fs');const f=process.argv[1];try{const d=JSON.parse(fs.readFileSync(f,'utf8'));console.log((d.stats&&typeof d.stats.top==='number')?d.stats.top:-1);}catch(e){console.log(-1);}" "$DIGEST_FILE" 2>/dev/null || echo -1)
    if [ "$TOP_COUNT" -ge 0 ] && [ "$TOP_COUNT" -le 3 ]; then
      NEED_RETRY=1
    fi
  fi

  # Skip Grok retry if on cooldown (429 rate limit)
  local GROK_ON_COOLDOWN=0
  if [ -f /tmp/grok-cooldown ]; then
    GROK_ON_COOLDOWN=1
  fi

  if [ "$NEED_RETRY" -eq 1 ] && [ -n "${XAI_API_KEY:-}" ] && [ "$GROK_ON_COOLDOWN" -eq 0 ]; then
    log ""
    log "⚠️ Low result (top=$TOP_COUNT). Running one extra Grok pass..."

    local GROK_RETRY_FILE="$WORKSPACE_DIR/daily-packs/${MODE}-grok-retry-$(date -u +%Y-%m-%dT%H:%M:%SZ).json"
    local MERGED_RETRY_FILE="$WORKSPACE_DIR/daily-packs/${MODE}-merged-retry-$(date -u +%Y-%m-%dT%H:%M:%SZ).json"

    if node "$SCRIPT_DIR/grok-search.js" "$MODE" "$GROK_RETRY_FILE" >> "$LOG_FILE" 2>&1; then
      log "✅ Extra Grok pass completed"
      if node "$SCRIPT_DIR/merge-candidates.js" "$BIRD_FILE" "$GROK_RETRY_FILE" -o "$MERGED_RETRY_FILE" >> "$LOG_FILE" 2>&1; then
        log "✅ Retry candidates merged"
        log "Processing retry digest: $MERGED_RETRY_FILE"
        if node "$SCRIPT_DIR/process-digest.js" "$MERGED_RETRY_FILE" >> "$LOG_FILE" 2>&1; then
          log "✅ Retry digest processed and sent"
        else
          log "⚠️ Retry digest processing failed (non-fatal)"
        fi
      else
        log "⚠️ Retry merge failed, skipping retry digest"
      fi
    else
      log "⚠️ Extra Grok pass failed, skipping retry"
    fi
  elif [ "$NEED_RETRY" -eq 1 ] && [ "$GROK_ON_COOLDOWN" -eq 1 ]; then
    log ""
    log "⏭️ Skipping Grok retry — on cooldown (429 rate limit)"
  fi

  # Cleanup old candidates files (older than 3 days)
  find "$WORKSPACE_DIR/daily-packs" -name "*-candidates-*.json" -mtime +3 -delete 2>/dev/null || true

  return 0
}

# Execute
if main; then
  log "=== twitter-scout $MODE run completed ==="
  exit 0
else
  log "=== twitter-scout $MODE run failed ==="
  exit 1
fi
