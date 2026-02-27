# Exclusion Patterns (Spam/Bot/Noise Filtering)

## Master Exclusion List

Use these patterns to filter out noise from ALL queries:

```
-bankrbot -"deploy the token" -"on Base" -web3 -"on-chain" 
-airdrop -$SOL -$ETH -"bot token" -"trading bot" -crypto -defi
```

---

## Pattern Breakdown

### Bot Accounts
- `-bankrbot`: Known spammy bot account (fake incident alerts)

### Crypto / DeFi / Web3
- `-web3`, `-defi`, `-crypto`: Entire DeFi ecosystem (off-brand)
- `-"on Base"`, `-"on-chain"`: Layer-2 / blockchain context
- `-"deploy the token"`: Token deployment = not our audience
- `-"bot token"`: Automated trading bots

### Trading / Finance
- `-$SOL`, `-$ETH`: Specific crypto tokens (expensive spam)
- `-"trading bot"`: Automated trading signals (spam)
- `-airdrop`: Token airdrops (promotional)

---

## Why These?

**Calibration found:**
- Crypto/web3 tweets: 0% signal (wrong audience)
- Bankrbot: 50+ fake incidents/day (completely pollutes fire-patrol)
- Trading bots: High volume, zero relevance
- Airdrop spam: Coordinated bot networks

**Total filter efficiency:** ~40% of raw tweets are filtered out by exclusions

---

## Extension Rules

**Add to queries when filtering specific categories:**

For **learning/education** tweets:
```
-tutorial -guide -howto -documentation -explained -course
```

For **product promotion**:
```
-"check out" -"sign up" -"click here" -"limited time" -coupon
```

For **news/spam**:
```
-bitcoin -ethereum -"breaking news" -alert -scam
```

---

## Testing Exclusions

To validate exclusions are working:

```bash
# Without exclusions (raw query)
bird search "server down" -n 50

# With exclusions (filtered)
bird search "server down" -n 50 -bankrbot -"deploy the token" -crypto
```

Compare results. Noise should decrease by ~40%.

---

**Last Updated:** 2026-02-27  
**Calibration Source:** Real bird CLI output analysis
