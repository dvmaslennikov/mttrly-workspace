# Error Handling & Edge Cases

Detailed handling for all failure modes and edge cases.

---

## Rate Limit (HTTP 429)

**When:** bird CLI hits X API rate limit

**How to Handle:**
```bash
if [ $exit_code -eq 429 ]; then
  echo "Rate limit hit. Waiting 15 minutes..."
  sleep 900
  retry_query
fi
```

**Agent instruction:**
- If script reports 429: Read this file
- Skip current query, move to next
- Batch remaining queries
- Notify user: "Rate limited. Resuming in 15 minutes."
- DO NOT retry immediately (exponential backoff: 5s → 30s → 15min)

---

## Auth Failure (HTTP 401/403)

**When:** Auth token in `~/.env.bird` is expired or invalid

**How to Handle:**
```bash
if [ $exit_code -eq 401 ] || [ $exit_code -eq 403 ]; then
  echo "Auth failed. Check ~/.env.bird"
  exit 1
fi
```

**Agent instruction:**
- If script fails with 401: Stop execution
- Notify user: "Auth token expired. Update ~/.env.bird and retry."
- Do NOT continue (remaining queries will also fail)
- User must refresh auth token via: `bird auth login`

---

## Zero Results

**When:** A query returns 0 tweets

**Examples:**
- `"flying saucer deployment"` (too specific)
- `"deployment" since:2100-01-01` (future date filter)
- `"xyz123abc"` (random nonsense)

**How to Handle:**
```bash
if [ $(jq length results.json) -eq 0 ]; then
  echo "Query returned 0 results. Continuing to next..."
  continue
fi
```

**Agent instruction:**
- If a query has no results: Skip it, continue to next query
- DO NOT stop scanning (other queries may have results)
- Log it: "Query 'X' returned 0 results"
- Final count should still report total queries run

---

## Missing Data Fields

**When:** Tweet object is missing expected fields

**Common missing fields:**
- `tweet.author.followers` — Account is private or auth is limited
- `tweet.replyCount` — Some endpoints don't return this
- `tweet.createdAt` — Malformed response from bird
- `tweet.text` — Deleted tweet (but ID still appears)

**How to Handle:**
```json
"author": {
  "username": "example",
  "followers": null  ← handle gracefully
}

// Scoring:
followers_estimate = followers || 1000  // default if missing
engagement_score = likes / 20  // skip if likes is null
```

**Agent instruction:**
- Missing `followers`: Use default estimate (1000)
- Missing `likes` or `createdAt`: Skip tweet (can't score)
- Missing `text`: Skip tweet (can't generate reply)
- Log: "Skipped tweet (missing: followers, likes)"

---

## Scoring Ties

**When:** Two tweets have identical scores (e.g., both 14.32)

**How to Break Ties:**
```
Primary: Total score (14.32)
Tie-breaker 1: Freshness (newer first)
Tie-breaker 2: Engagement (more likes first)
Tie-breaker 3: Follower count (larger account first)
Tie-breaker 4: Tweet ID (most recent ID first)
```

**Agent instruction:**
- If scores are identical: Sort by freshness (age_hours ascending)
- If still tied: Sort by likes (descending)
- If still tied: Sort by followers (descending)
- If still tied: Use tweet ID (newer first)
- Include tiebreaker in reasoning: "Same score; ranked by freshness"

---

## Unicode/Emoji in Author Names

**When:** Author username or name contains non-ASCII characters

**Examples:**
- `@Разработчик_Алекс` (Cyrillic)
- `@développeur_fr` (French accents)
- `@💻_dev` (Emoji)

**How to Handle:**
```
is_english = text.match(/[a-z0-9\s.,!?'""-]/gi).length / text.length > 0.7

// Author name:
author_name = author.name || author.username
// If name is non-ASCII, it's OK. Evaluate tweet, not author name.
```

**Agent instruction:**
- Author name in non-ASCII is OK (don't filter)
- Evaluate tweet CONTENT for English language, not author name
- Include in candidates: "Author name is Cyrillic; tweet is English"
- Only skip if tweet text is non-English

---

## Timestamp Edge Cases (72-Hour Window)

**When:** Tweet is exactly at the boundary of 72-hour window

**Exact rule:**
```
max_age_hours = 72
tweet_age = now() - tweet.createdAt
include = tweet_age <= max_age_hours
```

**Boundary test:**
- Tweet created: 2026-02-26 18:00:00 UTC
- Scan time: 2026-02-29 18:00:00 UTC
- Age: exactly 72 hours
- **Include:** YES (<=, not <)

- Tweet created: 2026-02-26 18:00:01 UTC
- Scan time: 2026-02-29 18:00:00 UTC
- Age: 71h 59m 59s
- **Include:** YES

- Tweet created: 2026-02-26 17:59:59 UTC
- Scan time: 2026-02-29 18:00:00 UTC
- Age: 72h 00m 01s
- **Include:** NO (exceeds 72h)

**Agent instruction:**
- Use `<=` (include if exactly 72h old)
- Timestamps in ISO 8601 format (2026-02-26T18:00:00Z)
- Account for timezone (all times in UTC)
- Log: "Age: 71h 45m (included in 72h window)"

---

## Filtering Conflicts (What if Multiple Rules Apply?)

**Scenario:** Tweet is in English BUT from a bot account. What to do?

**Rule of thumb:** Apply filters in order, SKIP if ANY filter fails

```
1. Check is_english → NO → SKIP (don't continue)
2. Check is_bot → YES → SKIP (don't continue)
3. Check engagement → OK → continue
4. Check age → OK → continue
```

**Agent instruction:**
- If tweet fails ANY filter: Mark as skipped + reason
- Don't apply further filters
- Reason: "Bot account" OR "Not English" (first failure)

---

## Script Failures & Recovery

**Bird CLI completely dies:**
```bash
# Script detects: bird search returns non-zero exit code
# Agent sees: "Error: bird CLI failed. Exit code 127 (command not found)"

What to do:
1. Check: Is 'bird' installed? (`which bird`)
2. Check: Is npm in $PATH? (`echo $PATH | grep npm`)
3. Check: Are permissions correct? (`ls -l ~/.env.bird`)
4. Reinstall: `npm install -g @steipete/bird`
5. Retry: `./scout-fire-patrol.sh`
```

**Agent instruction:**
- If script fails immediately: Check installation
- If script hangs: Kill and check rate limits (429)
- If partial results: Continue with what you have, log the rest were dropped
- Always report to user: "Collected 45 of 50 expected results (9 queries hit rate limit)"

---

## Empty Candidate Set (Worst Case)

**When:** All 50 queries returned 0 results (no engagement today)

**Agent instruction:**
- Still run Step 3 (filtering/scoring)
- Output empty list: `{"candidates": []}`
- Message: "No candidates found in this scan. Check again later."
- DO NOT assume skill is broken

---

**Last Updated:** 2026-02-27  
**Purpose:** Handle production failures gracefully, agent knows what to do
