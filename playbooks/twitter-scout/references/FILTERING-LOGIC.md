# Filtering Logic (Detailed)

How to filter raw tweet results into qualified candidates.

---

## Filter Application Order

**Apply these in order. If ANY filter fails → skip tweet.**

### 1. Already Engaged (Deduplication)
```
Check: Is tweet_id in x-engagement-tracking.md?
  YES → SKIP (reason: already_replied)
  NO → continue
```

**Why:** Don't reply twice to the same tweet (spam signal)

---

### 2. Language Check
```
Function is_english(text):
  ascii_chars = text.match(/[a-zA-Z0-9\s.,!?'""-]/g)
  ratio = ascii_chars.length / text.length
  return ratio > 0.7

Check: is_english(tweet.text)?
  YES → continue
  NO → SKIP (reason: not_english)
```

**Why:** We reply in English, targeting English audience

**Edge case:** Author name is Cyrillic (OK). Evaluate tweet content, not author name.

---

### 3. Bot Check
```
Function is_bot(author):
  bot_keywords = ["bot", "automated", "script", "api", "crawler", 
                   "trading bot", "bot token"]
  name_lower = author.name.toLowerCase()
  username_lower = author.username.toLowerCase()
  
  return bot_keywords.some(k => name_lower.includes(k) || username_lower.includes(k))

Check: is_bot(tweet.author)?
  YES → SKIP (reason: is_bot)
  NO → continue
```

**Why:** Bots don't engage meaningfully

**Example:**
- `@bankrbot` → SKIP
- `@trading_bot_signals` → SKIP
- `@alex_developer` → OK (not a bot)

---

### 4. Spam/Promo Check
```
Function is_spam(text):
  spam_keywords = ["buy now", "click here", "sign up", "limited offer",
                   "coupon", "discount", "check out", "get started"]
  text_lower = text.toLowerCase()
  return spam_keywords.some(k => text_lower.includes(k))

Check: is_spam(tweet.text)?
  YES → SKIP (reason: is_spam)
  NO → continue
```

**Why:** We engage, not pitch. Spam tweets don't need our insight.

---

### 5. Engagement Threshold
```
Fire Patrol minimum:   likes >= 3
Brand Building minimum: likes >= 5

Check: tweet.likes >= threshold?
  YES → continue
  NO → SKIP (reason: low_engagement)
```

**Why:**
- Fire Patrol: Pain points are rare, even 3 likes = signal
- Brand Building: Trends need some traction

**Edge case:** If `likes` is missing → set to 0 → SKIP

---

### 6. Age Filter
```
Max age: 72 hours

Check: tweet_age_hours <= 72?
  YES → continue
  NO → SKIP (reason: too_old)

Formula:
  tweet_age_hours = (now - tweet.createdAt) / 3600
```

**Why:**
- Fire Patrol: Quick response needed
- Brand Building: 72h window catches trends, not ancient posts

**Exact boundary:** Include if age == 72h (use `<=`, not `<`)

---

### 7. Exclusion Patterns
```
exclusion_patterns = [
  "bankrbot", "deploy the token", "on Base", "web3", "on-chain",
  "airdrop", "$SOL", "$ETH", "bot token", "trading bot", 
  "crypto", "defi"
]

Check: Does tweet.text contain ANY exclusion pattern?
  YES → SKIP (reason: excluded_pattern)
  NO → continue
```

**Why:** Crypto/bot spam noise (0% signal)

---

### 8. Reply Type (Include Both)
```
Note: Replies (is_reply=true) are INCLUDED, not skipped.
This is intentional — replies from domain experts are gold.

Example:
  Original: @someone "my server is down"
  Reply:    @theconfigguy "happened to us, here's what worked"
  → Include both in candidates
```

**Why:** 83% of replies are relevant + more organic (people helping people)

---

## Summary: All Filters

| # | Filter | Fire Patrol | Brand Building | Skip Reason |
|---|--------|-------------|----------------|------------|
| 1 | Already engaged | Skip | Skip | already_replied |
| 2 | Language | English | English | not_english |
| 3 | Bot check | Not bot | Not bot | is_bot |
| 4 | Spam check | Not spam | Not spam | is_spam |
| 5 | Engagement | >= 3 likes | >= 5 likes | low_engagement |
| 6 | Age | <= 72h | <= 72h | too_old |
| 7 | Exclusions | Yes | Yes | excluded_pattern |
| 8 | Reply type | Include | Include | (not skipped) |

---

## Example: Apply Filters

**Raw tweet:**
```json
{
  "id": "123456",
  "text": "my server is down, 3am, no idea why",
  "likes": 15,
  "createdAt": "2026-02-27T03:00:00Z",
  "author": {"username": "dev_alex", "name": "Alex"},
  "isReply": false
}
```

**Scan time:** 2026-02-27T18:00:00Z (15h later)

**Apply filters:**
1. ✅ Already engaged? NO → continue
2. ✅ English? YES ("server down, 3am, no idea why") → continue
3. ✅ Bot? NO (username: dev_alex, name: Alex) → continue
4. ✅ Spam? NO (no spam keywords) → continue
5. ✅ Engagement? YES (15 likes >= 3) → continue
6. ✅ Age? YES (15h <= 72h) → continue
7. ✅ Exclusions? NO (no crypto/bot patterns) → continue
8. ✅ Type? Original tweet (OK) → continue

**Result:** PASS all filters → Include in candidates

---

**Last Updated:** 2026-02-27  
**Purpose:** Deterministic filtering, no hallucinating
