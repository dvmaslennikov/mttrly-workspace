---
name: twitter-scout
description: |
  Finds relevant Twitter engagement opportunities for @mttrly using bird CLI.
  Two modes: fire-patrol (real-time pain points: server down, aws bills, crashes) 
  or brand-building (trends: vibe coding, indie hackers, philosophy).
  Generates Hook First replies with strict engagement thresholds.
  Use when the user wants to discover tweets for @mttrly engagement, 
  run scheduled scans (morning/evening), or generate qualified reply candidates.
  Don't use for: manual tweet posting (approval only), analytics (use x-smart-read),
  or general Twitter search (not optimized for discovery).
---

# Twitter Scout Skill

**Purpose:** Real-time Twitter engagement discovery for @mttrly with LLM-generated replies.

**Modes:**
- **Fire Patrol:** Pain points (server down, aws bills, crashes) — 2x/day, 30-min response
- **Brand Building:** Trends (vibe coding, indie hackers, philosophy) — 1x/day, flexible

**Output:** Structured candidates with Hook First replies, engagement metrics, reasoning.

---

## Quick Start

```bash
# Fire Patrol mode (real-time pain points)
./scripts/scout-fire-patrol.sh

# Brand Building mode (trends & thought leadership)
./scripts/scout-brand-building.sh

# Output: JSON + human-readable digest
```

---

## How It Works (3 Steps)

### Step 1: Load Mode-Specific Instructions
- **Fire Patrol:** Read `references/FIRE-PATROL.md` for pain-point queries and filtering rules
- **Brand Building:** Read `references/BRAND-BUILDING.md` for trend queries and tone guidance

### Step 2: Execute Deterministic Script
- Run `scripts/scout-{mode}.sh`
- Uses `bird` CLI to search Twitter (auth via `~/.env.bird`)
- Queries defined in `references/QUERIES.md` (categorized by mode)
- Applies exclusion patterns from `references/EXCLUSION-PATTERNS.md`

### Step 3: Generate & Format Replies
- Parse results using mode-specific filtering rules
- Generate Hook First replies (templates in `references/REPLY-TEMPLATES.md`)
- Score by engagement + recency + relevance
- Output JSON + markdown digest (format: `assets/output-format.md`)

---

## Mode Selection

| Mode | Queries | Cadence | Response | Templates | Link Rule |
|------|---------|---------|----------|-----------|-----------|
| Fire Patrol | Pain points (100% signal) | 2x/day | 30 min | A/B only | No link |
| Brand Building | Trends (13% signal) | 1x/day | 24h | A/B/C | likes >= 5 AND views >= 500 |

---

## Key Features

✅ **Hook First replies:** First 5-7 words cite specific detail (not generic)  
✅ **Engagement-aware:** No link on low-reach tweets (17-19 views = zero ROI)  
✅ **Includes replies:** 83% of reply-threads are relevant + organic  
✅ **Crypto/bot filtered:** Bankrbot, web3, airdrop tokens excluded  
✅ **Two-stream design:** Pain points don't mix with philosophy in same scoring  

---

## File Reference

**Start here:**
- `references/FIRE-PATROL.md` — Pain points guide (queries, filtering, templates)
- `references/BRAND-BUILDING.md` — Trends guide (queries, tone, metrics)

**Detailed specs:**
- `references/QUERIES.md` — All search terms by category
- `references/REPLY-TEMPLATES.md` — Hook First formula + examples
- `references/EXCLUSION-PATTERNS.md` — Crypto/bot/spam filters

**Output & Assets:**
- `assets/output-format.md` — JSON structure for candidates
- `assets/reply-examples.md` — Real examples (good vs bad)

**Scripts:**
- `scripts/scout-fire-patrol.sh` — Pain-point scanner
- `scripts/scout-brand-building.sh` — Trend scanner

---

## Validation Notes

- **Discovery:** Skill loads when user requests "fire patrol", "pain points", "trends", or "brand building" engagement
- **Logic:** Each mode has explicit filtering rules, no ambiguity on scoring
- **Edge Cases:** See `references/FIRE-PATROL.md` "Error Handling" for 429 rate limits, 401 auth failures

---

## Metrics

**Fire Patrol:** 100% signal, 22+ tweets/day, <30 min response time  
**Brand Building:** 13% signal but high views, sustained presence building

---

**Skill Version:** 2.0 (Minko refactor + LLM validation)  
**Last Updated:** 2026-02-27  
**Auth:** Bird CLI + cookie-based Twitter auth
