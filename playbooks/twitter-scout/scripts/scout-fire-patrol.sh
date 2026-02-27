#!/bin/bash

# scout-fire-patrol.sh
# Real-time pain-point scanner for @mttrly
# Runs queries for: server down, aws bills, crashes, incidents
# Output: JSON candidates + markdown digest

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REFS_DIR="$SCRIPT_DIR/references"
ASSETS_DIR="$SCRIPT_DIR/assets"
OUTPUT_DIR="${OUTPUT_DIR:-.}"
BIRD_CLI="$WORKSPACE_DIR/node_modules/@steipete/bird/dist/cli.js"

# Load environment
if [ -f ~/.openclaw/.env.bird ]; then
  source ~/.openclaw/.env.bird
else
  echo "❌ Error: ~/.openclaw/.env.bird not found"
  exit 1
fi

# Mode
MODE="fire-patrol"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
OUTPUT_FILE="$OUTPUT_DIR/fire-patrol-candidates-$TIMESTAMP.json"

echo "🔥 FIRE PATROL SCOUT — Pain Points"
echo "Mode: $MODE"
echo "Timestamp: $TIMESTAMP"
echo "---"

# Queries from references/QUERIES.md (Fire Patrol section)
# These are predefined in the skill, so we just execute them

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

# Add exclusions to all queries
EXCLUSIONS='-bankrbot -"deploy the token" -"on Base" -web3 -"on-chain" -airdrop -$SOL -$ETH -"bot token" -"trading bot" -crypto -defi'

# Collect all results into temp file
RESULTS_FILE="/tmp/fire-patrol-results-$$.jsonl"
> "$RESULTS_FILE"

echo "📍 Running queries..."
QUERY_COUNT=0
for query in "${FIRE_PATROL_QUERIES[@]}"; do
  QUERY_COUNT=$((QUERY_COUNT + 1))
  FULL_QUERY="$query $EXCLUSIONS"
  echo "  [$QUERY_COUNT] $query"
  
  # Run bird search and append each result object to JSONL (one per line)
  node "$BIRD_CLI" search "$FULL_QUERY" -n 20 --json 2>/dev/null | jq '.[] | @json' -r >> "$RESULTS_FILE" || true
  
  # Rate limit respect
  sleep 2
done

echo "✅ Collected results from $QUERY_COUNT queries"
echo ""

# Parse results
echo "📊 Parsing and filtering..."

# Aggregate all results from JSONL file into single JSON array
if [ -s "$RESULTS_FILE" ]; then
  # Parse JSONL (one JSON string per line) and build aggregated output
  TWEET_COUNT=$(wc -l < "$RESULTS_FILE")
  
  # Build output with aggregated results
  echo "💾 Saving $TWEET_COUNT candidates to: $OUTPUT_FILE"
  jq -s -R '{
    mode: "fire-patrol",
    timestamp: "'"$TIMESTAMP"'",
    query_count: '"$QUERY_COUNT"',
    tweet_count: ([splits("\n") | select(. != "") | fromjson] | length),
    candidates: ([splits("\n") | select(. != "") | fromjson] | unique_by(.id) | sort_by(.likeCount) | reverse)
  }' "$RESULTS_FILE" > "$OUTPUT_FILE"
else
  echo "⚠️  No results collected"
  echo "{\"mode\": \"fire-patrol\", \"timestamp\": \"$TIMESTAMP\", \"status\": \"no_results\", \"candidates\": []}" > "$OUTPUT_FILE"
fi

echo ""
echo "✅ Fire Patrol scan complete"
echo "Next: Feed $OUTPUT_FILE to LLM for filtering + reply generation"
echo ""
echo "Run: node $SCRIPT_DIR/../playbooks/twitter/x-evening-digest.js"
