#!/bin/bash

# scout-fire-patrol.sh
# Real-time pain-point scanner for @mttrly
# Runs queries for: server down, aws bills, crashes, incidents
# Output: JSON candidates file

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REFS_DIR="$SCRIPT_DIR/references"
ASSETS_DIR="$SCRIPT_DIR/assets"
OUTPUT_DIR="${OUTPUT_DIR:-$WORKSPACE_DIR}"
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
MODE="fire-patrol"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
OUTPUT_FILE="$OUTPUT_DIR/fire-patrol-candidates-$TIMESTAMP.json"

echo "FIRE PATROL SCOUT — Pain Points"
echo "Mode: $MODE"
echo "Timestamp: $TIMESTAMP"
echo "---"

# Fire Patrol queries
declare -a FIRE_PATROL_QUERIES=(
  '"server down" OR "server is down" OR "crashed" -test -demo'
  '"app crashed" OR "app keeps crashing" production -debug'
  '"502 error" OR "503 error" OR "service unavailable" -test'
  '"database crashed" OR "db is down" production'
  '"nginx error" -tutorial -howto'
  '"aws bill" shocked OR expensive OR "hundreds" -tutorial'
  '"cloud bill" expensive OR "out of budget" OR surprised'
  '"deployment failed" production -scheduled -tutorial'
  '"deploy broke" OR "push broke prod" -howto'
  '"3am alert" OR "woke me up" production issue'
)

# Exclusions
EXCLUSIONS='-bankrbot -"deploy the token" -"on Base" -web3 -"on-chain" -airdrop -$SOL -$ETH -"bot token" -"trading bot" -crypto -defi'

# Collect results
RESULTS_FILE="/tmp/fire-patrol-results-$$.jsonl"
> "$RESULTS_FILE"

echo "Running queries..."
QUERY_COUNT=0
SUCCESS_COUNT=0
FAIL_COUNT=0

for query in "${FIRE_PATROL_QUERIES[@]}"; do
  QUERY_COUNT=$((QUERY_COUNT + 1))
  FULL_QUERY="$query $EXCLUSIONS"
  echo "  [$QUERY_COUNT] $query"

  # Run bird search, capture stderr for diagnostics
  if node "$BIRD_CLI" search "$FULL_QUERY" -n 20 --json 2>/tmp/bird-err-$$.log | jq '.[] | @json' -r >> "$RESULTS_FILE" 2>/dev/null; then
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
  echo "{\"mode\": \"fire-patrol\", \"timestamp\": \"$TIMESTAMP\", \"status\": \"all_failed\", \"candidates\": []}" > "$OUTPUT_FILE"
  rm -f "$RESULTS_FILE"
  exit 1
fi

# Parse and aggregate results
echo "Parsing and filtering..."

if [ -s "$RESULTS_FILE" ]; then
  TWEET_COUNT=$(wc -l < "$RESULTS_FILE")
  echo "Saving $TWEET_COUNT candidates to: $OUTPUT_FILE"

  jq -s -R '{
    mode: "fire-patrol",
    timestamp: "'"$TIMESTAMP"'",
    query_count: '"$QUERY_COUNT"',
    successful_queries: '"$SUCCESS_COUNT"',
    failed_queries: '"$FAIL_COUNT"',
    tweet_count: ([splits("\n") | select(. != "") | fromjson] | length),
    candidates: ([splits("\n") | select(. != "") | fromjson] | unique_by(.id) | sort_by(.likeCount) | reverse)
  }' "$RESULTS_FILE" > "$OUTPUT_FILE"
else
  echo "No results collected (0 tweets from $SUCCESS_COUNT successful queries)"
  echo "{\"mode\": \"fire-patrol\", \"timestamp\": \"$TIMESTAMP\", \"status\": \"no_results\", \"successful_queries\": $SUCCESS_COUNT, \"candidates\": []}" > "$OUTPUT_FILE"
fi

rm -f "$RESULTS_FILE"

echo ""
echo "Fire Patrol scan complete"
echo "Output: $OUTPUT_FILE"
