#!/bin/bash

# scout-brand-building.sh
# Trends & philosophy scanner for @mttrly
# Runs queries for: vibe coding, indie hackers, learning, philosophy
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
MODE="brand-building"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
OUTPUT_FILE="$OUTPUT_DIR/brand-building-candidates-$TIMESTAMP.json"

echo "BRAND BUILDING SCOUT — Trends & Philosophy"
echo "Mode: $MODE"
echo "Timestamp: $TIMESTAMP"
echo "---"

# Brand Building queries
declare -a BRAND_BUILDING_QUERIES=(
  '"vibe coding" OR "vibing" OR "vibes" deploy OR build OR code'
  '"built with cursor" OR "built with claude" OR "built with AI"'
  '"solo founder" shipping OR learning OR deployment'
  '"indie hacker" built OR shipped OR learned'
  '"first deploy" OR "deployed for first time" scared OR proud OR nervous'
  '"heroku was simple" OR "heroku shutdown" alternative OR missing'
  '"simplicity matters" infrastructure OR deploy'
  '"moved from vercel" OR "moved from railway" OR "left heroku" why OR migrating'
  '"indie web" movement OR philosophy OR building'
  '"bootstrapped" shipped OR profitable OR sustainable'
  # v3 brand-building queries
  '("vibe coding" OR "vibe coder") (server OR deploy OR hosting OR devops OR infrastructure OR crash OR monitoring) -is:retweet'
  '("indie hacker" OR "solo founder" OR "solo dev") (server OR deploy OR devops OR infrastructure OR hosting OR downtime) -is:retweet'
  '"vibe coding" (deploy OR production OR broke OR crashed) -is:retweet'
  '(SRE OR "on-call" OR "incident response") (telegram OR bot OR mobile OR phone OR "from bed") -is:retweet'
  '("server management" OR "server monitoring") (AI OR bot OR automation OR "natural language") -is:retweet'
  'from:levelsio (server OR deploy OR hosting OR crash OR infrastructure OR monitor)'
  'from:marc_louvion (server OR deploy OR hosting OR crash OR infrastructure)'
  'from:karpathy (vibe coding OR deploy OR infrastructure)'
  'from:mipsytipsy (on-call OR incident OR monitoring OR alert)'
)

# Lighter exclusions for brand-building
EXCLUSIONS='-bankrbot -"trading bot" -defi -airdrop -"bot token"'

# Collect results
RESULTS_FILE="/tmp/brand-building-results-$$.jsonl"
> "$RESULTS_FILE"

echo "Running queries..."
QUERY_COUNT=0
SUCCESS_COUNT=0
FAIL_COUNT=0

for query in "${BRAND_BUILDING_QUERIES[@]}"; do
  QUERY_COUNT=$((QUERY_COUNT + 1))
  FULL_QUERY="$query $EXCLUSIONS"
  echo "  [$QUERY_COUNT] $query"

  # Run bird search, capture stderr for diagnostics
  if node "$BIRD_CLI" search "$FULL_QUERY" -n 25 --json 2>/tmp/bird-err-$$.log | jq '.[] | @json' -r >> "$RESULTS_FILE" 2>/dev/null; then
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
  echo "{\"mode\": \"brand-building\", \"timestamp\": \"$TIMESTAMP\", \"status\": \"all_failed\", \"candidates\": []}" > "$OUTPUT_FILE"
  rm -f "$RESULTS_FILE"
  exit 1
fi

# Parse and aggregate results
echo "Parsing and filtering..."

if [ -s "$RESULTS_FILE" ]; then
  TWEET_COUNT=$(wc -l < "$RESULTS_FILE")
  echo "Saving $TWEET_COUNT candidates to: $OUTPUT_FILE"

  jq -s -R '{
    mode: "brand-building",
    timestamp: "'"$TIMESTAMP"'",
    query_count: '"$QUERY_COUNT"',
    successful_queries: '"$SUCCESS_COUNT"',
    failed_queries: '"$FAIL_COUNT"',
    tweet_count: ([splits("\n") | select(. != "") | fromjson] | length),
    candidates: ([splits("\n") | select(. != "") | fromjson] | unique_by(.id) | sort_by(.likeCount) | reverse)
  }' "$RESULTS_FILE" > "$OUTPUT_FILE"
else
  echo "No results collected (0 tweets from $SUCCESS_COUNT successful queries)"
  echo "{\"mode\": \"brand-building\", \"timestamp\": \"$TIMESTAMP\", \"status\": \"no_results\", \"successful_queries\": $SUCCESS_COUNT, \"candidates\": []}" > "$OUTPUT_FILE"
fi

rm -f "$RESULTS_FILE"

echo ""
echo "Brand Building scan complete"
echo "Output: $OUTPUT_FILE"
