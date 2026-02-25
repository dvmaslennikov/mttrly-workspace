# How To Run Twitter Ops

## Prerequisites Check

1. **Browser status:**
   ```javascript
   browser action=tabs profile=openclaw
   ```
   Must see: logged in as @mttrly_, home feed accessible

2. **Time check:**
   - Morning: 09:30 CET
   - Evening: 18:00 CET

---

## Running the Pass

### Step 1: Create collection script

Save to `/tmp/twitter_collect.js`:

```javascript
const { chromium } = require('/home/openclaw/openclaw/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18800');
  const page = browser.contexts()[0].pages()[0];
  
  console.log('[TWITTER PASS STARTED]\n');
  
  const queries = [
    'got paged 3am on-call',
    'production down incident',
    'deploy failed rollback',
    'works on my machine production',
    'postgres connection timeout',
    'monitoring alerting',
    'exposed api vulnerability',
    'pm2 crash restart',
    'systemd failed service'
  ];
  
  let allTweets = [];
  
  for (const query of queries) {
    console.log(`[${queries.indexOf(query)+1}/9] "${query}"`);
    
    try {
      await page.goto(`https://x.com/search?q=${encodeURIComponent(query)}&f=live`, 
        { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      
      await page.waitForTimeout(1500);
      
      for (let i = 0; i < 2; i++) {
        await page.evaluate(() => window.scrollBy(0, 600));
        await page.waitForTimeout(400);
      }
      
      const tweets = await page.evaluate(() => {
        const results = [];
        const items = document.querySelectorAll('[data-testid="tweet"], [role="article"], [data-testid="cellInnerDiv"]');
        
        items.forEach((item, idx) => {
          if (idx >= 8) return;
          
          try {
            const textEl = item.querySelector('[data-testid="tweetText"]') || item.querySelector('[lang]');
            const text = textEl?.textContent?.trim() || '';
            if (!text || text.length < 20) return;
            
            let author = 'unknown';
            const authorLink = item.querySelector('a[href*="/"]');
            if (authorLink) {
              const href = authorLink.getAttribute('href');
              const match = href.match(/\/([a-zA-Z0-9_]+)/);
              if (match) author = match[1];
            }
            
            let url = 'unknown';
            const statusLink = item.querySelector('a[href*="/status/"]');
            if (statusLink) {
              const href = statusLink.getAttribute('href');
              url = 'https://x.com' + href;
            }
            
            let likes = 0, replies = 0, retweets = 0;
            const buttons = item.querySelectorAll('[role="button"]');
            for (const btn of buttons) {
              const label = btn.getAttribute('aria-label') || '';
              const num = parseInt(label.match(/\d+/)?.[0] || 0);
              if (label.includes('Like')) likes = num;
              else if (label.includes('Reply') || label.includes('reply')) replies = num;
              else if (label.includes('Retweet') || label.includes('retweet')) retweets = num;
            }
            
            if (likes + replies + retweets === 0) return;
            
            results.push({
              author,
              text: text.substring(0, 280),
              likes,
              replies,
              retweets,
              engagement: likes + replies + retweets,
              url
            });
          } catch (e) {}
        });
        
        return results;
      });
      
      console.log(`  → ${tweets.length} found`);
      allTweets.push(...tweets);
      
    } catch (e) {
      console.log(`  [!] ${e.message.substring(0, 40)}`);
    }
  }
  
  // Dedupe
  const unique = [];
  const seen = new Set();
  allTweets.forEach(t => {
    if (!seen.has(t.url)) {
      unique.push(t);
      seen.add(t.url);
    }
  });
  
  console.log(`\nTotal: ${allTweets.length} | Unique: ${unique.length}\n`);
  
  // Score
  const scored = unique.map(t => {
    const rel = 3;
    const fresh = t.engagement > 100 ? 2 : 1;
    const reach = t.engagement > 500 ? 2 : t.engagement > 100 ? 1 : 0;
    const comp = t.replies < 20 ? 2 : 1;
    const tone = 1;
    
    return {
      ...t,
      score: rel + fresh + reach + comp + tone,
      type: t.retweets > t.replies ? 'repost' : 'reply'
    };
  }).sort((a, b) => b.score - a.score);
  
  console.log('[TOP 5]\n');
  scored.slice(0, 5).forEach((t, i) => {
    console.log(`${i+1}. @${t.author} [${t.score}/10]`);
    console.log(`   "${t.text.substring(0, 70)}..."`);
    console.log(`   ${t.engagement} engagement\n`);
  });
  
  // Save MD
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
  
  const md = \`# ☀️ Pass — \${now.toLocaleString('en-US', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })} CET

**Searched:** 9 intents  
**Collected:** \${allTweets.length}  
**Unique:** \${unique.length}  
**Top:** \${Math.min(5, scored.length)}

---

\${scored.slice(0, 5).map((t, i) => \`
## \${i+1}. @\${t.author} — Score: \${t.score}/10 — **\${t.type.toUpperCase()}**

**Tweet:**
\\\`\\\`\\\`
\${t.text}
\\\`\\\`\\\`

**Engagement:** \${t.engagement} (\${t.likes}❤️ \${t.replies}💬 \${t.retweets}🔄)

**URL:** \${t.url}

---

### Response Options:

\${t.type === 'reply' ? \`
**SAFE:**
\\\`\\\`\\\`
Real talk — been there. This pattern repeats.
\\\`\\\`\\\`

**PUNCHY:**
\\\`\\\`\\\`
Yeah, and somehow it still surprises people. Every. Time.
\\\`\\\`\\\`
\` : \`
**REPOST + comment:**

Option A: "Classic. Seen this twice this week."
Option B: "And production will teach this lesson again next month."
\`}

---
\`).join('\n')}

## Next Steps

Review above, approve which to post.

*Generated by Кло (Gilfoyle Mode)*
\`;

  const dir = '/home/openclaw/.openclaw/workspace/daily-packs';
  fs.mkdirSync(dir, { recursive: true });
  const filename = \`\${dir}/pass-\${dateStr}.md\`;
  fs.writeFileSync(filename, md);
  
  console.log(\`\n✅ Saved: \${filename}\n\`);
  
  process.exit(0);
})();
```

### Step 2: Run collection

```bash
cd /home/openclaw/.openclaw/workspace
timeout 150 node /tmp/twitter_collect.js 2>&1
```

Watch for:
- "→ X found" per query
- "Total: X | Unique: Y"
- "✅ Saved: ..."

### Step 3: Send results to Dima

Read the generated file:
```bash
read path=/home/openclaw/.openclaw/workspace/daily-packs/pass-YYYY-MM-DDTHH-MM-SS.md
```

Send content in message (use latest file).

### Step 4: Wait for approval

Dima will review and say:
- Which candidates to post
- What edits to make
- Or "skip this pass"

**NEVER post without explicit approval.**

---

## Troubleshooting

### Browser not working
```bash
# Check tabs
browser action=tabs profile=openclaw

# If empty or error:
sudo -u openclaw XDG_RUNTIME_DIR=/run/user/1000 systemctl --user restart openclaw-gateway.service
sleep 20
```

### No tweets found
- Check if selectors changed (Twitter updates DOM often)
- Try screenshot to debug:
  ```javascript
  browser action=screenshot targetId=<id>
  ```
- Verify login still valid

### Low quality results (non-dev tweets)
- Intents catch too much noise
- Consider adding dev/ops keyword filter in extraction
- Or manually curate from results

---

## Key Rules

1. **NEVER publish without Dima's approval**
2. **Check thread context** if needed (для будущих версий)
3. **Quality > quantity** — better 2 good than 5 mediocre
4. **Save everything** in daily-packs/ with timestamp
5. **Be honest** if results are bad/not relevant

---

## File naming convention

`daily-packs/pass-YYYY-MM-DDTHH-MM-SS.md` or `daily-packs/morning-YYYY-MM-DDTHH-MM-SS.md`

Keep for history/learning.
