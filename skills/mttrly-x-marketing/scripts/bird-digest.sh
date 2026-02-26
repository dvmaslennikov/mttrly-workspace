#!/usr/bin/env bash
# bird-digest.sh — collect Twitter/X discovery feed via bird CLI
set -euo pipefail

MODE="${1:-morning}"
HOURS=12
[[ "$MODE" == "evening" ]] && HOURS=8

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="$SKILL_DIR/data"
TRACKING_FILE="$DATA_DIR/engagement-tracking.md"
WATCHLIST_FILE="$DATA_DIR/watchlist.json"

mkdir -p "$DATA_DIR"
[[ -f "$TRACKING_FILE" ]] || echo "# X Engagement Tracking" > "$TRACKING_FILE"

[[ -f /home/openclaw/.openclaw/.env ]] && source /home/openclaw/.openclaw/.env
[[ -f /home/openclaw/.openclaw/workspace/.env ]] && source /home/openclaw/.openclaw/workspace/.env

AUTH="${BIRD_AUTH_TOKEN:-}"
CT0="${BIRD_CT0:-}"
if [[ -z "$AUTH" || -z "$CT0" ]]; then
  echo "❌ Missing BIRD_AUTH_TOKEN or BIRD_CT0" >&2
  exit 1
fi

if command -v bird >/dev/null 2>&1; then
  BIRD_BIN=(bird)
else
  BIRD_BIN=(npx bird)
fi

SEARCH_COUNT=0
MAX_SEARCH=50
RATE_SLEEP=2
COOLDOWN_429=900

notify_auth_error() {
  echo "🔑 Cookies expired. Update needed. (auth_token + ct0)" >&2
}

run_bird() {
  local out code
  set +e
  out=$("${BIRD_BIN[@]}" --plain --auth-token "$AUTH" --ct0 "$CT0" "$@" 2>&1)
  code=$?
  set -e

  if [[ $code -ne 0 ]]; then
    if echo "$out" | grep -Eiq "(401|403|unauthorized|forbidden|invalid cookie|csrf|not authenticated)"; then
      notify_auth_error
      return 90
    fi
    if echo "$out" | grep -Eiq "(429|rate limit|too many requests)"; then
      echo "⏳ bird returned 429/rate-limit. Cooling down for 15 minutes..." >&2
      sleep "$COOLDOWN_429"
      return 91
    fi
    echo "⚠️ bird command failed: $*" >&2
    return $code
  fi

  echo "$out"
  return 0
}

normalize_json_array() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const end=s.lastIndexOf("]");if(end===-1){process.stdout.write("[]");return;}for(let i=0;i<s.length;i++){if(s[i]!=="[")continue;const cand=s.slice(i,end+1);try{const arr=JSON.parse(cand);process.stdout.write(JSON.stringify(Array.isArray(arr)?arr:[]));return;}catch{}}process.stdout.write("[]");});'
}

run_search_json() {
  local query="$1"; local n="${2:-10}"
  SEARCH_COUNT=$((SEARCH_COUNT+1))
  if (( SEARCH_COUNT > MAX_SEARCH )); then
    echo "⚠️ Max search cap reached ($MAX_SEARCH). Skipping remaining queries." >&2
    echo '[]'
    return 0
  fi
  run_bird search "$query" -n "$n" --json | normalize_json_array || echo '[]'
  sleep "$RATE_SLEEP"
}

run_user_tweets_json() {
  local handle="$1"; local n="${2:-5}"
  run_bird user-tweets "@$handle" -n "$n" --json | normalize_json_array || echo '[]'
  sleep "$RATE_SLEEP"
}

merge_json_arrays_to_category() {
  local category="$1"; local outfile="$2"; shift 2
  node - "$category" "$outfile" "$@" <<'NODE'
const fs = require('fs');
const [category, outfile, ...files] = process.argv.slice(2);
const tweets = [];
for (const f of files) {
  try {
    const raw = fs.readFileSync(f, 'utf8').trim();
    if (!raw) continue;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) tweets.push(...arr);
  } catch {}
}
fs.writeFileSync(outfile, JSON.stringify({ category, tweets }, null, 2));
NODE
}

echo "🔍 Scanning Twitter ($MODE mode, last ${HOURS}h)..."

TMP=$(mktemp -d)

# Category 1: pain points
p1="$TMP/p1.json"; p2="$TMP/p2.json"; p3="$TMP/p3.json"; p4="$TMP/p4.json"
run_search_json '"server is down" OR "site is down" OR "my app crashed"' 10 > "$p1"
run_search_json '"deployment failed" OR "deploy broke" OR "push to production failed"' 10 > "$p2"
run_search_json '"3am alert" OR "pager went off" OR "on-call nightmare"' 10 > "$p3"
run_search_json '"nginx error" OR "502 bad gateway"' 10 > "$p4"
merge_json_arrays_to_category pain_points /tmp/bird_pain.json "$p1" "$p2" "$p3" "$p4"

# Category 2: audience signals
a1="$TMP/a1.json"; a2="$TMP/a2.json"; a3="$TMP/a3.json"; a4="$TMP/a4.json"
run_search_json '"vibe coding" OR "vibe coder"' 10 > "$a1"
run_search_json '"built with cursor" deploy OR server OR hosting' 10 > "$a2"
run_search_json '"solo founder" devops OR server' 10 > "$a3"
run_search_json '"no devops" OR "can'"'"'t afford devops"' 10 > "$a4"
merge_json_arrays_to_category audience /tmp/bird_audience.json "$a1" "$a2" "$a3" "$a4"

# Category 3: competitors
c1="$TMP/c1.json"; c2="$TMP/c2.json"
run_search_json '"vercel expensive" OR "railway pricing" OR "render slow"' 10 > "$c1"
run_search_json '"moved from heroku" OR "heroku alternative"' 10 > "$c2"
merge_json_arrays_to_category competitors /tmp/bird_comp.json "$c1" "$c2"

# Category 4: watchlist (top 10)
idx=0
while IFS= read -r handle; do
  [[ -z "$handle" ]] && continue
  idx=$((idx+1))
  run_user_tweets_json "$handle" 5 > "$TMP/w$idx.json"
done < <(node - "$WATCHLIST_FILE" <<'NODE'
const fs=require('fs');
const p=process.argv[2];
try {
  const arr=JSON.parse(fs.readFileSync(p,'utf8'));
  for (const it of arr.slice(0,10)) {
    if (it && it.username) console.log(it.username);
  }
} catch {}
NODE
)

watch_files=("$TMP"/w*.json)
if [[ -e "${watch_files[0]}" ]]; then
  merge_json_arrays_to_category watchlist /tmp/bird_watch.json "${watch_files[@]}"
else
  echo '{"category":"watchlist","tweets":[]}' > /tmp/bird_watch.json
fi

rm -rf "$TMP"

echo "✅ Scan complete. Raw data in /tmp/bird_*.json"
echo "📋 Pass to OpenClaw agent for filtering and digest generation."
