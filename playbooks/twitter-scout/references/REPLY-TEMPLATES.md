# Reply Templates & Hook First Formula

## Hook First Rule (MANDATORY)

**First 5-7 words MUST cite a specific detail from the tweet.**

This proves you read it carefully and aren't just spamming generic replies.

### ❌ BAD (Generic Openings)
```
"I feel this"
"Spot on"
"Exactly this"
"This is exactly what we see"
"Deploy fear is real"
```

### ✅ GOOD (Hooks to Specific Details)
```
"The $30 stack works until..."
"The overage charges are the killer..."
"Built a production app without CS background..."
"The moment you realize your deploy process is the bottleneck..."
"When one of your services goes down at 3am..."
```

---

## Fire Patrol Template (Pain Points)

**Structure:** Empathy (understand pain) → Insight (why it happens) → Value (what works)

**Length:** 1-2 sentences max (people are stressed)

**Link:** Never (no mttrly mention, pure help)

### Pain Point: Server Down / Incident
```
Hook: "When one of your services goes down at 3am and you have no idea why"

Full Reply:
"When one of your services goes down at 3am and you have no idea why—
that's where people realize they need observability, not more tools. 
That gap between 'it's down' and 'here's what broke' is everything."
```

### Pain Point: AWS Bill Shock
```
Hook: "The $400 AWS bill for a side project"

Full Reply:
"That's usually a single resource at scale (database auto-scaling, or data transfer).
Worth 10 minutes to find it now, because next month will be identical."
```

### Pain Point: Deployment Failure
```
Hook: "Deploy script broke prod. Rollback is also broken."

Full Reply:
"Rollback is insurance. If you can't roll back in 30 seconds,
your deploy system isn't protecting you—that's the real problem to fix."
```

### Pain Point: Monitoring Failed
```
Hook: "Monitoring said everything was fine. Users reported outage 30 min later."

Full Reply:
"That's monitoring catching symptoms, not causes.
Real monitoring should show the problem before users see it."
```

---

## Brand Building Templates (Trends)

### Template A: Pure Value
**No mention of mttrly. No link.**

```
Hook: "Built entire product in 30 mins with Cursor, deployed to Vercel"

Full Reply:
"Vibe coding is real. The gap between 'I have an idea' and 'it's live' just closed.
Most of that gap was infrastructure anxiety—that's finally not the blocker."
```

### Template B: Question
**Engage conversation without selling.**

```
Hook: "Leaving Vercel because of the $300/month bill"

Full Reply:
"What's the simplest hosting you've found that doesn't hide the infrastructure?
That's the moment when people realize their platform's convenience has a price."
```

### Template C: Value + Soft Mention
**ONLY use when:**
- `likes >= 5` AND `views >= 500` (high engagement)
- Strong value first, mention second
- Max 40% of brand-building replies use this template

```
Hook: "Heroku shutdown was depressing. What's the new simple deployment?"

Full Reply:
"Heroku wasn't simple—it was hiding complexity. When it disappeared,
people realized they'd outsourced operational knowledge, not work.
That's exactly the problem mttrly solves: simplicity without hiding."
```

---

## Tone Rules

**DO:**
- ✅ Confident (you've seen this 100 times before)
- ✅ Specific (cite details, not general observations)
- ✅ Empathetic first (validate their pain)
- ✅ Short (especially fire-patrol, people are stressed)
- ✅ Honest (share what actually works)

**DON'T:**
- ❌ Generic ("I feel this", "Spot on")
- ❌ Sales pitch ("Try mttrly", "Check us out")
- ❌ Corporate speak ("We're excited to...", "Best-in-class")
- ❌ Fake engagement ("Love this!", "Great question!")
- ❌ Contrarian for clicks ("I'd push back slightly...")

---

## Examples of Good Replies (Real)

### Fire Patrol: Server Down
**Tweet:** "production server just went down, 2am, no idea why"

**Reply:**
"The worst part isn't downtime—it's not knowing why.
That gap between 'it's down' and 'here's what broke' is where you panic.
Good observability closes that gap fast."

**Why it works:**
- ✅ Hooks on "no idea why" (specific detail)
- ✅ Empathy without judgment
- ✅ Actionable insight (observability solves the gap)
- ✅ No link, pure help (fire-patrol rule)

### Brand Building: Vibe Coding
**Tweet:** "built entire product in 30 mins with cursor, nobody told me it would be this easy"

**Reply:**
"Vibe coding is real. The gap closed between 'I have an idea' and 'it's live'.
Most of that gap was infrastructure anxiety—that's finally not the blocker anymore."

**Why it works:**
- ✅ Hooks on "built in 30 mins" (validates achievement)
- ✅ Affirms their discovery (you're on a real trend)
- ✅ Broader insight (infrastructure anxiety is the real blocker)
- ✅ No link (community conversation, not promo)

---

## Examples of BAD Replies (to Avoid)

### ❌ Generic Opening
**Bad:** "I feel this. Happened to us at 3am last week. The only cure is better observability..."
- Problem: "I feel this" is bot-like, doesn't prove you read the specific tweet

### ❌ Link on Low-Reach Tweet
**Bad:** Replies to tweet with 17 likes: "That's why we built mttrly. Check us out..."
- Problem: 17 views = nobody sees your reply anyway
- Solution: No link, just value

### ❌ Contrarian from Small Account
**Bad:** Small account replying to @levelsio: "I'd push back slightly on that..."
- Problem: Presumptuous, looks like attention-seeking
- Solution: Only use Template C on high-engagement or stick to agreement

---

**Template Version:** 2.0 (Hook First + Mode-Aware)  
**Calibration:** Based on analysis of 238 real mttrly replies
