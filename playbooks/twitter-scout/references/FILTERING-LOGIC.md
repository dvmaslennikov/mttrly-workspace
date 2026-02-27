# FILTERING-LOGIC.md — 6-Step Pipeline + Decision Tree

## Overview

Filtering removes noise and produces a ranked candidate list. Each step has a **PASS/SKIP** decision.

---

## 6-Step Pipeline

### Step 1: Original vs Reply
**Question:** Is this a reply to another tweet or an original tweet?

| Condition | Action |
|-----------|--------|
| **Original tweet** | PASS → Step 2 |
| **Reply to tweet** | **CONDITIONAL**: Check if reply is from high-authority user (rakyll, copyconstruct, etc.) OR adds novel insight; if yes → PASS; else → SKIP |
| **Retweet** | SKIP |

**Rationale:** Original tweets guarantee unique perspective. Replies from domain experts add value; generic replies waste signal.

---

### Step 2: Language Detection
**Question:** Is the primary language English?

| Condition | Action |
|-----------|--------|
| **English** (tweet text ≥80% ASCII, common English words detected) | PASS → Step 3 |
| **Mixed** (has Russian/Chinese/etc. but English ≥50%) | **MANUAL REVIEW** (ask: is core message in English?) |
| **Non-English** | SKIP |

**Detection method:** Simple heuristic—count English stopwords (the, is, are, have, been, for, etc.) vs total words.

---

### Step 3: Bot & Spam Filtering
**Question:** Does the tweet look like bot/spam content?

| Pattern | Action |
|-----------|--------|
| Author handle contains: `bot`, `automated`, `_bot_` | SKIP |
| Tweet contains: "deploy the token", "on-chain", "$SOL", "$ETH", "airdrop", "buy now" | SKIP |
| Tweet contains: multiple hashtags + promotional link in single sentence | SKIP |
| Tweet contains: "RT @X has retweeted" or similar meta-spam | SKIP |
| **Otherwise** | PASS → Step 4 |

**Exclusion list:** See `EXCLUSION-PATTERNS.md` (loaded separately).

---

### Step 4: Engagement Filter (Tiered by Mode)

#### Fire Patrol Mode
**Question:** Does this tweet have enough engagement to signal real pain?

| Metric | Threshold | Action |
|--------|-----------|--------|
| **Likes** | ≥3 | — |
| **Views** | ≥50 (estimated from likes × 7) | — |
| **Replies** | ≥1 | — |
| **Age** | ≤30 minutes from now | — |
| **All met?** | YES | PASS → Step 5 |
| | NO | SKIP (log reason) |

**Rationale:** Pain points trend fast. 3 likes from 50 views = real signal (6% engagement). Default est. views = likes × 7 (conservative).

#### Brand Building Mode
**Question:** Does this tweet have enough reach + engagement for thought leadership?

| Metric | Threshold | Action |
|--------|-----------|--------|
| **Likes** | ≥5 | — |
| **Views** | ≥200 (estimated) | — |
| **Author followers** | ≥1K (estimated from profile) | — |
| **Age** | ≤72 hours | — |
| **All met?** | YES | PASS → Step 5 |
| | NO | SKIP (log reason) |

**Rationale:** Brand-building needs reach. 5+ likes on 200 views = viral signal (2.5% engagement). Author must have audience.

---

### Step 5: Deduplication & History
**Question:** Have we replied to this tweet or author before?

| Condition | Action |
|-----------|--------|
| **Replied** in last 90 days | SKIP (log dedup) |
| **Same author**, replied in last 30 days | SKIP (avoid spam) |
| **Author on blocklist** (spammer, repeatedly declined) | SKIP |
| **Tweet ID** in engagement-tracking.md | SKIP |
| **Otherwise** | PASS → Step 6 |

**Data source:** Load `data/x-engagement-tracking.md` (timestamp + author + decision).

---

### Step 6: Category Assignment & Scoring
**Question:** What category is this tweet? Does it score high enough for the mode?

| Category | Fire Patrol | Brand Building |
|----------|-------------|-----------------|
| **pain_point** | ✅ Include (score ≥3) | Skip (tactical, not strategic) |
| **audience** | Maybe (score ≥2, only founder types) | ✅ Include (score ≥3) |
| **monitoring** | ✅ Include (trending, 5+ mentions) | ✅ Include (score ≥2) |

**Category logic:** See `SCORING-FORMULA.md` for full scoring equation.

**Output:** PASS or SKIP with score + category + reason.

---

## Decision Tree (ASCII)

```
Tweet collected from bird CLI
  │
  ├─ [Step 1] Is original or high-authority reply?
  │   NO  → SKIP (retweet/generic reply)
  │   YES ↓
  │
  ├─ [Step 2] Language = English?
  │   NO  → SKIP (non-English)
  │   YES ↓
  │
  ├─ [Step 3] Not bot/spam?
  │   NO  → SKIP (spam filter)
  │   YES ↓
  │
  ├─ [Step 4] Engagement threshold met?
  │   (3+ likes, 50+ views for Fire Patrol)
  │   (5+ likes, 200+ views for Brand Building)
  │   NO  → SKIP (too quiet)
  │   YES ↓
  │
  ├─ [Step 5] Not duplicate/previously replied?
  │   NO  → SKIP (dedup)
  │   YES ↓
  │
  └─ [Step 6] Score + category
      Score ≥ mode_threshold?
      NO  → SKIP (low relevance)
      YES → PASS ✅
            (output: tweet_id, author, score, category, hook)
```

---

## Handling Missing Data

When a field is unavailable:

| Field | Missing Value | Default | Rationale |
|-------|---------------|---------|-----------|
| `views` | Not provided by bird | `likes × 7` | Conservative est. (6–8% engagement typical) |
| `author.followers` | Private account | `5000` | Mid-tier default (biased low for safety) |
| `created_at` | Malformed timestamp | **SKIP** | Can't verify age window |
| `engagement.replies` | Not counted | `0` | Assume no replies if not provided |
| `in_reply_to_status_id` | Null | Original (Step 1 PASS) | Treat as original tweet |

---

## Conflict Resolution

**What if a tweet passes Step 4 but fails Step 5 (dedup)?**
- Check dedup date: if **>90 days**, override dedup (allow replay).
- Log reason: "Dedup override: 120 days since last engagement".

**What if views are unavailable but likes are 15+?**
- Assume views = 15 × 7 = 105 (est.)
- If threshold is 50 (Fire Patrol), PASS; if 200 (Brand Building), SKIP.
- Log: "Views estimated from likes (tweet has 15 likes)".

**What if author followers are unknown but tweet has 200 views?**
- Check likes: if ≥5, assume author has audience; PASS.
- Check likes: if <5, assume micro-account; SKIP (Brand Building only).

---

## Pseudocode

```python
def filter_tweet(tweet, mode="fire_patrol"):
    """
    6-step pipeline with defaults for missing data.
    Returns: (PASS/SKIP, score, category, reason)
    """
    
    # Step 1: Original or authority reply?
    if tweet["is_reply"] and not is_authority_author(tweet["author"]):
        return SKIP, 0, None, "Reply from non-authority"
    
    # Step 2: English?
    if not detect_english(tweet["text"]):
        return SKIP, 0, None, "Non-English"
    
    # Step 3: Bot/spam?
    if matches_exclusion_pattern(tweet["text"], tweet["author"]):
        return SKIP, 0, None, "Bot/spam pattern"
    
    # Step 4: Engagement threshold?
    views = tweet.get("views") or (tweet["likes"] * 7)
    threshold_likes = 3 if mode == "fire_patrol" else 5
    threshold_views = 50 if mode == "fire_patrol" else 200
    
    if tweet["likes"] < threshold_likes or views < threshold_views:
        return SKIP, 0, None, f"Low engagement (likes={tweet['likes']}, views={views})"
    
    # Step 5: Deduplication?
    if is_duplicate(tweet["id"], tweet["author"], days=90):
        return SKIP, 0, None, "Dedup: replied in last 90 days"
    
    # Step 6: Score & category?
    category = assign_category(tweet)
    score = calculate_score(tweet, category)
    
    if score < mode_threshold(mode, category):
        return SKIP, score, category, "Low score"
    
    return PASS, score, category, f"Category={category}, Score={score:.1f}"
```

---

## Metrics to Log

For each filtered tweet, log:
- Tweet ID
- Author
- Original engagement (likes, views, replies, timestamp)
- Which step caused SKIP (if applicable)
- Final score (if PASS)
- Category (if PASS)
- Timestamp of filter run

Example:
```json
{
  "tweet_id": "1756432168",
  "author": "@fluxdiv",
  "likes": 66,
  "views_est": 462,
  "status": "PASS",
  "category": "pain_point",
  "score": 14.11,
  "mode": "fire_patrol",
  "filtered_at": "2026-02-27T06:32:15Z"
}
```

---

## Summary

**Order matters:** Language check before engagement (fast fail). Dedup before scoring (save CPU).

**Defaults matter:** Missing views? Use likes×7. Missing followers? Use 5k. Unknown author? Check tweet metrics.

**Transparency matters:** Log every SKIP reason + step number. Makes debugging fast.

**Modes differ:** Fire Patrol = tactical (pain, speed, 30-min window). Brand Building = strategic (reach, philosophy, 72-h window).
