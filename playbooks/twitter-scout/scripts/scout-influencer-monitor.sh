#!/bin/bash

# scout-influencer-monitor.sh
# Influencer monitoring scanner for @mttrly
# Monitors tracked influencer accounts for pain points and relevant discussions
# Output: JSON candidates file

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REFS_DIR="$SCRIPT_DIR/references"
ASSETS_DIR="$SCRIPT_DIR/assets"
OUTPUT_DIR="${OUTPUT_DIR:-$WORKSPACE_DIR/daily-packs}"
BIRD_CLI="$WORKSPACE_DIR/node_modules/@steipete/bird/dist/cli.js"

# Load environment (AUTH_TOKEN + CT0 for bird CLI)
if [ -f ~/.openclaw/.env.bird ]; then
  source ~/.openclaw/.env.bird
else
  echo "ERROR: ~/.openclaw/.env.bird not found" >&2
  exit 1
fi

# Verify bird CLI exists
if [ ! -f "$BIRD_CLI" ]; then
  echo "ERROR: bird CLI not found at $BIRD_CLI" >&2
  exit 1
fi

# Verify auth is available
if [ -z "$AUTH_TOKEN" ] && [ -z "$TWITTER_AUTH_TOKEN" ]; then
  echo "ERROR: No auth credentials. Set AUTH_TOKEN in ~/.openclaw/.env.bird" >&2
  exit 1
fi

# Mode
MODE="influencer-monitor"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
OUTPUT_FILE="$OUTPUT_DIR/influencer-monitor-candidates-$TIMESTAMP.json"

echo "INFLUENCER MONITOR SCOUT — Tracked Accounts"
echo "Mode: $MODE"
echo "Timestamp: $TIMESTAMP"
echo "---"

# Influencer Monitor queries — 3 categories
declare -a INFLUENCER_MONITOR_QUERIES=(
  # === Tier 1-2 personas: pain points & relevant discussions ===
  'from:levelsio (server OR deploy OR crash OR infrastructure OR monitor OR hosting OR downtime)'
  'from:marc_louvion (server OR deploy OR crash OR infrastructure OR monitor OR hosting)'
  'from:karpathy (deploy OR infrastructure OR server OR vibe coding OR production)'
  'from:dvassallo (server OR deploy OR crash OR infrastructure OR shipping OR downtime)'
  'from:arvidkahl (server OR deploy OR infrastructure OR shipping OR build OR downtime)'
  'from:thepatwalls (server OR deploy OR infrastructure OR shipping OR build OR crash)'
  'from:yongfook (server OR deploy OR infrastructure OR shipping OR monitoring OR crash)'
  'from:tdinh_me (server OR deploy OR infrastructure OR shipping OR monitoring OR crash)'
  'from:b0rk (server OR deploy OR incident OR monitoring OR debugging OR production)'
  'from:simonw (server OR deploy OR infrastructure OR hosting OR production)'
  'from:mipsytipsy (on-call OR incident OR monitoring OR alert OR deploy OR production)'
  'from:kelseyhightower (deploy OR infrastructure OR kubernetes OR incident OR production)'
  'from:swyx (deploy OR infrastructure OR server OR shipping OR production)'
  'from:gergelyorosz (on-call OR incident OR deploy OR infrastructure OR production)'
  'from:jezhumble (deploy OR infrastructure OR incident OR production OR monitoring)'
  'from:allspaw (incident OR on-call OR deploy OR infrastructure OR production OR monitoring)'
  'from:copyconstruct (monitoring OR observability OR deploy OR infrastructure OR incident)'
  'from:lizthegrey (observability OR monitoring OR deploy OR incident OR production)'
  'from:realgenekim (deploy OR incident OR infrastructure OR devops OR production)'
  'from:rauchg (deploy OR infrastructure OR server OR production OR hosting)'

  # === Tier 3: niche relevant accounts ===
  'from:cjzafir (server OR deploy OR infrastructure OR monitoring)'
  'from:oneuptimehq (monitoring OR uptime OR incident OR downtime)'
  'from:fromcodetocloud (deploy OR infrastructure OR cloud OR server)'
  'from:rohanpaul_ai (deploy OR server OR infrastructure OR AI OR production)'

  # === DevTools complaint monitoring (users complaining TO these services) ===
  '((to:vercel OR @vercel) (down OR broken OR expensive OR error OR outage)) -is:retweet'
  '((to:railway_app OR @railway_app) (down OR broken OR expensive OR error OR outage)) -is:retweet'
  '((to:flydotio OR @flydotio OR to:supabase OR @supabase) (down OR broken OR expensive OR error OR outage)) -is:retweet'
)

# Exclusions — same as fire-patrol
EXCLUSIONS='-bankrbot -"deploy the token" -"on Base" -web3 -"on-chain" -airdrop -$SOL -$ETH -"bot token" -"trading bot" -crypto -defi -rail -railway -station -bus -football -match -fanzine -earthquake -missile -war -breaking -qatar -doha -feeding -newborn -baby -breastfeeding -election -politics'

# Collect results
RESULTS_FILE="/tmp/influencer-monitor-results-$$.jsonl"
> "$RESULTS_FILE"

echo "Running queries..."
QUERY_COUNT=0
SUCCESS_COUNT=0
FAIL_COUNT=0

for query in "${INFLUENCER_MONITOR_QUERIES[@]}"; do
  QUERY_COUNT=$((QUERY_COUNT + 1))
  FULL_QUERY="$query $EXCLUSIONS"
  echo "  [$QUERY_COUNT] $query"

  # Run bird search, capture stderr for diagnostics
  if node "$BIRD_CLI" search "$FULL_QUERY" -n 15 --json 2>/tmp/bird-err-$$.log | jq '.[] | @json' -r >> "$RESULTS_FILE" 2>/dev/null; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    BIRD_ERR=$(cat /tmp/bird-err-$$.log 2>/dev/null)
    echo "    WARN: query failed${BIRD_ERR:+ — $BIRD_ERR}" >&2
  fi

  sleep 2
done

rm -f /tmp/bird-err-$$.log

echo "Queries: $QUERY_COUNT total, $SUCCESS_COUNT ok, $FAIL_COUNT failed"
echo ""

# Exit with error if ALL queries failed
if [ "$SUCCESS_COUNT" -eq 0 ]; then
  echo "ERROR: All $QUERY_COUNT queries failed. Check auth credentials." >&2
  echo "{\"mode\": \"influencer-monitor\", \"timestamp\": \"$TIMESTAMP\", \"status\": \"all_failed\", \"candidates\": []}" > "$OUTPUT_FILE"
  rm -f "$RESULTS_FILE"
  exit 1
fi

# Parse and aggregate results
echo "Parsing and filtering..."

if [ -s "$RESULTS_FILE" ]; then
  TWEET_COUNT=$(wc -l < "$RESULTS_FILE")
  echo "Saving $TWEET_COUNT candidates to: $OUTPUT_FILE"

  jq -s -R '{
    mode: "influencer-monitor",
    timestamp: "'"$TIMESTAMP"'",
    query_count: '"$QUERY_COUNT"',
    successful_queries: '"$SUCCESS_COUNT"',
    failed_queries: '"$FAIL_COUNT"',
    tweet_count: ([splits("\n") | select(. != "") | fromjson] | length),
    candidates: ([splits("\n") | select(. != "") | fromjson] | unique_by(.id) | sort_by(.likeCount) | reverse)
  }' "$RESULTS_FILE" > "$OUTPUT_FILE"
else
  echo "No results collected (0 tweets from $SUCCESS_COUNT successful queries)"
  echo "{\"mode\": \"influencer-monitor\", \"timestamp\": \"$TIMESTAMP\", \"status\": \"no_results\", \"successful_queries\": $SUCCESS_COUNT, \"candidates\": []}" > "$OUTPUT_FILE"
fi

rm -f "$RESULTS_FILE"

echo ""
echo "Influencer Monitor scan complete"
echo "Output: $OUTPUT_FILE"
