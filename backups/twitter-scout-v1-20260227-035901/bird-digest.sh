#!/bin/bash
##############################################################################
# bird-digest.sh
# 
# Собирает дайджест для Twitter engagement через bird CLI (бесплатный поиск)
# 
# Usage: ./bird-digest.sh [morning|evening]
# 
# Requires:
#   - npx bird (installed globally or locally)
#   - BIRD_AUTH_TOKEN и BIRD_CT0 (из cookies x.com)
#   - data/engagement-tracking.md (для дедупликации)
#
##############################################################################

set -euo pipefail

MODE=${1:-morning}
HOURS=12
[ "$MODE" = "evening" ] && HOURS=8

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../../data"
TRACKING_FILE="$DATA_DIR/x-engagement-tracking.md"
DIGEST_DIR="$SCRIPT_DIR/../../daily-packs"

# Create directories
mkdir -p "$DATA_DIR" "$DIGEST_DIR"

# Initialize tracking file if needed
if [ ! -f "$TRACKING_FILE" ]; then
  cat > "$TRACKING_FILE" << 'EOF'
# X Engagement Tracking

## Replied To
(none yet)

## Skipped
(none yet)
EOF
fi

# Bird credentials (from ~/.openclaw/.env.bird or pass via flags)
BIRD_AUTH=${BIRD_AUTH_TOKEN:-""}
BIRD_CT=${BIRD_CT0:-""}

if [ -z "$BIRD_AUTH" ] || [ -z "$BIRD_CT" ]; then
  echo "❌ Missing BIRD_AUTH_TOKEN or BIRD_CT0"
  echo "Export them: source ~/.openclaw/.env.bird"
  exit 1
fi

BIRD_CMD="npx bird --auth-token '$BIRD_AUTH' --ct0 '$BIRD_CT'"

echo "🔍 Scanning Twitter ($MODE mode, last ${HOURS}h)..."
echo ""

# ============================================================================
# КАТЕГОРИЯ 1: PAIN POINTS (high priority, dev-focused)
# ============================================================================

echo "📌 Collecting Pain Points..."

PAIN_QUERIES=(
  '"deployment failed" AND (server OR deploy OR kubernetes OR docker) -railway -vercel -heroku'
  '"deploy broke" OR "push to prod failed" (kubernetes OR docker OR CI/CD) -indigo -railway'
  '"3am alert" OR "pager went off" OR "on-call incident" (server OR devops OR deployment)'
  '"nginx error" OR "502 bad gateway" (deployment OR rollback OR incident) -railway -render'
  '"app crashed" AND (deployment OR production OR incident) -instagram -facebook -banking'
  '"rollback" OR "incident response" OR "postmortem" (deployment OR infrastructure OR devops)'
  '"prod down" OR "production incident" OR "outage" (deployment OR infra) -airline -bank -payment'
)

> /tmp/pain_points.json
for query in "${PAIN_QUERIES[@]}"; do
  echo "  Searching: $query" >&2
  eval "$BIRD_CMD search '$query' -n 10 --json 2>/dev/null" >> /tmp/pain_points.json || true
  sleep 2  # rate limit respect
done
echo "✓ Pain points collected"

# ============================================================================
# КАТЕГОРИЯ 2: AUDIENCE SIGNALS (high priority)
# ============================================================================

echo "📌 Collecting Audience Signals..."

AUDIENCE_QUERIES=(
  '"vibe coding" OR "vibe coder" OR "#vibecoding" (deploy OR server OR devops)'
  '"built with cursor" OR "built with claude" (deploy OR hosting OR server) -windows'
  '"solo founder" (devops OR server OR deploy OR production) -crypto -shopify'
  '"indie hacker" (server OR deploy OR hosting OR production) -crypto -dropship'
  '"can'\''t afford devops" OR "no devops" (deploy OR production OR infrastructure)'
  '"first VPS" OR "first server" (deploy OR production OR learn) -windows -hosting-promo'
  '"learning to deploy" OR "deploying my app" (first time OR scared OR anxiety)'
  '"got my app deployed" OR "deployed to production" (indie OR solo OR first time)'
)

> /tmp/audience_signals.json
for query in "${AUDIENCE_QUERIES[@]}"; do
  echo "  Searching: $query" >&2
  eval "$BIRD_CMD search '$query' -n 10 --json 2>/dev/null" >> /tmp/audience_signals.json || true
  sleep 2
done
echo "✓ Audience signals collected"

# ============================================================================
# КАТЕГОРИЯ 3: КОНКУРЕНТЫ & PAIN PATTERNS (medium priority)
# ============================================================================

echo "📌 Collecting Competitor & Pain Pattern Mentions..."

COMPETITOR_QUERIES=(
  '"vercel expensive" OR "railway pricing" OR "render slow" -crypto'
  '"moved from heroku" OR "heroku alternative" OR "left vercel" -crypto'
  '"need something simpler" (hosting OR deploy OR infrastructure) -shopify'
  '"too complex" (kubernetes OR docker OR "CI/CD") -kubernetes-guide -tutorial'
  '"just want to deploy" OR "deploy should be simple" (app OR server OR production) -windows'
  '"kubernetes overkill" OR "k8s too much" (simple OR small project OR indie)'
  '"deployment anxiety" OR "afraid to deploy" (first OR learning OR help)'
)

> /tmp/competitors.json
for query in "${COMPETITOR_QUERIES[@]}"; do
  echo "  Searching: $query" >&2
  eval "$BIRD_CMD search '$query' -n 10 --json 2>/dev/null" >> /tmp/competitors.json || true
  sleep 2
done
echo "✓ Competitors collected"

# ============================================================================
# КАТЕГОРИЯ 4: WATCHLIST (priority based on account)
# ============================================================================

echo "📌 Monitoring Watchlist..."

WATCHLIST=(
  "levelsio"              # Indie hacker, deployment wisdom
  "kelseyhightower"       # Kubernetes, DevOps authority
  "rakyll"                # Go, observability, production insights
  "copyconstruct"         # Systems design, production concerns
  "jezhumble"             # DevOps, continuous delivery pioneer
  "allspaw"               # On-call, incident response culture
  "tdinh_me"              # Infrastructure, deployment patterns
  "DanielFosworthy"       # DevOps, automation
  "railway"               # Platform competitor (signal monitoring)
  "vercel"                # Platform competitor (signal monitoring)
  "render"                # Platform competitor (signal monitoring)
)

> /tmp/watchlist.json
for handle in "${WATCHLIST[@]}"; do
  echo "  Fetching tweets from @$handle..." >&2
  eval "$BIRD_CMD user-tweets @$handle -n 5 --json 2>/dev/null" >> /tmp/watchlist.json || true
  sleep 2
done
echo "✓ Watchlist collected"

# ============================================================================
# AGGREGATION
# ============================================================================

echo ""
echo "📊 Aggregating results..."

cat > /tmp/raw_digest.json << 'AGGEOF'
{
  "timestamp": "$(date -Iseconds)",
  "mode": "$MODE",
  "categories": {
    "pain_points": [],
    "audience": [],
    "competitors": [],
    "watchlist": []
  }
}
AGGEOF

# Merge results (this is simplified - in real implementation, parse and filter)
echo "✓ Raw data collected to /tmp/*"
echo "✓ Total files: pain_points.json, audience_signals.json, competitors.json, watchlist.json"

# ============================================================================
# OUTPUT
# ============================================================================

OUTPUT_FILE="$DIGEST_DIR/digest-$(date +%Y%m%d-%H%M%S)-$MODE.json"

# Create summary
cat > "$OUTPUT_FILE" << OUTEOF
{
  "timestamp": "$(date -Iseconds)",
  "mode": "$MODE",
  "status": "collected",
  "files": {
    "pain_points": "/tmp/pain_points.json",
    "audience": "/tmp/audience_signals.json",
    "competitors": "/tmp/competitors.json",
    "watchlist": "/tmp/watchlist.json"
  },
  "next_step": "Agent will filter, rank, and generate digest"
}
OUTEOF

echo ""
echo "✅ Scan complete!"
echo "📁 Output: $OUTPUT_FILE"
echo "📋 Raw data ready for OpenClaw agent processing"
echo "   - Pain points: /tmp/pain_points.json"
echo "   - Audience: /tmp/audience_signals.json"
echo "   - Competitors: /tmp/competitors.json"
echo "   - Watchlist: /tmp/watchlist.json"
echo ""
echo "🔄 Next: Agent will:"
echo "   1. Parse JSON files"
echo "   2. Filter by engagement (10+ likes), language (EN), age (<${HOURS}h)"
echo "   3. Check engagement-tracking.md for duplicates"
echo "   4. Rank: ГОРЯЧЕЕ (pain+high engagement) → ХОРОШЕЕ (audience) → МОНИТОРИНГ"
echo "   5. Generate reply suggestions"
echo "   6. Send Telegram digest"
