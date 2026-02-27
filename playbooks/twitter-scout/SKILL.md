---
name: twitter-scout
description: |
  Discovers Twitter engagement opportunities for @mttrly using bird CLI.
  Two modes: (1) Fire-Patrol: real-time pain points (server down, aws bills, crashes) 
  with 30-min response; (2) Brand-Building: trends (vibe coding, indie hackers) 
  with flexible timing. Generates Hook First reply candidates (never auto-posts; 
  requires user approval). Filters by engagement (pain-points 3+, brand-building 5+), 
  no link unless 500+ views.
  Use when discovering tweets for engagement, running morning/evening scans, 
  or generating reply candidates.
  Don't use for manual posting (approval only), analytics (use x-smart-read), 
  or general Twitter search (not optimized).
---

# Twitter Scout Skill (REFINED v2.1)

**Purpose:** Real-time Twitter engagement discovery for @mttrly.

**Modes:**
- **Fire Patrol:** Pain points → 2x/day, 30-min response
- **Brand Building:** Trends → 1x/day, flexible timing

---

## How It Works (3 Steps)

### Step 1: Load Mode-Specific Rules
- **Fire Patrol:** Read `references/FIRE-PATROL.md` (pain-point categories, filtering)
- **Brand Building:** Read `references/BRAND-BUILDING.md` (trend categories, tone)

### Step 2: Collect Raw Results
- Execute `scripts/scout-{mode}.sh`
- Uses `bird` CLI + auth from `~/.env.bird`
- Queries from `references/QUERIES.md`
- Filters from `references/EXCLUSION-PATTERNS.md`
- Outputs JSON to `./candidates-{timestamp}.json`
- **See references/ERROR-HANDLING.md for rate limits, auth failures, empty results**

### Step 3: Filter, Score, Generate Replies
- **Filter:** Read `references/FILTERING-LOGIC.md` for rules (engagement, language, bot check)
- **Score:** Use scoring formula from `references/SCORING-FORMULA.md`
- **Generate:** Use Hook First templates from `references/REPLY-TEMPLATES.md`
- **Output:** Format per `assets/output-format.md` (JSON + markdown digest)

---

## Quick Commands

```bash
# Fire Patrol (pain points)
./scripts/scout-fire-patrol.sh
# → Outputs: candidates-fire-patrol-{timestamp}.json
# Next: Load references/FILTERING-LOGIC.md and apply filters

# Brand Building (trends)
./scripts/scout-brand-building.sh
# → Outputs: candidates-brand-building-{timestamp}.json
# Next: Load references/FILTERING-LOGIC.md and apply filters
```

---

## Critical: Just-In-Time Loading

**DO NOT read all references at once.** Load only when needed:

| When | Read | Purpose |
|------|------|---------|
| Starting fire-patrol | `references/FIRE-PATROL.md` | Understand pain-point categories |
| Starting brand-building | `references/BRAND-BUILDING.md` | Understand trend categories |
| Writing search queries | `references/QUERIES.md` | See all search terms |
| Filtering results | `references/FILTERING-LOGIC.md` | Apply engagement/language/bot rules |
| Scoring tweets | `references/SCORING-FORMULA.md` | Calculate relevance score |
| Generating replies | `references/REPLY-TEMPLATES.md` | Use Hook First formula |
| Applying exclusions | `references/EXCLUSION-PATTERNS.md` | Filter spam/crypto/bots |
| Script fails | `references/ERROR-HANDLING.md` | Handle 429, 401, 0 results, etc |

---

## Filtering Rules (Quick Reference)

**Apply in order:**
1. ✅ Original tweet OR reply (include both)
2. ✅ English language
3. ✅ Not a bot (check author.name, author.username)
4. ✅ Engagement >= threshold (fire-patrol: 3+ likes, brand-building: 5+ likes)
5. ✅ Age <= 72 hours
6. ✅ No exclusion patterns matched (see `references/EXCLUSION-PATTERNS.md`)

**Full logic:** See `references/FILTERING-LOGIC.md`

---

## Scoring Formula (Quick Reference)

```
score = (engagement + freshness + reply_bonus) × category_weight

engagement = min(likes / 20, 3)             [max 3]
freshness = max(2 - hours / 36, 0)          [0-2, decays over 72h]
reply_bonus = +1 if is_reply                [expertise signal]
category_weight = {pain_point: 3, audience: 2, competitor: 1.5, other: 0.8}
```

**Ranking:**
- 12+: ГОРЯЧЕЕ (fire patrol priority)
- 7-11: ХОРОШЕЕ (brand building engagement)
- 3-6: МОНИТОРИНГ (watch but don't always reply)
- <3: SKIP

**Full logic:** See `references/SCORING-FORMULA.md`

---

## Error Handling

**Scripts fail? Agent doesn't know what to do?**

See `references/ERROR-HANDLING.md` for:
- 429 (rate limit) → retry logic
- 401 (auth expired) → restart auth, notify user
- 0 results → skip query, continue
- Missing fields (followers) → default values
- Timestamp edge cases → exact boundaries

---

## Output Format

Each tweet candidate includes:
- `tweet_id`, `author`, `engagement` (likes, views, age)
- `quality_signals` (language, bot check, relevance)
- `scoring` (engagement_score, freshness_score, total_score)
- `reply_candidates` (Template A, B, C with Hook First)

**See `assets/output-format.md` for JSON schema + markdown template**

---

## Key Metrics

- **Fire Patrol:** 100% signal, 22+ tweets/day, <30 min response
- **Brand Building:** 13% signal, high reach, sustained presence

---

## Validation Status

✅ **Discovery:** Description is clear, triggers on correct prompts  
✅ **Logic:** Agent can execute without hallucinating  
⚠️ **Edge Cases:** See `references/ERROR-HANDLING.md` (NEW FILE)  
✅ **Architecture:** SKILL.md is JiT navigation, details on-demand  

---

**Skill Version:** 2.1 (LLM-validated)  
**Last Updated:** 2026-02-27  
**Validation:** Step 4 refinement complete
