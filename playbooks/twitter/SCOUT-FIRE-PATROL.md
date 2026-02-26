# SCOUT-FIRE-PATROL — Pain Points Real-Time Engagement

**Mode:** Real-time pain detection and immediate response  
**Cadence:** 2x/day (morning + evening)  
**Response window:** 30 minutes (while tweet is hot)  
**Target:** People with active problems NOW  

---

## GOAL

Find tweets where people are experiencing **active pain** (server down, money bleeding, deployment breaking). Reply fast with genuine help. No selling, no philosophy — just "I see your problem and here's what works."

---

## SEARCH QUERIES (Pain Points Only)

### Category 1: Server/Infrastructure Down
```
"server down" OR "server is down" OR "crashed" -test -demo
"app crashed" OR "app keeps crashing" production -debug
"502 error" OR "503 error" OR "service unavailable" -test
"database crashed" OR "db is down" production
"nginx error" -tutorial -howto
```

### Category 2: Cloud Costs / Billing
```
"aws bill" shocked OR expensive OR "hundreds" -tutorial
"cloud bill" expensive OR "out of budget" OR surprised
"aws charges" high -explained
"vercel bill" OR "railway bill" expensive -expected
```

### Category 3: Deployment/Production Failures
```
"deployment failed" production -scheduled -tutorial
"deploy broke" OR "push broke prod" -howto
"prod down" OR "production down" now
"rollback failed" OR "can't rollback" incident
```

### Category 4: On-call/Incident Pain
```
"3am alert" OR "woke me up" production issue
"incident response" nightmare OR chaos -training
"on-call" tomorrow dreading OR anxiety
```

### Category 5: Self-hosted / Infrastructure Struggling
```
"self-hosted" frustrated OR "can't figure out" OR nightmare -advice
"vps" overwhelmed OR "too much work" OR "managing"
"manage my own" infrastructure nightmare OR "never again"
```

### Category 6: Monitoring/Observability Gap
```
"no idea what broke" OR "couldn't find the issue" production
"monitoring failed" OR "monitoring is bad" -tutorial
"logs are useless" OR "can't debug production" -guide
```

**Exclusion patterns (all queries):**
```
-bankrbot -"deploy the token" -"on Base" -web3 -"on-chain" -airdrop 
-$SOL -$ETH -"bot token" -"trading bot" -crypto -defi
-tutorial -howto -explained -guide -documentation
```

---

## FILTERING RULES (STRICT)

### Include/Exclude
- ✅ **Original tweets AND replies** (people in threads helping each other = organic)
- ✅ **Any engagement level** (pain is pain, even at 3 likes)
- ✅ **Recent only** (< 24 hours for morning, < 8 hours for evening)
- ❌ **Test/demo tweets** (exclude "testing", "demo", "example")
- ❌ **Non-English** (check for Latin script + English keywords)
- ❌ **Crypto/bot/promo noise** (see exclusion patterns above)
- ❌ **Tutorials/howtos** (people solving, not people asking)

### Author filters
- ✅ **Not a bot** (no: "bot", "automated", "api-", "trading bot")
- ✅ **Any follower count** (pain doesn't care about followers)
- ✅ **Replies from domain experts** (they validate the problem is real)

---

## TEMPLATE SELECTION

**Template A: Pure Value (default for fire patrol)**
- Hook first (cite specific detail)
- No mention of mttrly (just help)
- 1-2 sentences max
- Example: "The moment you realize $200/month AWS bill is for unused resources nobody is using"

**Template B: Question (when context unclear)**
- Ask clarifying question
- No mention of mttrly
- Example: "Is it the initial spike, or steady state that's expensive?"

**Template C: Value + Mention (DISABLED for fire-patrol)**
- Don't use in this mode
- Fire patrol is pure help, not sales

---

## REPLY FORMULA FOR PAIN POINTS

**Structure:** Empathy (understand pain) → Insight (why it happens) → Value (what actually works)

### Example 1: Server Down
```
Tweet: "production server just went down, 2am, no idea why"

Reply: "The worst part isn't downtime — it's not knowing why. 
That gap between "it's down" and "here's what broke" is where you panic. 
Good observability closes that gap fast."
```

### Example 2: AWS Bill Shock
```
Tweet: "just looked at aws bill. $400. for a side project. wtf"

Reply: "That's usually a single resource at scale (database auto-scaling, or data transfer). 
Worth 10 min to find it, because next month will be same. Check CloudWatch costs first."
```

### Example 3: Deployment Failure
```
Tweet: "deploy script broke prod. rollback is also broken. fun friday night"

Reply: "Rollback is insurance. If you can't roll back in 30 seconds, 
your deploy system isn't protecting you. That's the real problem to fix, not the deploy itself."
```

### Example 4: Monitoring Failed
```
Tweet: "monitoring said everything was fine. users reported outage 30 min later"

Reply: "That's monitoring catching symptoms, not causes. 
Real monitoring should show the problem before users see it. 
That's the difference between reactive and preventive."
```

---

## TONE RULES

- ✅ Confident (you've seen this 100 times)
- ✅ Empathy first (not judgment)
- ✅ Specific insight (not generic platitudes)
- ✅ Actionable (something they can think about)
- ✅ Short (1-2 sentences, they're stressed)
- ❌ No sales pitch
- ❌ No "try our product"
- ❌ No corporate speak
- ❌ No "thoughts and prayers"

---

## OUTPUT FORMAT

For each candidate tweet:

```
CATEGORY: Pain Point
PRIORITY: [High/Medium/Low]
ENGAGEMENT: [likes] likes | [age] hours old
TYPE: [Original/Reply] | [Author info]

TWEET:
[full text]

HOOK (first 5-7 words):
[specific detail from tweet]

REPLY:
[Template A reply]

LINK:
[twitter.com/.../status/...]

REASONING:
[why we reply to this]
```

---

## SCHEDULING

**Morning Fire Patrol (06:30 MSK):**
- Scan last 8 hours
- Look for active incidents happening overnight
- Reply in next 30 minutes

**Evening Fire Patrol (17:30 MSK):**
- Scan last 12 hours
- Look for workday problems (deployments, costs discovered)
- Reply before people leave office (maximum visibility)

---

## SUCCESS METRICS

| Metric | Target | Why |
|--------|--------|-----|
| Signal % | 90%+ | We're finding real problems |
| Reply rate | 80%+ of candidates | People engage with genuine help |
| Response time | < 30 min | Pain is time-sensitive |
| Engagement per reply | 2-5 likes | Organic conversations > promotion |

---

## NOTES

- **Replies are gold here** — when person A posts problem, person B replies "same happened to me", that's where mttrly reply fits naturally
- **Don't worry about reach** — 3 likes on a pain point = 3 people with same problem, all reading
- **Speed matters** — 2am alert reply at 6am is worth less than 30 min reply
- **Specificity matters** — "Your bill went high because auto-scaling" > "monitoring is important"

---

**Mode created:** 2026-02-26  
**Purpose:** Real-time engagement on active problems  
**Pair with:** SCOUT-BRAND-BUILDING.md for trends/philosophy
