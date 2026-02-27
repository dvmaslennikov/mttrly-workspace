# SCORING-FORMULA.md — Weights + Ranking Tiers

## Full Scoring Equation

```
SCORE = (relevance × w_rel) + (freshness × w_fresh) + (reach × w_reach) + 
        (authority × w_auth) + (tone × w_tone)

Where:
  relevance ∈ [0, 5]     (category match + specificity)
  freshness ∈ [0, 2]     (age within mode window)
  reach ∈ [0, 2]         (likes + estimated views)
  authority ∈ [0, 2]     (author followers + domain expertise)
  tone ∈ [0, 1]          (writing style + professionalism)

  w_rel = 3.0    (category relevance is primary signal)
  w_fresh = 0.5  (freshness is tiebreaker)
  w_reach = 2.0  (engagement proves it resonates)
  w_auth = 1.5   (authority adds credibility)
  w_tone = 1.0   (tone affects reply appropriateness)

MAX_SCORE = (5 × 3.0) + (2 × 0.5) + (2 × 2.0) + (2 × 1.5) + (1 × 1.0)
          = 15.0 + 1.0 + 4.0 + 3.0 + 1.0
          = 24.0 (theoretical max, rarely achieved)
```

---

## Component Scoring

### 1. RELEVANCE (0–5 points, weight: 3.0)

Measures how well the tweet matches the category and how specific the pain point / signal is.

#### Category: pain_point
| Signal | Points | Examples |
|--------|--------|----------|
| **Specific incident** (service down, 3am, timeout, OOM, deploy failed) | 5 | "Lambda timeout after deploy" |
| **Named service + problem** (AWS bill spike, GCP auth issue) | 4 | "$300 bill from overage charges" |
| **Generic production issue** (things break, prod incident, bad day) | 2 | "Nothing works on Friday" |
| **Aspirational** (built prod app, handling scale) | 0 | "Built production app without CS" |

**Logic:**
```
if tweet_text contains specific_incident_keyword:
  relevance_pain = 5
elif tweet_text contains service_name + error_keyword:
  relevance_pain = 4
elif tweet_text matches generic_prod_pattern:
  relevance_pain = 2
else:
  relevance_pain = 0
```

#### Category: audience
| Signal | Points | Examples |
|--------|--------|----------|
| **Solo founder / zero CS background** (explicitly stated) | 5 | "@walls_jason1: 'I have zero CS degree'" |
| **Indie developer / bootstrapped** (clear context) | 4 | "Built solo in 3 months" |
| **Small team / startup** (implied) | 3 | "We're 5 people" |
| **General audience mention** (broad, not specific) | 1 | "Developers hate X" |

**Logic:**
```
if tweet_author matches founder_profile:
  relevance_audience = 5
elif tweet_text contains indie_signal:
  relevance_audience = 4
elif tweet_text contains team_signal:
  relevance_audience = 3
else:
  relevance_audience = 1
```

#### Category: monitoring (trends, philosophy, no direct action)
| Signal | Points | Examples |
|--------|--------|----------|
| **Emerging pattern** (5+ tweets in 24h on same topic) | 3 | "MCP adoption spike" |
| **Philosophy / thought leadership** | 2 | "Why on-call burnout exists" |
| **Community chatter** (mentions, RTs) | 1 | "React v19 released" |

---

### 2. FRESHNESS (0–2 points, weight: 0.5)

Measures recency within mode's time window.

#### Fire Patrol (30-minute window)
| Age | Points |
|-----|--------|
| 0–10 min | 2.0 |
| 10–20 min | 1.5 |
| 20–30 min | 1.0 |
| >30 min | 0.0 (SKIP in filtering) |

**Formula:** `freshness_fire = max(0, 2.0 - (age_minutes / 15))`

#### Brand Building (72-hour window)
| Age | Points |
|-----|--------|
| 0–6 hours | 2.0 |
| 6–24 hours | 1.5 |
| 24–48 hours | 1.0 |
| 48–72 hours | 0.5 |
| >72 hours | 0.0 (SKIP) |

**Formula:** `freshness_brand = max(0, 2.0 - (age_hours / 36))`

**Rationale:** Fresh content = hot signal. Pain points must be <30 min to reply while trendy. Thought leadership can age 72h.

---

### 3. REACH (0–2 points, weight: 2.0)

Measures engagement (likes + views) relative to mode baseline.

#### Fire Patrol
| Engagement | Points | Formula |
|------------|--------|---------|
| 3–5 likes (50–100 views) | 0.5 | Low signal |
| 6–15 likes (100–300 views) | 1.0 | Moderate |
| 16–50 likes (300–800 views) | 1.5 | Strong |
| 50+ likes (800+ views) | 2.0 | Very strong |

**Formula:** `reach_fire = min(2.0, likes / 25)` (capped at 2.0)

#### Brand Building
| Engagement | Points | Formula |
|------------|--------|---------|
| 5–20 likes (200–500 views) | 0.5 | Low reach |
| 21–100 likes (500–2K views) | 1.0 | Moderate reach |
| 100–500 likes (2K–8K views) | 1.5 | Strong reach |
| 500+ likes (8K+ views) | 2.0 | Viral reach |

**Formula:** `reach_brand = min(2.0, likes / 250)` (capped at 2.0)

**Estimated views:** If bird returns views, use actual. Else, views ≈ likes × 7.

---

### 4. AUTHORITY (0–2 points, weight: 1.5)

Measures author credibility + domain expertise.

#### Domain Expert Bonus
| Author | Bonus | Notes |
|--------|-------|-------|
| @rakyll | +1.0 | Go/infrastructure authority |
| @copyconstruct | +1.0 | Distributed systems |
| @TheConfigGuy | +0.5 | DevOps/infrastructure |
| @fluxdiv | +0.5 | Billing/economics expert |
| **Authority reply in thread** | +1.0 | Domain expert replying to tweet |

#### Base Authority Score (author followers)
| Followers | Points |
|-----------|--------|
| <1K | 0.0 |
| 1K–10K | 0.5 |
| 10K–100K | 1.0 |
| 100K–1M | 1.5 |
| 1M+ | 2.0 |

**Final authority score:**
```
authority = base_authority + domain_expert_bonus
           (capped at 2.0)
```

**Rationale:** Well-known people's problems carry more signal. Domain experts' insights are rare & valuable.

---

### 5. TONE (0–1 point, weight: 1.0)

Measures writing quality + professionalism. Rewards clear, specific language; penalizes generic/lazy posts.

| Characteristic | Tone Score |
|----------------|-----------|
| **Specific, technical, detailed** | 1.0 | "AWS Lambda timeout error after deploy, takes 2min to timeout" |
| **Clear problem + context** | 0.75 | "Deploy failing because of overage charges on GCP" |
| **Vague but thoughtful** | 0.5 | "When infrastructure breaks at 3am" |
| **Generic complaint** | 0.25 | "Everything is broken" |
| **All caps / spam-like** | 0.0 | "BUY NOW!!" or "THIS IS BROKEN!!!!!!" |

**Detection:**
```
if has_technical_terms(tweet) and has_specifics(tweet):
  tone = 1.0
elif has_problem_context(tweet):
  tone = 0.75
elif is_thoughtful_but_vague(tweet):
  tone = 0.5
elif is_generic_complaint(tweet):
  tone = 0.25
else:
  tone = 0.0
```

---

## Ranking Tiers

After scoring, tweets are placed into tiers based on their final score and mode.

### Fire Patrol Tiers
| Tier | Score Range | Label | Action |
|------|-------------|-------|--------|
| 🔥 ГОРЯЧЕЕ | ≥12.0 | HOT | Reply immediately (Template A/B) |
| 📊 ХОРОШЕЕ | 8.0–11.9 | GOOD | Reply within 1 hour (Template A/B) |
| 👀 МОНИТОРИНГ | 5.0–7.9 | MONITORING | Track, reply later if re-trending |
| ⏭️ SKIP | <5.0 | LOW | Archive, log reason |

### Brand Building Tiers
| Tier | Score Range | Label | Action |
|------|-------------|-------|--------|
| 🔥 ГОРЯЧЕЕ | ≥14.0 | HOT | Reply same-day (Template A/B/C) |
| 📊 ХОРОШЕЕ | 10.0–13.9 | GOOD | Reply within 24h (Template A/B/C) |
| 👀 МОНИТОРИНГ | 6.0–9.9 | MONITORING | Monitor, optional reply in 48h |
| ⏭️ SKIP | <6.0 | LOW | Archive, log reason |

**Output format for tier:**
```json
{
  "tweet_id": "1756432168",
  "author": "@fluxdiv",
  "score": 14.11,
  "tier": "ГОРЯЧЕЕ",
  "category": "pain_point",
  "mode": "fire_patrol",
  "components": {
    "relevance": 4.0,
    "freshness": 1.5,
    "reach": 1.33,
    "authority": 1.0,
    "tone": 0.75
  },
  "hook": "Your overage charges are the killer...",
  "recommendation": "Reply immediately with Template A"
}
```

---

## Tiebreaker Logic

When two tweets have **identical scores**:

1. **Freshness** (recency wins)
   - Compare created_at timestamps
   - Newer tweet ranks higher

2. If freshness tied → **Likes** (engagement wins)
   - Higher likes = more proven signal

3. If likes tied → **Author followers** (authority wins)
   - More followers = larger audience impact

4. If all tied → **Random** (maintain determinism with seed)
   - Use tweet_id + seed for reproducible randomness

---

## Example Calculation

### Tweet: @fluxdiv's overage complaint

**Input:**
```
{
  "text": "The overage charges are the killer. People start free, hit $300+ bill, ghost.",
  "likes": 66,
  "views": 462,
  "created_at": "2026-02-27T05:45:00Z",
  "age_minutes": 20,
  "author_followers": 15000,
  "author": "@fluxdiv",
  "mode": "fire_patrol"
}
```

**Scoring:**

1. **Relevance (pain_point):** "overage charges" + "$300 bill" → specific financial pain → **4.0**
2. **Freshness (20 min old):** `2.0 - (20/15) = 0.67` → **0.67**
3. **Reach:** `min(2.0, 66/25) = 2.0` → **2.0**
4. **Authority:** @fluxdiv (10K–100K) = 1.0 (no domain bonus) → **1.0**
5. **Tone:** Technical, specific issue → **0.75**

**Total:**
```
SCORE = (4.0 × 3.0) + (0.67 × 0.5) + (2.0 × 2.0) + (1.0 × 1.5) + (0.75 × 1.0)
      = 12.0 + 0.33 + 4.0 + 1.5 + 0.75
      = 18.58
```

**Tier:** ГОРЯЧЕЕ (≥12.0 for Fire Patrol) ✅

**Recommendation:** Reply immediately with Template A (empathy on overage pain).

---

## Summary

**Scoring captures:**
- ✅ Category match (relevance)
- ✅ Recency (freshness)
- ✅ Proof of resonance (reach)
- ✅ Author credibility (authority)
- ✅ Writing quality (tone)

**Tiers guide action:**
- ✅ ГОРЯЧЕЕ = act now
- ✅ ХОРОШЕЕ = act soon
- ✅ МОНИТОРИНГ = watch
- ✅ SKIP = log & move on

**Tiebreakers ensure:**
- ✅ Deterministic ranking (no randomness in equal scores)
- ✅ Transparency (all components logged)
- ✅ Mode-aware (different thresholds for fire vs brand)
