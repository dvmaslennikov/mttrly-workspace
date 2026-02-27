# Scoring Formula (Detailed)

How to score and rank filtered tweet candidates.

---

## Formula

```
score = (engagement + freshness + reply_bonus) × category_weight

Components:
  engagement = min(likes / 20, 3)               [0-3 points]
  freshness = max(2 - hours / 36, 0)            [0-2 points]
  reply_bonus = +1 if tweet.isReply             [0 or 1 point]
  category_weight = {
    pain_point: 3.0,      [3x multiplier for highest priority]
    audience: 2.0,        [2x for learning/growth signals]
    competitor: 1.5,      [1.5x for alternative platform mentions]
    monitoring: 0.8       [0.8x for low-priority observations]
  }

Final score range: 0-18 (approximately)
```

---

## Component Breakdown

### Engagement Score (0-3 points)

```
engagement = min(likes / 20, 3)

Examples:
  3 likes   → 3/20 = 0.15 points
  20 likes  → 20/20 = 1.0 points
  60 likes  → 60/20 = 3.0 points (capped)
  100 likes → 100/20 = 5.0 → capped at 3.0
```

**Why divide by 20?**
- Pain points: Even 3 likes is significant (rare pain)
- Brand building: 5+ likes shows traction
- Dividing by 20 normalizes across low engagement

**Handling missing likes:**
- If `likes` is null or missing → score = 0 for engagement
- Still apply other components (freshness, category weight)

---

### Freshness Score (0-2 points, decays over 72h)

```
freshness = max(2 - hours / 36, 0)

Examples:
  0h    (just posted)     → 2 - 0/36 = 2.0 points
  12h   (morning post)    → 2 - 12/36 = 1.67 points
  24h   (yesterday)       → 2 - 24/36 = 1.33 points
  36h                     → 2 - 36/36 = 1.0 point
  48h                     → 2 - 48/36 = 0.67 points
  72h   (3 days old)      → 2 - 72/36 = 0.0 points
```

**Why this curve?**
- Fresh tweets get higher priority (more engagement potential)
- Decays linearly over 72h window
- At 72h exactly: score becomes 0 (already filtered anyway, but doesn't hurt)

**Handling missing createdAt:**
- If `createdAt` is null → treat as old (freshness = 0)
- Skip tweet? No, just penalize freshness

---

### Reply Bonus (0 or 1 point)

```
reply_bonus = 1 if tweet.isReply else 0

Why?
- Replies from domain experts are expertise signals
- @TheConfigGuy replying to infrastructure question = gold
- Replies are in real conversations (more organic)
- People helping people > random post
```

**Examples:**
- Original tweet → reply_bonus = 0
- Reply from @theconfigguy → reply_bonus = 1 (before category weight)
- Reply from random user → reply_bonus = 1 (we still engage in threads)

---

### Category Weight (1.5-3.0x multiplier)

```
Categories (determined by keyword matching):

1. pain_point (3.0x weight)
   Keywords: server, down, crashed, aws bill, incident, 3am, failed
   Why: Highest priority, real problem NOW
   
2. audience (2.0x weight)
   Keywords: solo founder, indie hacker, learning, first deploy, vibe coding
   Why: High priority, signals growth market
   
3. competitor (1.5x weight)
   Keywords: vercel, railway, expensive, migration, heroku
   Why: Medium priority, audience signal
   
4. monitoring (0.8x weight)
   Keywords: everything else (community, trends, philosophy)
   Why: Low priority, impression building not urgent response
```

**Keyword detection:**
```python
def categorize(text):
  text_lower = text.lower()
  
  if any(k in text_lower for k in ["server down", "crashed", "aws bill", "incident"]):
    return "pain_point"
  elif any(k in text_lower for k in ["solo founder", "indie", "first deploy", "vibe"]):
    return "audience"
  elif any(k in text_lower for k in ["vercel", "railway", "expensive", "migration"]):
    return "competitor"
  else:
    return "monitoring"
```

---

## Putting It Together

### Example 1: Fresh Pain Point

```
Tweet:
  likes: 46
  createdAt: 2026-02-27 01:00:00Z
  now: 2026-02-27 18:00:00Z
  isReply: false
  text: "server crashed at 3am, no idea what happened"

Calculation:
  engagement = min(46 / 20, 3) = 2.3
  freshness = 2 - 17 / 36 = 1.53
  reply_bonus = 0 (original tweet)
  category = pain_point (3.0x)
  
  score = (2.3 + 1.53 + 0) × 3.0 = 11.39
  
Ranking: ГОРЯЧЕЕ (12+ score threshold doesn't apply here, but HIGH priority)
```

### Example 2: Old Brand-Building

```
Tweet:
  likes: 25
  createdAt: 2026-02-25 10:00:00Z
  now: 2026-02-27 18:00:00Z
  isReply: true
  text: "finally understood devops, it's not as scary as I thought"

Calculation:
  engagement = min(25 / 20, 3) = 1.25
  freshness = 2 - 56 / 36 = 0.44
  reply_bonus = 1 (is a reply)
  category = audience (2.0x)
  
  score = (1.25 + 0.44 + 1) × 2.0 = 5.38
  
Ranking: МОНИТОРИНГ (below 7 threshold, but interesting thread signal)
```

### Example 3: Authority Reply to Pain Point

```
Tweet:
  likes: 5
  createdAt: 2026-02-27 14:00:00Z
  now: 2026-02-27 18:00:00Z
  isReply: true
  text: "@someone the problem is your monitoring is reactive not preventive"
  author: @rakyll

Calculation:
  engagement = min(5 / 20, 3) = 0.25
  freshness = 2 - 4 / 36 = 1.89
  reply_bonus = 1 (domain expert replying)
  category = pain_point (3.0x)
  
  score = (0.25 + 1.89 + 1) × 3.0 = 11.13
  
Ranking: ГОРЯЧЕЕ (authority expertise signal boosts low engagement)
```

---

## Ranking Tiers

```
score >= 12:    ГОРЯЧЕЕ (Hot)
  → Fire patrol candidates
  → Reply within 30 min
  → High priority
  
7-11:           ХОРОШЕЕ (Good)
  → Brand building candidates
  → Reply within 24h
  → Medium priority
  
3-6:            МОНИТОРИНГ (Monitoring)
  → Watch, reply selectively
  → Low priority
  → High-quality only
  
< 3:            SKIP
  → Not worth reply
```

---

## Handling Edge Cases

### Tied Scores (Same Score)

If two tweets have identical scores (e.g., both 11.39):

1. **Tiebreaker 1:** Freshness (newer first)
   - Lower hours_old wins
2. **Tiebreaker 2:** Engagement (more likes first)
   - Higher likes wins
3. **Tiebreaker 3:** Follower count (larger account first)
   - Higher followers wins
4. **Tiebreaker 4:** Tweet ID (most recent first)
   - Larger ID wins

**Reasoning:** Fresh + engaged = better signal

---

### Missing Score Components

**If likes missing:**
- engagement = 0
- Still calculate freshness × category_weight
- Proceed with partial score

**If createdAt missing:**
- freshness = 0
- Still calculate engagement × category_weight
- Mark as "age unknown" in output

**If isReply missing (unknown):**
- reply_bonus = 0 (conservative)
- Proceed

---

## Output Format

```json
{
  "tweet_id": "123456",
  "scoring": {
    "engagement_score": 2.3,
    "engagement_breakdown": "46 likes / 20 = 2.3",
    "freshness_score": 1.53,
    "freshness_breakdown": "17 hours old → 2 - 17/36 = 1.53",
    "reply_bonus": 0,
    "category": "pain_point",
    "category_weight": 3.0,
    "total_score": 11.39,
    "ranking": "ГОРЯЧЕЕ"
  }
}
```

---

**Last Updated:** 2026-02-27  
**Purpose:** Deterministic, transparent scoring
