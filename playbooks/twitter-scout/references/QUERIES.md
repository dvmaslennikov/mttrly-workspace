# Twitter Scout Queries

All search queries organized by mode and category.

---

## FIRE PATROL QUERIES (Pain Points)

### Server/Infrastructure Down
```
"server down" OR "server is down" OR "crashed" -test -demo
"app crashed" OR "app keeps crashing" production -debug
"502 error" OR "503 error" OR "service unavailable" -test
"database crashed" OR "db is down" production
"nginx error" -tutorial -howto
```

### Cloud Costs / Billing
```
"aws bill" shocked OR expensive OR "hundreds" -tutorial
"cloud bill" expensive OR "out of budget" OR surprised
"aws charges" high -explained
"vercel bill" OR "railway bill" expensive -expected
```

### Deployment/Production Failures
```
"deployment failed" production -scheduled -tutorial
"deploy broke" OR "push broke prod" -howto
"prod down" OR "production down" now
"rollback failed" OR "can't rollback" incident
```

### On-call/Incident Pain
```
"3am alert" OR "woke me up" production issue
"incident response" nightmare OR chaos -training
"on-call" tomorrow dreading OR anxiety
```

### Self-hosted / Infrastructure Struggling
```
"self-hosted" frustrated OR "can't figure out" OR nightmare -advice
"vps" overwhelmed OR "too much work" OR "managing"
"manage my own" infrastructure nightmare OR "never again"
```

### Monitoring/Observability Gap
```
"no idea what broke" OR "couldn't find the issue" production
"monitoring failed" OR "monitoring is bad" -tutorial
"logs are useless" OR "can't debug production" -guide
```

---

## BRAND BUILDING QUERIES (Trends & Philosophy)

### Vibe Coding / Rapid Development
```
"vibe coding" OR "vibing" OR "vibes" deploy OR build OR code
"built with cursor" OR "built with claude" OR "built with AI"
"rapid prototyping" OR "shipped fast" side-project OR indie
"30 minute" OR "built in an hour" shipped OR deployed
```

### Indie Hacker / Solo Founder Signals
```
"solo founder" shipping OR learning OR deployment
"indie hacker" built OR shipped OR learned
"first deploy" OR "deployed for first time" scared OR proud OR nervous
"side project" shipped OR deployed OR live
"learning to deploy" OR "deploying myself" first-time
```

### Developer Learning & Growth
```
"finally understood" devops OR deployment OR infrastructure
"learned the hard way" server OR deploy OR production
"after years of" developer OR engineer realized
"wish I knew" deployment OR infrastructure OR devops
```

### Philosophical / Platform Critique
```
"heroku was simple" OR "heroku shutdown" alternative OR missing
"simplicity matters" infrastructure OR deploy
"over-engineered" kubernetes OR docker
"just want to ship" code not infrastructure
```

### Technology Transitions
```
"moved from vercel" OR "moved from railway" OR "left heroku" why OR migrating
"too expensive" vercel OR railway OR aws OR cloud
"fly.io" expensive OR slow OR migrating OR problems
"render" expensive OR slow OR performance issues
```

### Community & Trends
```
"indie web" movement OR philosophy OR building
"bootstrapped" shipped OR profitable OR sustainable
"no venture capital" building OR sustainable
"profitable from day one" OR "making money" indie
```

---

## EXCLUSION PATTERNS (All Queries)

Apply to every search query to filter noise:

```
-bankrbot 
-"deploy the token" 
-"on Base" 
-web3 
-"on-chain" 
-airdrop 
-$SOL 
-$ETH 
-"bot token" 
-"trading bot" 
-crypto 
-defi
```

**Rationale:**
- `-bankrbot`: Known bot account spamming with fake incidents
- `-web3 / -$SOL / -$ETH`: Crypto/DeFi noise (off-brand)
- `-airdrop / -trading bot`: Promo/bot farming
- `-defi`: DeFi discourse unrelated to DevOps

---

## Query Usage

**Fire Patrol:**
- Use all Pain Points queries
- Add `-test -demo -tutorial -howto` to filter educational content
- Scan every 12 hours (morning + evening)

**Brand Building:**
- Use all Trends & Philosophy queries
- Can be more relaxed on exclusions (some crypto mention OK if context is philosophy)
- Scan once daily (no rush)

---

**Last Updated:** 2026-02-27  
**Calibration Data:** Pain points 100% signal, 22+ tweets/day; Vibe coding 13% signal, high views
