#!/bin/bash

# install-cron.sh
# Automatically install twitter-scout cron jobs
# Usage: bash install-cron.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔧 Installing twitter-scout cron jobs..."
echo ""

# Create logs directory
mkdir -p "$SKILL_DIR/logs"
chmod 755 "$SKILL_DIR/logs"
echo "✅ Created logs directory: $SKILL_DIR/logs"

# Check if env file exists
if [ ! -f ~/.openclaw/.env.bird ]; then
  echo "⚠️  WARNING: ~/.openclaw/.env.bird not found"
  echo "   Cron will fail without auth token"
  echo "   Please run: export BIRD_AUTH_TOKEN='...' && echo \"export BIRD_AUTH_TOKEN='$BIRD_AUTH_TOKEN'\" > ~/.openclaw/.env.bird"
  echo ""
fi

# Create cron entries
CRON_ENTRIES="
# Environment
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
TZ=Europe/Amsterdam

# twitter-scout: Fire Patrol (Pain Points) - Morning (06:30 MSK = 03:30 UTC)
30 3 * * * cd $SKILL_DIR && bash scripts/run-scout.sh fire-patrol

# twitter-scout: Fire Patrol (Pain Points) - Evening (17:30 MSK = 14:30 UTC)
30 14 * * * cd $SKILL_DIR && bash scripts/run-scout.sh fire-patrol

# twitter-scout: Brand Building (Trends) - Midday (14:00 MSK = 11:00 UTC)
0 11 * * * cd $SKILL_DIR && bash scripts/run-scout.sh brand-building
"

# Get current crontab (if exists)
CURRENT_CRONTAB=$(crontab -l 2>/dev/null || echo "")

# Check if entries already exist
if echo "$CURRENT_CRONTAB" | grep -q "twitter-scout"; then
  echo "⚠️  twitter-scout entries already exist in crontab"
  echo ""
  echo "Current entries:"
  crontab -l | grep twitter-scout
  echo ""
  read -p "Overwrite? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
  # Remove old entries
  CURRENT_CRONTAB=$(crontab -l | grep -v twitter-scout)
fi

# Combine and install
NEW_CRONTAB="$CURRENT_CRONTAB$CRON_ENTRIES"
echo "$NEW_CRONTAB" | crontab -

echo "✅ Installed cron jobs"
echo ""
echo "Schedule:"
echo "  Fire Patrol morning:   03:30 UTC (06:30 MSK)"
echo "  Brand Building:        11:00 UTC (14:00 MSK)"
echo "  Fire Patrol evening:   14:30 UTC (17:30 MSK)"
echo ""
echo "Verify with: crontab -l | grep twitter-scout"
echo ""
echo "View logs: tail -f $SKILL_DIR/logs/scout-*.log"
