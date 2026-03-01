# 🚨 Fire Patrol Report (Example)
**Date:** 2026-02-28  
**Mode:** fire-patrol  
**Source file:** `fire-patrol-candidates-2026-02-28T12:30:03Z.json`

## Summary
- Collected: **258**
- Passed filters: **5**
- Quality: **mostly relevant**, 1 borderline tooling tweet

## Top Passed Tweets (with comments)

1) **@RunOnFlux** — Score **5.00** (tech_individual)
- Anchors: 5
- Text: production-grade deploy, no Dockerfile/YAML, DevOps friction
- Comment: ✅ Strong fit (shipping/devops pain, relevant audience)

2) **@bigaiguy** — Score **5.00** (tech_individual)
- Anchors: 7
- Text: vector DB, no server/cloud bills/devops nightmare
- Comment: ✅ Relevant infra angle, but slightly hype-heavy

3) **@solomonking** — Score **4.58** (tech_individual)
- Anchors: 1
- Text: workflow + “fix server things”
- Comment: ⚠️ Medium relevance (tech context present, incident signal weak)

4) **@wildpinesai** — Score **2.57** (unknown)
- Anchors: 2
- Text: “deploy broke prod at 2am”
- Comment: ✅ Acceptable pain-point signal despite unknown author type

5) **@andrew_da_miz** — Score **1.91** (unknown)
- Anchors: 1
- Text: Sentry/Datadog alternative announcement
- Comment: ⚠️ Borderline (more tooling promo than incident pain)

## Skip Reasons Snapshot
- low_engagement: 116
- unknown_author_weak_signal / no_tech_context / context_blacklisted: major quality gate buckets
- sports/news/war noise significantly reduced vs previous run

## Recommendation
- Keep current filter stack.
- Optional micro-tuning: drop `unknown` tweets with score `< 2.5` in fire-patrol mode to remove borderline tooling noise.
