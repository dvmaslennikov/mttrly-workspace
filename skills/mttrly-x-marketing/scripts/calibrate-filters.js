#!/usr/bin/env node
/**
 * calibrate-filters.js — Run 20+ Twitter searches via bird CLI,
 * analyze results, and produce a calibration report.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const AUTH_TOKEN = process.env.AUTH_TOKEN || process.env.BIRD_AUTH_TOKEN;
const CT0 = process.env.CT0 || process.env.BIRD_CT0;

if (!AUTH_TOKEN || !CT0) {
  console.error('Missing AUTH_TOKEN or CT0');
  process.exit(1);
}

const RATE_SLEEP_MS = 2500;
const MAX_QUERIES = 40;
let queryCount = 0;
let rateLimited = false;

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* busy wait for sync */ }
}

function runSearch(query, n = 30) {
  if (rateLimited) return [];
  queryCount++;
  if (queryCount > MAX_QUERIES) {
    console.error(`  [SKIP] Max queries reached (${MAX_QUERIES})`);
    return [];
  }

  console.error(`  [${queryCount}] Searching: ${query} (n=${n})`);

  try {
    const cmd = `AUTH_TOKEN="${AUTH_TOKEN}" CT0="${CT0}" npx bird --plain search ${JSON.stringify(query)} -n ${n} --json 2>/dev/null`;
    const out = execSync(cmd, {
      cwd: '/home/openclaw/.openclaw/workspace',
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf8'
    });

    // Parse JSON - handle potential extra output
    const trimmed = out.trim();
    const startIdx = trimmed.indexOf('[');
    const endIdx = trimmed.lastIndexOf(']');
    if (startIdx === -1 || endIdx === -1) return [];
    const arr = JSON.parse(trimmed.slice(startIdx, endIdx + 1));
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    const msg = e.message || '';
    if (/429|rate.limit|too many/i.test(msg)) {
      console.error('  [STOP] Rate limited (429). Stopping all queries.');
      rateLimited = true;
      return [];
    }
    if (/401|403|unauthorized|forbidden|csrf/i.test(msg)) {
      console.error('  [STOP] Auth error. Cookies may be expired.');
      process.exit(90);
    }
    console.error(`  [WARN] Search failed: ${e.message?.slice(0, 100)}`);
    return [];
  } finally {
    if (!rateLimited) sleep(RATE_SLEEP_MS);
  }
}

function analyzeTweets(tweets) {
  const now = Date.now();
  let english = 0;
  let likes1 = 0, likes3 = 0, likes5 = 0, likes10 = 0;
  let replies = 0, originals = 0, rts = 0;
  let fresh12h = 0, fresh24h = 0, fresh48h = 0;
  let relevant = 0, junk = 0;

  const deployKeywords = /deploy|server|hosting|devops|infrastructure|vps|production|nginx|docker|kubernetes|k8s|ci\/cd|rollback|incident|outage|crash|down|hosting|heroku|vercel|railway|render|aws|digital.?ocean|fly\.io|cloud|backend|frontend.*deploy/i;
  const junkKeywords = /crypto|token|nft|blockchain|solana|bitcoin|ethereum|airdrop|giveaway|\$[A-Z]{2,}|IRCTC|Indian Railway|train delay|cricket|IPL|forex|trading bot/i;

  for (const t of tweets) {
    const text = t.text || '';
    const likes = t.likeCount || 0;
    const isReply = !!t.inReplyToStatusId;
    const isRT = text.startsWith('RT @');
    const createdAt = new Date(t.createdAt || 0).getTime();
    const ageMs = now - createdAt;
    const ageHours = ageMs / (1000 * 60 * 60);

    // Language detection: simple heuristic - mostly ASCII = English
    const asciiRatio = (text.replace(/[^\x00-\x7F]/g, '').length) / (text.length || 1);
    const isEnglish = asciiRatio > 0.7;
    if (isEnglish) english++;

    if (likes >= 1) likes1++;
    if (likes >= 3) likes3++;
    if (likes >= 5) likes5++;
    if (likes >= 10) likes10++;

    if (isRT) rts++;
    else if (isReply) replies++;
    else originals++;

    if (ageHours <= 12) fresh12h++;
    if (ageHours <= 24) fresh24h++;
    if (ageHours <= 48) fresh48h++;

    if (deployKeywords.test(text) && !junkKeywords.test(text)) relevant++;
    else if (junkKeywords.test(text)) junk++;
    else {
      // Neither clearly relevant nor junk - count as noise
      junk++;
    }
  }

  return {
    total: tweets.length,
    english,
    likes1, likes3, likes5, likes10,
    replies, originals, rts,
    fresh12h, fresh24h, fresh48h,
    relevant, junk
  };
}

function formatStats(label, stats) {
  return `### ${label}

| Metric | Count |
|---|---|
| Total results | ${stats.total} |
| English | ${stats.english} |
| Likes >= 1 | ${stats.likes1} |
| Likes >= 3 | ${stats.likes3} |
| Likes >= 5 | ${stats.likes5} |
| Likes >= 10 | ${stats.likes10} |
| Replies | ${stats.replies} |
| Originals | ${stats.originals} |
| Retweets | ${stats.rts} |
| Fresh < 12h | ${stats.fresh12h} |
| Fresh < 24h | ${stats.fresh24h} |
| Fresh < 48h | ${stats.fresh48h} |
| Relevant (deploy/server/hosting) | ${stats.relevant} |
| Junk (crypto/bots/off-topic) | ${stats.junk} |
`;
}

// ==================== QUERIES ====================

const categories = {
  pain_points: [
    { label: 'A1: deploy failed / broke', query: '"my deploy failed" OR "deployment broke" OR "deploy broke"' },
    { label: 'A2: server down / crashed', query: '"server went down" OR "my server crashed" OR "server is down"' },
    { label: 'A3: app slow / crashing', query: '"why is my app so slow" OR "app keeps crashing" OR "my app crashed"' },
    { label: 'A4: hours debugging deploy', query: '"spent hours debugging" deploy OR server OR hosting' },
    { label: 'A5: hate devops', query: '"hate devops" OR "devops is hard" OR "devops sucks"' },
    { label: 'A6: deployment hell', query: '"too complex to deploy" OR "deployment hell" OR "deploy is broken"' },
    { label: 'A7: prod down / incident', query: '"prod is down" OR "production incident" OR "deployment failed"' },
  ],
  audience: [
    { label: 'B1: vibe coding + ship', query: '"vibe coding" ship OR deploy OR launch OR built' },
    { label: 'B2: built with cursor/bolt', query: '"built with cursor" OR "built with bolt" OR "built with lovable" deploy OR hosting' },
    { label: 'B3: just shipped side project', query: '"just shipped" side project OR indie OR solo' },
    { label: 'B4: first deploy', query: '"first deploy" OR "deployed my first" OR "first time deploying"' },
    { label: 'B5: dont know devops', query: '"I don\'t know devops" OR "learning to deploy" OR "no devops experience"' },
    { label: 'B6: vibe coder broad', query: '"vibe coder" OR "#vibecoding" deploy OR server OR hosting' },
  ],
  competitors: [
    { label: 'C1: vercel expensive', query: '"vercel bill" OR "vercel cost" OR "vercel expensive" OR "vercel pricing"' },
    { label: 'C2: railway problems', query: '"railway app" slow OR down OR expensive OR broken -Indian -train -IRCTC -cricket' },
    { label: 'C3: render deploy issues', query: '"render deploy" slow OR failed OR timeout OR broken' },
    { label: 'C4: leaving heroku', query: '"moved from heroku" OR "leaving heroku" OR "heroku alternative" OR "heroku shutdown"' },
    { label: 'C5: cheap hosting', query: '"hosting for side project" OR "cheap hosting" OR "affordable hosting" developer' },
  ],
  broad_discovery: [
    { label: 'D1: need a server', query: '"need a server" OR "need hosting" don\'t know how OR help OR confused' },
    { label: 'D2: just want to ship', query: '"just want to ship" OR "just want to deploy" -hiring -job' },
    { label: 'D3: solo dev infra', query: '"solo developer" server OR infrastructure OR hosting OR deploy' },
    { label: 'D4: one person team', query: '"one person team" OR "one man team" deploy OR devops OR server' },
    { label: 'D5: k8s overkill', query: '"kubernetes overkill" OR "k8s too much" OR "docker is overkill" simple' },
  ],
};

// ==================== RUN ====================

console.error('=== Twitter Filter Calibration ===');
console.error(`Date: ${new Date().toISOString()}`);
console.error(`Total queries planned: ${Object.values(categories).flat().length}\n`);

const results = {};
const allRaw = {};

for (const [cat, queries] of Object.entries(categories)) {
  console.error(`\n--- Category: ${cat} ---`);
  results[cat] = [];

  for (const q of queries) {
    const tweets = runSearch(q.query, 30);
    const stats = analyzeTweets(tweets);
    results[cat].push({ ...q, stats, rawCount: tweets.length });
    allRaw[q.label] = tweets;

    if (rateLimited) break;
  }

  if (rateLimited) break;
}

// ==================== REPORT ====================

const date = new Date().toISOString().split('T')[0];
let report = `# Twitter Filter Calibration Report

**Date:** ${date}
**Total queries executed:** ${queryCount}
**Rate limited:** ${rateLimited ? 'YES' : 'No'}

---

## Raw Results by Category

`;

// Per-query stats
for (const [cat, items] of Object.entries(results)) {
  report += `## ${cat.toUpperCase()}\n\n`;
  for (const item of items) {
    report += formatStats(`Query: \`${item.query}\`\n**Label:** ${item.label}`, item.stats);
    report += '\n';
  }
}

// ==================== ANALYSIS ====================

report += `---

## Analysis

### Signal-to-Noise Ranking (best to worst)

`;

// Rank all queries by relevance ratio
const allQueries = Object.values(results).flat().map(r => ({
  label: r.label,
  query: r.query,
  total: r.stats.total,
  relevant: r.stats.relevant,
  junk: r.stats.junk,
  ratio: r.stats.total > 0 ? (r.stats.relevant / r.stats.total) : 0,
  english: r.stats.english,
  likes3: r.stats.likes3,
  likes5: r.stats.likes5,
  fresh24h: r.stats.fresh24h,
  originals: r.stats.originals,
}));

allQueries.sort((a, b) => b.ratio - a.ratio || b.relevant - a.relevant);

report += `| Rank | Label | Query | Total | Relevant | Junk | Signal % | Likes>=3 | Fresh<24h |
|---|---|---|---|---|---|---|---|---|\n`;

allQueries.forEach((q, i) => {
  report += `| ${i + 1} | ${q.label} | \`${q.query.slice(0, 60)}...\` | ${q.total} | ${q.relevant} | ${q.junk} | ${(q.ratio * 100).toFixed(0)}% | ${q.likes3} | ${q.fresh24h} |\n`;
});

// Like threshold analysis
report += `\n### Like Threshold Analysis\n\n`;
report += `| Threshold | Total tweets matching | Avg per query |\n|---|---|---|\n`;

const allTweets = Object.values(allRaw).flat();
const likeThresholds = [0, 1, 3, 5, 10, 20];
for (const thr of likeThresholds) {
  const count = allTweets.filter(t => (t.likeCount || 0) >= thr).length;
  report += `| >= ${thr} likes | ${count} | ${(count / Math.max(queryCount, 1)).toFixed(1)} |\n`;
}

// Freshness analysis
report += `\n### Freshness Analysis\n\n`;
report += `| Window | Total tweets | Avg per query |\n|---|---|---|\n`;

const now = Date.now();
const freshWindows = [
  { label: '< 8h', hours: 8 },
  { label: '< 12h', hours: 12 },
  { label: '< 24h', hours: 24 },
  { label: '< 48h', hours: 48 },
  { label: '< 72h', hours: 72 },
];

for (const w of freshWindows) {
  const count = allTweets.filter(t => {
    const age = (now - new Date(t.createdAt || 0).getTime()) / (1000 * 60 * 60);
    return age <= w.hours;
  }).length;
  report += `| ${w.label} | ${count} | ${(count / Math.max(queryCount, 1)).toFixed(1)} |\n`;
}

// Reply vs original analysis
report += `\n### Reply vs Original Analysis\n\n`;
const replyCount = allTweets.filter(t => !!t.inReplyToStatusId).length;
const rtCount = allTweets.filter(t => (t.text || '').startsWith('RT @')).length;
const origCount = allTweets.length - replyCount - rtCount;

report += `| Type | Count | % of total |\n|---|---|---|\n`;
report += `| Original posts | ${origCount} | ${((origCount / Math.max(allTweets.length, 1)) * 100).toFixed(0)}% |\n`;
report += `| Replies | ${replyCount} | ${((replyCount / Math.max(allTweets.length, 1)) * 100).toFixed(0)}% |\n`;
report += `| Retweets | ${rtCount} | ${((rtCount / Math.max(allTweets.length, 1)) * 100).toFixed(0)}% |\n`;

// Check relevant tweets in replies
const relevantReplies = allTweets.filter(t =>
  !!t.inReplyToStatusId &&
  /deploy|server|hosting|devops|infrastructure|vps|production|nginx|docker|kubernetes|k8s|ci\/cd|rollback|incident|outage|crash|down|hosting|heroku|vercel|railway|render|aws/i.test(t.text || '')
).length;
report += `\nRelevant tweets that are replies: ${relevantReplies} out of ${replyCount} total replies\n`;

// ==================== RECOMMENDATIONS ====================

report += `\n---\n\n## Recommendations\n\n`;

// Find best queries (signal > 30%)
const goodQueries = allQueries.filter(q => q.ratio >= 0.3 && q.total >= 3);
const badQueries = allQueries.filter(q => q.ratio < 0.15 || q.total === 0);
const midQueries = allQueries.filter(q => q.ratio >= 0.15 && q.ratio < 0.3 && q.total > 0);

report += `### 1. Query Quality\n\n`;
report += `**HIGH signal queries (>= 30% relevant):**\n`;
goodQueries.forEach(q => report += `- ${q.label}: ${(q.ratio * 100).toFixed(0)}% signal (${q.relevant}/${q.total})\n`);
report += `\n**MEDIUM signal queries (15-30% relevant):**\n`;
midQueries.forEach(q => report += `- ${q.label}: ${(q.ratio * 100).toFixed(0)}% signal (${q.relevant}/${q.total})\n`);
report += `\n**LOW/JUNK queries (< 15% relevant or empty):**\n`;
badQueries.forEach(q => report += `- ${q.label}: ${(q.ratio * 100).toFixed(0)}% signal (${q.relevant}/${q.total}) — REMOVE or rework\n`);

// Optimal like threshold
report += `\n### 2. Optimal Like Threshold\n\n`;
const relevantWithLikes = {};
for (const thr of likeThresholds) {
  const deployKw = /deploy|server|hosting|devops|infrastructure|vps|production|nginx|docker|kubernetes|k8s|ci\/cd|rollback|incident|outage|crash|down|hosting|heroku|vercel|railway|render|aws/i;
  const junkKw = /crypto|token|nft|blockchain|solana|bitcoin|ethereum|airdrop|giveaway|\$[A-Z]{2,}|IRCTC/i;
  const filtered = allTweets.filter(t => (t.likeCount || 0) >= thr && deployKw.test(t.text || '') && !junkKw.test(t.text || ''));
  relevantWithLikes[thr] = filtered.length;
  report += `- Likes >= ${thr}: ${filtered.length} relevant tweets\n`;
}
report += `\n**Recommendation:** Use likes >= ${relevantWithLikes[1] > 15 ? '1' : relevantWithLikes[3] > 10 ? '3' : '0'} for maximum coverage, likes >= ${relevantWithLikes[5] >= 5 ? '5' : '3'} for high quality.\n`;

// Optimal freshness
report += `\n### 3. Optimal Freshness Window\n\n`;
for (const w of freshWindows) {
  const deployKw = /deploy|server|hosting|devops|infrastructure|vps|production|nginx|docker|kubernetes|k8s|ci\/cd|rollback|incident|outage|crash|down|hosting|heroku|vercel|railway|render|aws/i;
  const junkKw = /crypto|token|nft|blockchain|solana|bitcoin|ethereum|airdrop|giveaway|\$[A-Z]{2,}|IRCTC/i;
  const count = allTweets.filter(t => {
    const age = (now - new Date(t.createdAt || 0).getTime()) / (1000 * 60 * 60);
    return age <= w.hours && deployKw.test(t.text || '') && !junkKw.test(t.text || '');
  }).length;
  report += `- ${w.label}: ${count} relevant tweets\n`;
}
report += `\n**Recommendation:** Use 48h window for morning scan, 24h for evening.\n`;

// Replies
report += `\n### 4. Include Replies?\n\n`;
report += `Replies: ${replyCount} total, ${relevantReplies} relevant.\n`;
report += `**Recommendation:** ${relevantReplies > replyCount * 0.2 ? 'YES, include replies — good signal in conversations.' : 'MAYBE — low signal in replies, consider filtering by likes.'}\n`;

// RT
report += `\n### 5. Include Retweets?\n\n`;
report += `RTs: ${rtCount} total.\n`;
report += `**Recommendation:** ${rtCount > allTweets.length * 0.1 ? 'FILTER OUT — too many RTs dilute signal.' : 'Can include — low RT volume.'}\n`;

// ==================== FINAL CONFIG ====================

report += `\n---\n\n## Final Recommended Config\n\n`;

for (const [cat, items] of Object.entries(results)) {
  const good = items.filter(i => i.stats.total > 0 && (i.stats.relevant / Math.max(i.stats.total, 1)) >= 0.15);
  report += `### CATEGORY: ${cat}\n\n`;
  report += `**QUERIES:**\n`;
  good.forEach(q => report += `- \`${q.query}\`\n`);
  if (good.length === 0) report += `- (no high-signal queries found, needs rework)\n`;
  report += `\n**FILTER:** likes >= ${cat === 'pain_points' ? '0' : '1'}, freshness <= ${cat === 'audience' ? '48' : '24'}h, include_replies: yes, exclude_RT: yes\n`;
  report += `**EXPECTED OUTPUT:** ~${good.reduce((sum, q) => sum + q.stats.relevant, 0)} tweets per scan\n\n`;
}

// ==================== SAMPLE TWEETS ====================

report += `\n---\n\n## Sample Relevant Tweets\n\n`;

const deployKw = /deploy|server|hosting|devops|infrastructure|vps|production|nginx|docker|kubernetes|k8s|ci\/cd|rollback|incident|outage|crash|down|hosting|heroku|vercel|railway|render|aws|digital.?ocean|fly\.io/i;
const junkKw = /crypto|token|nft|blockchain|solana|bitcoin|ethereum|airdrop|giveaway|\$[A-Z]{2,}|IRCTC|Indian Railway|train delay|cricket|IPL|forex|trading bot/i;

const relevantTweets = allTweets
  .filter(t => deployKw.test(t.text || '') && !junkKw.test(t.text || '') && (t.likeCount || 0) >= 1)
  .sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
  .slice(0, 20);

for (const t of relevantTweets) {
  report += `- **@${t.author?.username}** (${t.likeCount} likes, ${t.retweetCount} RTs): "${(t.text || '').slice(0, 200)}..."\n  ID: ${t.id}\n\n`;
}

// ==================== JUNK EXAMPLES ====================

report += `\n## Sample Junk Tweets (for exclusion pattern refinement)\n\n`;

const junkTweets = allTweets
  .filter(t => junkKw.test(t.text || ''))
  .slice(0, 10);

for (const t of junkTweets) {
  report += `- **@${t.author?.username}**: "${(t.text || '').slice(0, 150)}..."\n  Junk reason: ${(t.text || '').match(junkKw)?.[0] || 'pattern match'}\n\n`;
}

// ==================== WRITE FILE ====================

const outPath = `/home/openclaw/.openclaw/workspace/skills/mttrly-x-marketing/data/filter-calibration-${date}.md`;
fs.writeFileSync(outPath, report);
console.error(`\n=== Report saved to ${outPath} ===`);
console.log(outPath);
