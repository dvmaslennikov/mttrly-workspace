#!/bin/bash

# scout-brand-building.sh
# Trends & philosophy scanner for @mttrly
# Runs queries for: vibe coding, indie hackers, learning, philosophy
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
MODE="brand-building"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
OUTPUT_FILE="$OUTPUT_DIR/brand-building-candidates-$TIMESTAMP.json"

echo "🎯 BRAND BUILDING SCOUT — Trends & Philosophy"
echo "Mode: $MODE"
echo "Timestamp: $TIMESTAMP"
echo "---"

# Queries from references/QUERIES.md (Brand Building section)
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
)

# Lighter exclusions for brand-building (allow some crypto context if philosophy)
EXCLUSIONS='-bankrbot -"trading bot" -defi -airdrop -"bot token"'

# Collect all results
RESULTS_FILE="/tmp/brand-building-results-$$.jsonl"
> "$RESULTS_FILE"

echo "📍 Running queries..."
QUERY_COUNT=0
for query in "${BRAND_BUILDING_QUERIES[@]}"; do
  QUERY_COUNT=$((QUERY_COUNT + 1))
  FULL_QUERY="$query $EXCLUSIONS"
  echo "  [$QUERY_COUNT] $query"
  
  # Run bird search, collect results (JSONL)
  npx bird search "$FULL_QUERY" -n 25 2>/dev/null | jq -s . >> "$RESULTS_FILE" || true
  
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
echo "{\"mode\": \"brand-building\", \"timestamp\": \"$TIMESTAMP\", \"status\": \"ready_for_llm_filtering\"}" > "$OUTPUT_FILE"

echo ""
echo "✅ Brand Building scan complete"
echo "Next: Feed $OUTPUT_FILE to LLM for filtering + reply generation"
echo ""
echo "Run: node $SCRIPT_DIR/../playbooks/twitter/x-evening-digest.js --mode brand-building"
