/**
 * X/Twitter Search + Reply Generation (bird CLI version)
 * 
 * Pipeline:
 * 1. Run bird-digest.sh (collect tweets from 4 categories)
 * 2. Parse JSON outputs from /tmp/*.json
 * 3. Filter (engagement, language, age, bots, originals only)
 * 4. Check tracking file (no duplicates)
 * 5. Rank: ГОРЯЧЕЕ (pain+high) → ХОРОШЕЕ (audience) → МОНИТОРИНГ
 * 6. Generate replies (empathy → value → soft mention)
 * 7. Format digest (Telegram)
 * 8. Send to Telegram
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIG
// ============================================================================

const CONFIG = {
  dataDir: '/home/openclaw/.openclaw/workspace/data',
  trackingFile: '/home/openclaw/.openclaw/workspace/data/x-engagement-tracking.md',
  digestDir: '/home/openclaw/.openclaw/workspace/daily-packs',
  
  // Filters
  minEngagement: 10,
  minFollowers: 500,
  maxFollowers: 50000,
  
  // Watchlist (high priority)
  watchlist: [
    'levelsio', 'kelseyhightower', 'rakyll', 'copyconstruct',
    'jezhumble', 'allspaw', 'marclouvier', 'tdinh_me',
    'DanielFosworthy', 'yaboroda', 'railway', 'vercel', 'render'
  ]
};

// ============================================================================
// UTILITIES
// ============================================================================

function isBot(author) {
  if (!author) return true;
  const username = typeof author === 'string' ? author : (author.username || '');
  const name = typeof author === 'string' ? '' : (author.name || '');
  if (username && /^[a-z]{14,}$/.test(username)) return true;
  if (/bot|news|feed|api|alert|monitor/i.test(name)) return true;
  return false;
}

function isEnglish(text) {
  if (!text) return false;
  const words = text.split(/\s+/);
  let englishCount = 0;
  words.forEach(w => {
    if (/^[a-zA-Z]+$/.test(w)) englishCount++;
  });
  return englishCount / words.length > 0.5;
}

function isAlreadyTracked(tweetId, trackingFile) {
  if (!fs.existsSync(trackingFile)) return false;
  const content = fs.readFileSync(trackingFile, 'utf8');
  return content.includes(tweetId);
}

function getPriority(tweet, category, watchlist) {
  let priority = 'МОНИТОРИНГ';
  let score = 0;
  
  const engagement = (tweet.public_metrics?.like_count || tweet.likeCount || 0) +
                    (tweet.public_metrics?.reply_count || tweet.replyCount || 0) +
                    (tweet.public_metrics?.retweet_count || tweet.retweetCount || 0);
  
  const username = tweet.username || tweet.author?.username || '';
  const isWatched = watchlist.some(w => 
    username?.toLowerCase?.() === w.toLowerCase()
  );
  
  // Pain point + высокий engagement = ГОРЯЧЕЕ
  if (category === 'pain_points' && engagement > 100) {
    priority = 'ГОРЯЧЕЕ';
    score = 100 + engagement;
  }
  // Watchlist = ГОРЯЧЕЕ
  else if (isWatched) {
    priority = 'ГОРЯЧЕЕ';
    score = 90;
  }
  // Audience + средний engagement = ХОРОШЕЕ
  else if (category === 'audience' && engagement > 20) {
    priority = 'ХОРОШЕЕ';
    score = 70 + engagement;
  }
  // Competitors = ХОРОШЕЕ
  else if (category === 'competitors' && engagement > 10) {
    priority = 'ХОРОШЕЕ';
    score = 60;
  }
  // Остальное = МОНИТОРИНГ
  else {
    priority = 'МОНИТОРИНГ';
    score = engagement;
  }
  
  return { priority, score };
}

function generateReply(text) {
  text = text || '';
  
  let safe = '';
  let punchy = '';
  
  if (text.includes('down') || text.includes('crash') || text.includes('alert')) {
    safe = 'Been there. Quick triage: check process (ps aux), disk (df -h), memory (free -m). 90% of crashes are one of those. Logs next.';
    punchy = 'Always the same three. Always. Process, disk, memory.';
  }
  else if (text.includes('deploy') || text.includes('push') || text.includes('deployment')) {
    safe = 'Simplest that works: deploy.sh with git pull → build → restart → health check. Auto-rollback on fail. 30 min setup, saves hours/week.';
    punchy = 'Manual deploys at 2am never good. Automate critical path, keep rest manual.';
  }
  else if (text.includes('server') || text.includes('VPS') || text.includes('manage')) {
    safe = 'Starting simple: systemd units + journalctl for logs + basic monitoring (top, df, netstat). Beats manual SSH into prod.';
    punchy = 'Server management without observability = flying blind.';
  }
  else if (text.includes('nginx') || text.includes('502') || text.includes('gateway')) {
    safe = 'nginx -t catches most config issues. For the rest: tail -f /var/log/nginx/error.log while testing. Usually missing semicolon or wrong root.';
    punchy = 'nginx errors obvious in logs, impossible in file. Always check logs first.';
  }
  else if (text.includes('vercel') || text.includes('railway') || text.includes('render')) {
    safe = 'Each has tradeoffs. Vercel fast but opinionated. Railway simpler. Render good middle ground. What matters: deploys work, logs readable, debugging possible.';
    punchy = 'PaaS tradeoff: convenience vs control. Know what you\'re trading.';
  }
  else {
    safe = 'This. The gap between problem and solution is where most ops pain lives.';
    punchy = 'Yep. And somehow still surprises people.';
  }
  
  return { safe, punchy };
}

function formatDigest(tweets) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU');
  
  let digest = `🎯 **Твиттер-дайджест mttrly** — ${dateStr}\n\n`;
  
  const byPriority = {
    'ГОРЯЧЕЕ': tweets.filter(t => t.priority === 'ГОРЯЧЕЕ'),
    'ХОРОШЕЕ': tweets.filter(t => t.priority === 'ХОРОШЕЕ'),
    'МОНИТОРИНГ': tweets.filter(t => t.priority === 'МОНИТОРИНГ')
  };
  
  // ГОРЯЧЕЕ
  if (byPriority['ГОРЯЧЕЕ'].length > 0) {
    digest += '🔥 **ГОРЯЧЕЕ** (ответь в первую очередь):\n\n';
    byPriority['ГОРЯЧЕЕ'].slice(0, 3).forEach((t, i) => {
      const engagement = (t.public_metrics?.like_count || 0) + 
                        (t.public_metrics?.reply_count || 0);
      digest += `${i+1}. @${t.username || t.author_id} — ${engagement}❤️\n`;
      digest += `_"${t.text?.substring(0, 80)}..."_\n`;
      digest += `💬 ${t.replies?.safe || ''}\n`;
      digest += `🔗 https://x.com/${t.username}/status/${t.id}\n\n`;
    });
  }
  
  // ХОРОШЕЕ
  if (byPriority['ХОРОШЕЕ'].length > 0) {
    digest += '\n✅ **ХОРОШЕЕ** (если есть время):\n\n';
    byPriority['ХОРОШЕЕ'].slice(0, 2).forEach((t, i) => {
      const engagement = (t.public_metrics?.like_count || 0);
      digest += `${i+1}. @${t.username || t.author_id} — ${engagement}❤️\n`;
      digest += `_"${t.text?.substring(0, 80)}..."_\n`;
      digest += `🔗 https://x.com/${t.username}/status/${t.id}\n\n`;
    });
  }
  
  // МОНИТОРИНГ (сокращенно)
  if (byPriority['МОНИТОРИНГ'].length > 0) {
    digest += '\n📊 **МОНИТОРИНГ** (для контекста):\n';
    byPriority['МОНИТОРИНГ'].slice(0, 3).forEach((t, i) => {
      digest += `${i+1}. @${t.username || t.author_id}\n`;
    });
  }
  
  // Budget
  digest += '\n---\n💰 **Бюджет:** bird CLI (free) + x-smart-read (~$0.02/день)\n';
  
  return digest;
}

function trackTweet(tweetId, author, category, trackingFile) {
  let content = '';
  if (fs.existsSync(trackingFile)) {
    content = fs.readFileSync(trackingFile, 'utf8');
  }
  
  const timestamp = new Date().toISOString();
  const line = `- ${tweetId} — @${author} ${category} (${timestamp})\n`;
  
  if (!content.includes('## Replied To')) {
    content += '\n## Replied To\n';
  }
  
  content = content.replace('## Replied To\n', `## Replied To\n${line}`);
  fs.writeFileSync(trackingFile, content);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const mode = process.argv[2] || 'morning';
  console.log(`[X-SEARCH] Starting ${mode} engagement scan\n`);
  
  // Ensure directories exist
  [CONFIG.dataDir, CONFIG.digestDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
  
  // Run bird-digest.sh unless wrapper already collected
  if (process.env.SKIP_CRAWL === '1') {
    console.log('[BIRD] SKIP_CRAWL=1, using existing /tmp/bird_*.json');
  } else {
    console.log('[BIRD] Running collection script...');
    try {
      execSync(`bash playbooks/twitter/bird-digest.sh ${mode}`, {
        cwd: '/home/openclaw/.openclaw/workspace',
        stdio: 'inherit'
      });
    } catch (e) {
      console.error('[ERROR] bird-digest.sh failed:', e.message);
      process.exit(1);
    }
  }
  
  console.log('[PARSE] Reading bird outputs...\n');
  
  // Parse results from /tmp/*.json
  const allTweets = [];
  const jsonFiles = [
    '/tmp/bird_pain.json',
    '/tmp/bird_audience.json',
    '/tmp/bird_comp.json',
    '/tmp/bird_watch.json'
  ];
  
  const categoryMap = {
    '/tmp/bird_pain.json': 'pain_points',
    '/tmp/bird_audience.json': 'audience',
    '/tmp/bird_comp.json': 'competitors',
    '/tmp/bird_watch.json': 'watchlist'
  };
  
  jsonFiles.forEach(file => {
    if (fs.existsSync(file)) {
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        const tweets = Array.isArray(data) ? data : data.tweets || [];
        tweets.forEach(t => {
          t.category = categoryMap[file];
          allTweets.push(t);
        });
      } catch (e) {
        console.log(`⚠️  Failed to parse ${file}`);
      }
    }
  });
  
  console.log(`[FILTER] Collected ${allTweets.length} tweets\n`);
  
  // Filter
  const filtered = allTweets.filter(t => {
    // Already tracked
    if (isAlreadyTracked(t.id, CONFIG.trackingFile)) return false;
    
    // Not English
    if (!isEnglish(t.text)) return false;
    
    // Low engagement
    const engagement = (t.public_metrics?.like_count || t.likeCount || 0) + 
                      (t.public_metrics?.reply_count || t.replyCount || 0);
    if (engagement < CONFIG.minEngagement) return false;
    
    // Bot
    if (isBot(t.author || t.author_id || t.username)) return false;
    
    return true;
  });
  
  console.log(`[FILTERED] ${filtered.length} passed filters\n`);
  
  // Rank
  filtered.forEach(t => {
    const { priority, score } = getPriority(t, t.category, CONFIG.watchlist);
    t.priority = priority;
    t.score = score;
    
    const replies = generateReply(t.text);
    t.replies = replies;
  });
  
  filtered.sort((a, b) => b.score - a.score);
  
  // Display top 5
  console.log('[TOP 5]\n');
  filtered.slice(0, 5).forEach((t, i) => {
    console.log(`${i+1}. @${t.username || t.author?.username || t.author_id} [${t.priority}] ${t.score}`);
    console.log(`   "${t.text?.substring(0, 70)}..."\n`);
  });
  
  // Format digest
  const digest = formatDigest(filtered.slice(0, 10));
  
  // Save
  const digestFile = path.join(
    CONFIG.digestDir,
    `digest-${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}-${mode}.md`
  );
  
  fs.writeFileSync(digestFile, digest);
  console.log(`\n[SAVED] ${digestFile}`);
  console.log('[TELEGRAM] Ready to send digest');
  
  process.exit(0);
}

main().catch(e => {
  console.error('[FATAL]', e.message);
  process.exit(1);
});
