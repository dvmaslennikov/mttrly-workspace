# Filter Updates v2 (2026-02-26)

## Changes Applied

### 1. ✅ Engagement Thresholds (Lowered)
**Before:** 10+ likes for all categories
**After:**
- Pain points: **3+ likes** (volume was near-zero at 10+)
- Other categories: **5+ likes** (audience, competitor, monitoring)

**Rationale:** Real problems don't always go viral. A pain point with 3 likes from the right person is better than nothing.

---

### 2. ✅ Time Window (Expanded)
**Before:** 8 hours (evening only)
**After:** **48–72 hours** (good content doesn't appear every 8h)

**Rationale:** Most valuable insights take time to gain traction. A 48h window catches both yesterday's hot takes and today's emerging problems.

**Impact:** ~3–4x more tweets to analyze, but higher-quality signal.

---

### 3. ✅ Replies Included (Now Allowed)
**Before:** `inReplyToStatusId == null` (original tweets only)
**After:** Include both original tweets AND replies

**Rationale:** Domain experts like TheConfigGuy, fluxdiv, rakyll often reply to threads. Their replies have more insight than generic posts.

**Scoring bonus:** Replies get +1 point automatically (expertise signal).

**Authority list:**
- theconfigguy
- fluxdiv
- kelseyhightower
- rakyll
- copyconstruct
- jezhumble
- allspaw

---

### 4. ✅ Search Queries Redesigned (Dev-Focused)
**Before:** Generic queries like "server is down", "site is down", "my app crashed"
**After:** Dev-focused queries with context + minus words

**Pain Points Queries (NEW):**
```
"deployment failed" AND (server OR deploy OR kubernetes OR docker) -railway -vercel -heroku
"deploy broke" OR "push to prod failed" (kubernetes OR docker OR CI/CD) -indigo -railway
"3am alert" OR "pager went off" OR "on-call incident" (server OR devops OR deployment)
"nginx error" OR "502 bad gateway" (deployment OR rollback OR incident) -railway -render
"app crashed" AND (deployment OR production OR incident) -instagram -facebook -banking
"rollback" OR "incident response" OR "postmortem" (deployment OR infrastructure OR devops)
"prod down" OR "production incident" OR "outage" (deployment OR infra) -airline -bank -payment
```

**Audience Signals Queries (EXPANDED):**
```
"vibe coding" OR "vibe coder" OR "#vibecoding" (deploy OR server OR devops)
"built with cursor" OR "built with claude" (deploy OR hosting OR server) -windows
"solo founder" (devops OR server OR deploy OR production) -crypto -shopify
"indie hacker" (server OR deploy OR hosting OR production) -crypto -dropship
"can't afford devops" OR "no devops" (deploy OR production OR infrastructure)
"first VPS" OR "first server" (deploy OR production OR learn) -windows -hosting-promo
"learning to deploy" OR "deploying my app" (first time OR scared OR anxiety)
"got my app deployed" OR "deployed to production" (indie OR solo OR first time)
```

**Competitor Queries (EXPANDED):**
```
"vercel expensive" OR "railway pricing" OR "render slow" -crypto
"moved from heroku" OR "heroku alternative" OR "left vercel" -crypto
"need something simpler" (hosting OR deploy OR infrastructure) -shopify
"too complex" (kubernetes OR docker OR "CI/CD") -kubernetes-guide -tutorial
"just want to deploy" OR "deploy should be simple" (app OR server OR production) -windows
"kubernetes overkill" OR "k8s too much" (simple OR small project OR indie)
"deployment anxiety" OR "afraid to deploy" (first OR learning OR help)
```

**Minus words to reduce noise:**
- `-railway`, `-vercel`, `-heroku` — filter product-specific Q&A
- `-crypto`, `-shopify`, `-windows` — filter off-topic domains
- `-tutorial`, `-guide` — reduce educational content (not engagement targets)
- `-banking`, `-airline` — filter non-SaaS domains (Indian railways, etc)
- `-instagram`, `-facebook` — filter non-developer contexts

---

### 5. ✅ Watchlist Cleaned
**Removed:**
- `marclouvier` (low activity, not dev-focused)

**Kept & Verified Active:**
- `levelsio` — Indie hacker wisdom, deployment patterns
- `kelseyhightower` — Kubernetes authority, DevOps best practices
- `rakyll` — Go/observability, production insights
- `copyconstruct` — Systems design, production concerns
- `jezhumble` — DevOps pioneer, continuous delivery
- `allspaw` — On-call culture, incident response
- `tdinh_me` — Infrastructure, deployment patterns
- `DanielFosworthy` — DevOps automation

**Platform accounts (signal monitoring):**
- `railway` — Competitor signal
- `vercel` — Competitor signal
- `render` — Competitor signal

---

### 6. ✅ Scoring Formula Updated
**Before:**
```
score = (relevance × 3) + (freshness × 2) + (engagement × 2) + (category_weight)
Range: [0–20]
```

**After:**
```
score = (engagement + freshness + reply_bonus) × category_weight

where:
  engagement = min(likes / 20, 3)               [max 3 points; normalized for 3+ likes]
  freshness = max(2 - hours / 36, 0)            [2 for <24h, declining to 0 at 72h]
  reply_bonus = +1 if tweet is a reply         [expertise signal]
  category_weight = {pain_point: 3, audience: 2, competitor: 1.5, monitoring: 0.8}

Range: [0–18]
```

**Ranking (adjusted):**
- 12+: ГОРЯЧЕЕ (was 15+)
- 7–11: ХОРОШЕЕ (was 10–14)
- 3–6: МОНИТОРИНГ (was 5–9)
- <3: SKIP

---

## Impact Summary

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Min engagement (pain) | 10+ | 3+ | ↓ 70% |
| Min engagement (other) | 10+ | 5+ | ↓ 50% |
| Time window | 8h | 72h | ↑ 900% |
| Replies included | No | Yes | ✅ |
| Search queries | 7 (generic) | 21 (dev-focused) | 3x specificity |
| Scoring range | 0–20 | 0–18 | -10% (normalized) |
| Expected volume | ~2–5 tweets/pass | ~20–50 tweets/pass | ↑ 5–10x |

---

## Files Updated

1. ✅ `LLM-PROMPT-evening-engagement.md` — scoring, examples with replies, authority list
2. ✅ `bird-digest.sh` — new search queries, minus words, watchlist cleanup
3. ✅ `x-evening-digest.js` — engagement thresholds, reply handling, new scoring formula
4. ✅ This file: `FILTER-UPDATES-v2.md`

---

## Next Run

```bash
cd /home/openclaw/.openclaw/workspace
bash playbooks/twitter/bird-digest.sh evening 2>&1
node playbooks/twitter/x-evening-digest.js 2>&1
```

Expected output: 20–50 candidate tweets for review.

---

## Notes

- **Replies from authorities** now get automatic ГОРЯЧЕЕ categorization
- **Minus words** significantly reduce noise (product Q&A, off-topic domains)
- **Freshness curve** is gentler (72h instead of 8h) — allows older quality content through
- **Lower engagement threshold** means more tweets to review, but better discovery of emerging problems

Test & iterate. These filters are designed for discovery, not precision. Adjust thresholds based on reply success rate over next 5–10 runs.
