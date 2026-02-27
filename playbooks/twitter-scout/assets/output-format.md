# Output Format Specification

## JSON Candidate Structure

Each tweet candidate should follow this structure:

```json
{
  "tweet_id": "2027071690551779706",
  "mode": "fire-patrol",
  "category": "pain_point",
  "priority": "high",
  "engagement": {
    "likes": 46,
    "replies": 3,
    "retweets": 2,
    "estimated_views": 322
  },
  "author": {
    "username": "theconfigguy",
    "followers": 15400,
    "is_authority": true
  },
  "tweet": {
    "text": "Full tweet text here...",
    "created_at": "2026-02-26T19:30:00Z",
    "age_hours": 2,
    "is_reply": false,
    "parent_url": null
  },
  "quality_signals": {
    "hook": "The $30 stack works until...",
    "language": "english",
    "is_english": true,
    "is_bot": false,
    "is_spam": false,
    "is_relevant": true
  },
  "scoring": {
    "engagement_score": 2.3,
    "freshness_score": 2.0,
    "relevance_score": 3.0,
    "total_score": 14.32,
    "template_suggestion": "A"
  },
  "reply_candidates": {
    "option_a": {
      "template": "A",
      "text": "Hook + specific insight + value. No link.",
      "includes_link": false,
      "confidence": 0.95
    },
    "option_b": {
      "template": "B",
      "text": "Thoughtful question based on detail",
      "includes_link": false,
      "confidence": 0.85
    }
  },
  "reasoning": "Why we selected this tweet and templates",
  "url": "https://x.com/theconfigguy/status/2027071690551779706"
}
```

---

## Markdown Digest Format

For human-readable output:

```markdown
# 🔥 Fire Patrol Scan Results
**Date:** 2026-02-26 | **Time:** 19:30 UTC | **Mode:** Fire Patrol

## 📊 Stats
- Total tweets scanned: 209
- Passed filters: 18 (8.6%)
- Skipped: 191
  - Low engagement: 87
  - Not English: 23
  - Crypto/spam noise: 45
  - Already engaged: 5
  - Other: 31

## 🎯 Top Candidates (Score >= 12)

### 1. @username — Pain Point Category (Score: 14.32)
**Metrics:** 46 likes | 322 views | 2h old | Authority: ✅

**Tweet:**
> Full tweet text...

**Hook (first 5-7 words):**
The $30 stack works until...

**Option A (Template A - Pure Value):**
The $30 stack works until one service goes down and you have no idea what broke...

**Option B (Template B - Question):**
What's your observability setup for this? That's where most people hit the wall.

**Link:** https://x.com/...

**Reasoning:** High relevance, authority source, organic pain point. Hook works well.

---

## Filtering & Scoring Rules

### Filtering (Pass/Fail)
- ✅ Original tweet OR reply (no retweets)
- ✅ English language
- ✅ Not a bot account
- ✅ Not spam/promo
- ✅ Engagement >= threshold (fire-patrol: 3+ likes, brand-building: 5+ likes)
- ✅ Age <= 72 hours
- ✅ No exclusion patterns matched

### Scoring
```
score = (engagement + freshness + reply_bonus) × category_weight

engagement = min(likes / 20, 3)             [0–3 points]
freshness = max(2 - hours / 36, 0)          [0–2 points, 72h window]
reply_bonus = +1 if is_reply                [expertise signal]
category_weight = {pain_point: 3, audience: 2, competitor: 1.5, other: 0.8}
```

### Template Selection
```
Fire Patrol:
  - Always Template A or B (pure value, no link)

Brand Building:
  - Template A/B: default (no link)
  - Template C: only if likes >= 5 AND (views >= 500 OR category == pain_point)
  - Max 40% of brand-building replies use Template C
```

---

**Version:** 2.0 (Minko refactor)  
**Created:** 2026-02-27
