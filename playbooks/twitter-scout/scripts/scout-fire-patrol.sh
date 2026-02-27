#!/bin/bash

# scout-fire-patrol.sh
# Real-time pain-point scanner for @mttrly
# Runs queries for: server down, aws bills, crashes, incidents
# Output: JSON candidates + markdown digest

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REFS_DIR="$SCRIPT_DIR/references"
ASSETS_DIR="$SCRIPT_DIR/assets"
OUTPUT_DIR="${OUTPUT_DIR:-.}"

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

# Collect all results
RESULTS_FILE="/tmp/fire-patrol-results-$$.jsonl"
> "$RESULTS_FILE"

echo "📍 Running queries..."
QUERY_COUNT=0
for query in "${FIRE_PATROL_QUERIES[@]}"; do
  QUERY_COUNT=$((QUERY_COUNT + 1))
  FULL_QUERY="$query $EXCLUSIONS"
  echo "  [$QUERY_COUNT] $query"
  
  # Run bird search, collect results (JSONL)
  npx bird search "$FULL_QUERY" -n 20 2>/dev/null | jq -s . >> "$RESULTS_FILE" || true
  
  # Rate limit respect
  sleep 2
done

echo "✅ Collected results from $QUERY_COUNT queries"
echo ""

# Parse results
echo "📊 Parsing and filtering..."

# Call LLM-based filtering/generation (when integrated)
# For now, just aggregate results

echo "💾 Saving candidates to: $OUTPUT_FILE"
echo "{\"mode\": \"fire-patrol\", \"timestamp\": \"$TIMESTAMP\", \"status\": \"ready_for_llm_filtering\"}" > "$OUTPUT_FILE"

echo ""
echo "✅ Fire Patrol scan complete"
echo "Next: Feed $OUTPUT_FILE to LLM for filtering + reply generation"
echo ""
echo "Run: node $SCRIPT_DIR/../playbooks/twitter/x-evening-digest.js"
