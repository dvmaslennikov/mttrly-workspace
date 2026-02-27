#!/bin/bash

# run-scout.sh
# Wrapper for cron execution with logging and error handling
# Usage: ./run-scout.sh fire-patrol|brand-building

set -euo pipefail

MODE="${1:-fire-patrol}"
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
    *)
      log "ERROR: Unknown mode: $MODE (use fire-patrol or brand-building)"
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
    return $exit_code
  fi

  # Find latest candidates file and process digest
  local WORKSPACE_DIR
  WORKSPACE_DIR="$(cd "$SKILL_DIR/../.." && pwd)"
  local LATEST
  LATEST=$(ls -t "$WORKSPACE_DIR"/daily-packs/${MODE}-candidates-*.json 2>/dev/null | head -1)

  if [ -n "$LATEST" ]; then
    log ""
    log "Processing digest: $LATEST"
    if node "$SCRIPT_DIR/process-digest.js" "$LATEST" >> "$LOG_FILE" 2>&1; then
      log "✅ Digest processed and sent"
    else
      log "⚠️ Digest processing failed (non-fatal)"
    fi
  else
    log "⚠️ No candidates file found for $MODE"
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
