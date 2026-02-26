#!/usr/bin/env node

/**
 * x-evening-digest.js
 * 
 * Парсит 4 JSON файла от bird-digest.sh, фильтрует, ранжирует, генерирует твиты
 * Usage: node x-evening-digest.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const TRACKING_FILE = path.join(DATA_DIR, 'x-engagement-tracking.md');
const PACKS_DIR = path.join(__dirname, '../../daily-packs');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(PACKS_DIR)) fs.mkdirSync(PACKS_DIR, { recursive: true });

// Ensure tracking file exists
if (!fs.existsSync(TRACKING_FILE)) {
  fs.writeFileSync(TRACKING_FILE, '# X Engagement Tracking\n\n## Replied To\n(none yet)\n\n## Skipped\n(none yet)\n');
}

// Read tracking file
const tracking = fs.readFileSync(TRACKING_FILE, 'utf8');
const repliedIds = new Set();
const skippedIds = new Set();

tracking.split('\n').forEach(line => {
  const match = line.match(/^- (\d+)/);
  if (match) {
    if (tracking.includes('## Replied To') && line.startsWith('- ')) {
      repliedIds.add(match[1]);
    }
  }
});

// === FILTERS ===

function isEnglish(text) {
  // Simple heuristic: mostly ASCII + common English words
  const ascii = text.match(/[a-zA-Z0-9\s.,!?'""-]/g) || [];
  return ascii.length / text.length > 0.7;
}

function isBot(author) {
  const botKeywords = ['bot', 'automated', 'automatic', 'script', 'crawl', 'scraper'];
  const name = (author.name || '').toLowerCase();
  const username = (author.username || '').toLowerCase();
  return botKeywords.some(k => name.includes(k) || username.includes(k));
}

function isPromo(text) {
  const promoKeywords = ['buy now', 'click here', 'sign up', 'get started', 'limited offer', 'promo code', 'coupon', 'discount', 'save now'];
  const lower = text.toLowerCase();
  return promoKeywords.some(k => lower.includes(k));
}

function isNoise(text) {
  // Filter out off-topic domains
  const noiseKeywords = [
    'ransomware', 'crypto', 'bitcoin', 'ethereum', 'nft', 'trading bot', 'trading signal',
    'interior design', 'gym', 'fitness', 'real estate', 'property',
    'onlyfans', 'adult', 'porn',
    'indian railway', 'railway station', 'bank failure', 'upi transaction', 'indusind',
    'victim incident response', 'law enforcement', 'regulatory scrutiny', 'cointelegraph'
  ];
  const lower = text.toLowerCase();
  return noiseKeywords.some(k => lower.includes(k));
}

function filterTweet(tweet, category = 'general') {
  // Already replied
  if (repliedIds.has(tweet.id)) return { skip: true, reason: 'already_replied' };
  
  // Is bot
  if (isBot(tweet.author)) return { skip: true, reason: 'is_bot' };
  
  // Not English
  if (!isEnglish(tweet.text)) return { skip: true, reason: 'not_english' };
  
  // Promo content
  if (isPromo(tweet.text)) return { skip: true, reason: 'is_promo' };
  
  // Off-topic noise
  if (isNoise(tweet.text)) return { skip: true, reason: 'is_noise' };
  
  // Don't reply to competitors or platforms
  const competitors = ['railway', 'vercel', 'render', 'heroku', 'netlify', 'fly.io'];
  const author = tweet.author.username.toLowerCase();
  if (competitors.includes(author)) return { skip: true, reason: 'is_competitor' };
  
  // Engagement threshold (varies by category)
  const minLikes = category === 'pain_point' ? 3 : 5;
  if (tweet.likeCount < minLikes) return { skip: true, reason: 'low_engagement' };
  
  // Check age (48-72 hours for expanded window)
  const tweetTime = new Date(tweet.createdAt).getTime();
  const now = Date.now();
  const ageHours = (now - tweetTime) / (1000 * 60 * 60);
  if (ageHours > 72) return { skip: true, reason: 'too_old' };
  
  // NOTE: Replies are now INCLUDED (not filtered out)
  
  return { skip: false };
}

function getCategory(tweet) {
  const text = tweet.text.toLowerCase();
  const author = tweet.author.username.toLowerCase();
  
  // Authority replies (TheConfigGuy, fluxdiv, etc) → pain_point priority
  const authorities = ['theconfigguy', 'fluxdiv', 'kelseyhightower', 'rakyll', 'copyconstruct', 'jezhumble', 'allspaw'];
  if (tweet.inReplyToStatusId && authorities.some(a => text.includes(a) || author === a)) {
    return 'pain_point';
  }
  
  // Audience signals (CHECK FIRST — more specific)
  const audienceKeywords = ['indie', 'solo', 'founder', 'vibe', 'learn', 'first', 'deploy', 'afraid', 'anxious', 'scared', 'zero cs', 'zero degree', 'master electrician'];
  if (audienceKeywords.some(k => text.includes(k))) return 'audience';
  
  // Pain points (CHECK SECOND — but exclude "production" unless in context of incident/alert)
  const painKeywords = ['crash', 'down', 'incident', 'alert', 'failed', 'error', 'nginx', '502', 'deployment failed', 'rollback', '3am', 'on-call', 'pager'];
  if (painKeywords.some(k => text.includes(k))) return 'pain_point';
  
  // Competitor mentions
  const competitorKeywords = ['vercel', 'railway', 'render', 'heroku', 'expensive', 'pricing', 'too complex', 'overkill'];
  if (competitorKeywords.some(k => text.includes(k))) return 'competitor';
  
  return 'monitoring';
}

function scoreRelevance(tweet, category) {
  let score = 0;
  
  // Engagement (normalized for lower like counts now)
  score += Math.min(tweet.likeCount / 20, 3); // max 3 points (was /50, now /20 for 3+ likes)
  
  // Freshness (within 72h window)
  const ageHours = (Date.now() - new Date(tweet.createdAt).getTime()) / (1000 * 60 * 60);
  const freshness = Math.max(2 - ageHours / 36, 0); // 2 points for <24h, declining to 0 at 72h
  score += freshness;
  
  // Reply bonus (domain expert replies are gold)
  if (tweet.inReplyToStatusId) {
    score += 1; // +1 point if it's a reply (expertise signal)
  }
  
  // Category weight
  const weights = { pain_point: 3, audience: 2, competitor: 1.5, monitoring: 0.8 };
  score *= weights[category] || 1;
  
  return Math.round(score * 100) / 100;
}

// === PARSE ALL FILES ===

const allTweets = [];

['pain_points.json', 'audience_signals.json', 'competitors.json', 'watchlist.json'].forEach(file => {
  const filePath = `/tmp/${file}`;
  if (!fs.existsSync(filePath)) return;
  
  try {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    
    // bird returns multiple JSON arrays. Split them and parse each.
    const arrays = content.split(/\]\s*\[/);
    
    arrays.forEach((chunk, i) => {
      let json = chunk;
      if (i > 0) json = '[' + json;
      if (i < arrays.length - 1) json = json + ']';
      
      try {
        const data = JSON.parse(json);
        if (Array.isArray(data)) {
          allTweets.push(...data.filter(t => t && t.id));
        }
      } catch (e) {
        // Skip unparseable chunks
      }
    });
  } catch (e) {
    console.error(`Error parsing ${file}:`, e.message);
  }
});

console.log(`📊 Total tweets collected: ${allTweets.length}`);

// === CATEGORIZE FIRST (to determine engagement threshold) ===

const categorized = allTweets.map(tweet => ({
  ...tweet,
  category: getCategory(tweet)
}));

// === FILTER ===

const filtered = [];
const skipped = [];

categorized.forEach(tweet => {
  const result = filterTweet(tweet, tweet.category);
  if (result.skip) {
    skipped.push({ id: tweet.id, reason: result.reason, author: tweet.author.username });
  } else {
    const score = scoreRelevance(tweet, tweet.category);
    filtered.push({ ...tweet, score });
  }
});

console.log(`✅ Passed filters: ${filtered.length}`);
console.log(`❌ Skipped: ${skipped.length}`);

// === RANK ===

filtered.sort((a, b) => b.score - a.score);

const hot = filtered.filter(t => t.category === 'pain_point').slice(0, 3);
const good = filtered.filter(t => t.category === 'audience').slice(0, 3);
const monitoring = filtered.filter(t => t.category === 'competitor' || t.category === 'monitoring').slice(0, 3);

console.log(`\n🔥 HOT (pain points): ${hot.length}`);
console.log(`👍 GOOD (audience): ${good.length}`);
console.log(`📈 MONITORING: ${monitoring.length}`);

// === GENERATE REPLY SAMPLES (NEW LOGIC WITH HOOK FIRST) ===

function selectTemplate(tweet) {
  // Estimate views (rough heuristic: likes * 5-10)
  const estimatedViews = tweet.likeCount * 7;
  
  // Template A: Pure Value (< 500 views OR all audience signals)
  if (estimatedViews < 500 || tweet.category === 'audience') {
    return 'A';
  }
  
  // Template B: Question (500+ views, but not pain_point)
  if (estimatedViews >= 500 && tweet.category !== 'pain_point') {
    return 'B';
  }
  
  // Template C: Value + Optional Mention (500+ views + pain_point)
  if (estimatedViews >= 500 && tweet.category === 'pain_point') {
    return 'C';
  }
  
  return 'A'; // Default
}

function generateReply(tweet) {
  const text = tweet.text.toLowerCase();
  const template = selectTemplate(tweet);
  const estimatedViews = tweet.likeCount * 7;
  
  // ===== TEMPLATE A: PURE VALUE (Hook First) =====
  if (template === 'A') {
    if (tweet.category === 'pain_point') {
      // Pain point hooks - specific details first
      if (text.includes('$30') || text.includes('cheap') || text.includes('stack')) {
        return `The $30 stack works until one service goes down and you have no idea what broke. That's when people realize cheap isn't the problem—observability is.`;
      }
      if (text.includes('predatory') || text.includes('overage') || text.includes('charges')) {
        return `The overage charges are the killer. People start free, hit $300+ bill, then realize they built on quicksand. The problem isn't price—it's surprise bills.`;
      }
      if (text.includes('3am') || text.includes('alert') || text.includes('incident')) {
        return `When one of your services goes down at 3am and you have no idea what broke—that's where people realize they need observability, not more tools.`;
      }
      if (text.includes('deploy') || text.includes('production')) {
        return `The gap between "works on my machine" and "works in production" is where non-technical founders get stuck. Most people never cross it.`;
      }
      if (text.includes('rollback') || text.includes('incident response')) {
        return `The real question isn't how fast you deploy. It's how fast you can roll back when something breaks. That's what buys you sleep at night.`;
      }
    }
    
    if (tweet.category === 'audience') {
      // Audience hooks - learning/feeling
      // Check specific traits FIRST before generic founder checks
      if (text.includes('zero') || text.includes('master electrician') || text.includes('without') && text.includes('degree')) {
        return `Built a production app without CS background—that's impressive. The hard part wasn't building it, it's shipping and not panicking when something breaks in prod.`;
      }
      if (text.includes('solo') || text.includes('founder') || text.includes('indie')) {
        return `Solo founders shouldn't need to become DevOps experts. The infrastructure should be invisible—you focus on product, it handles itself.`;
      }
      if (text.includes('vibe') || text.includes('rapid') || text.includes('prototyp')) {
        return `The scary part isn't building fast with vibe coding. It's the deploy moment after. That's where most people hit the wall and stop.`;
      }
      if (text.includes('learn') || text.includes('first') || text.includes('start')) {
        return `The scary part isn't learning deployment. It's the moment you realize your first deploy is literally just one command. Everything else is overthinking.`;
      }
      if (text.includes('afraid') || text.includes('fear') || text.includes('anxiety')) {
        return `That fear is real. The cure isn't more knowledge—it's faster feedback. Deploy often, fail safely, iterate. Then it stops being scary.`;
      }
    }
    
    if (tweet.category === 'competitor') {
      // Competitor hooks
      if (text.includes('expensive') || text.includes('pricing') || text.includes('cost') || text.includes('$300')) {
        return `Platforms get expensive when they try to be everything for everyone. What you actually need is simpler and cheaper.`;
      }
      if (text.includes('heroku') || text.includes('vercel') || text.includes('railway') || text.includes('render')) {
        return `Those platforms are optimized for VC-backed startups with scaling problems. Indie makers have different problems to solve.`;
      }
      if (text.includes('complex') || text.includes('kubernetes') || text.includes('overkill')) {
        return `Most platforms are over-engineered for what you actually need. The real problem isn't features—it's simplicity.`;
      }
    }
    
    // Generic Template A fallback (shouldn't reach here if hooks are good)
    return `The real problem isn't the tool. It's that most tools solve the wrong part of the equation.`;
  }
  
  // ===== TEMPLATE B: QUESTION (Hook First + Inquiry) =====
  if (template === 'B') {
    if (text.includes('deploy')) {
      return `What's your observability setup for this? That's usually where people hit the wall—not knowing what broke until users complain.`;
    }
    if (text.includes('scale')) {
      return `At what point did it become painful? That's when you realize you need something that scales with you, not against you.`;
    }
    if (text.includes('infrastructure') || text.includes('infra')) {
      return `How much of your time goes to infrastructure vs product? That ratio tells you everything about your tooling.`;
    }
    
    return `What was the moment when you realized X wasn't going to work anymore?`;
  }
  
  // ===== TEMPLATE C: VALUE + SOFT MENTION (Hook First, Optional Link) =====
  if (template === 'C') {
    const mentionMttrly = Math.random() < 0.4; // 40% of high-engagement replies mention mttrly
    
    if (text.includes('expensive') || text.includes('overcharge') || text.includes('predatory')) {
      const base = `The overage charges are the killer. People start free, hit a $300 bill out of nowhere, then realize they built on quicksand.`;
      return mentionMttrly ? `${base} That's exactly why we built mttrly—platform with predictable costs.` : base;
    }
    
    if (text.includes('deploy') && text.includes('fear')) {
      const base = `The real issue isn't deploying—it's not being able to roll back fast if it breaks. Speed isn't about deployment, it's about recovery.`;
      return mentionMttrly ? `${base} We built mttrly around that single principle.` : base;
    }
    
    if (text.includes('3am') || text.includes('incident') || text.includes('production')) {
      const base = `3am incidents happen because deploy process is slow, rollback is slower. Fix that one thing and everything changes.`;
      return mentionMttrly ? `${base} That's literally what mttrly solves.` : base;
    }
    
    const base = `The pattern here is: people underestimate infrastructure until it breaks in production. Then suddenly they need reliability.`;
    return mentionMttrly ? `${base} That's the moment they realize they need mttrly.` : base;
  }
  
  return null;
}

// === OUTPUT ===

const output = {
  timestamp: new Date().toISOString(),
  mode: 'evening',
  stats: {
    collected: allTweets.length,
    passed_filters: filtered.length,
    skipped: skipped.length
  },
  categories: {
    hot: hot.map(t => ({
      id: t.id,
      author: t.author.username,
      text: t.text.substring(0, 100) + '...',
      likes: t.likeCount,
      score: t.score,
      reply: generateReply(t),
      url: `https://x.com/${t.author.username}/status/${t.id}`
    })),
    good: good.map(t => ({
      id: t.id,
      author: t.author.username,
      text: t.text.substring(0, 100) + '...',
      likes: t.likeCount,
      score: t.score,
      reply: generateReply(t),
      url: `https://x.com/${t.author.username}/status/${t.id}`
    })),
    monitoring: monitoring.map(t => ({
      id: t.id,
      author: t.author.username,
      text: t.text.substring(0, 100) + '...',
      likes: t.likeCount,
      score: t.score,
      reply: generateReply(t),
      url: `https://x.com/${t.author.username}/status/${t.id}`
    }))
  }
};

const digestFile = path.join(PACKS_DIR, `evening-${new Date().toISOString().split('T')[0]}-digest.json`);
fs.writeFileSync(digestFile, JSON.stringify(output, null, 2));

console.log(`\n✅ Digest saved to ${digestFile}`);
console.log(`\n${'='.repeat(80)}`);
console.log(`🔗 ИТОГИ ВЕЧЕРНЕГО ПРОГОНА — TOP PICKS FOR REPLY`);
console.log(`${'='.repeat(80)}\n`);

console.log(`📊 СТАТИСТИКА:`);
console.log(`   Собрано твитов: ${allTweets.length}`);
console.log(`   Прошло фильтры: ${filtered.length} (${Math.round(filtered.length/allTweets.length*100)}%)`);
console.log(`   Отсеяно: ${skipped.length}`);
console.log(`   ├─ 🔥 ГОРЯЧЕЕ (pain points): ${hot.length}`);
console.log(`   ├─ 👍 ХОРОШЕЕ (audience): ${good.length}`);
console.log(`   └─ 📈 МОНИТОРИНГ (other): ${monitoring.length}\n`);

const allPicks = [...hot, ...good, ...monitoring].slice(0, 5);

allPicks.forEach((t, i) => {
  const author = typeof t.author === 'string' ? t.author : (t.author?.username || 'unknown');
  const category = t.category === 'pain_point' ? '🔥 ГОРЯЧЕЕ' : t.category === 'audience' ? '👍 ХОРОШЕЕ' : '📈 МОНИТОРИНГ';
  const estimatedViews = t.likeCount * 7;
  const template = selectTemplate(t);
  
  let templateDesc = '';
  if (template === 'A') templateDesc = '📝 Template A (Pure Value)';
  else if (template === 'B') templateDesc = '❓ Template B (Question)';
  else if (template === 'C') templateDesc = '💬 Template C (Value + Optional Mention)';
  
  console.log(`\n${i+1}. ${category} — @${author}`);
  console.log(`   Score: ${t.score} | Likes: ${t.likeCount} | Est. Views: ~${estimatedViews}`);
  console.log(`   Age: ${Math.round((Date.now() - new Date(t.createdAt).getTime()) / (1000*60*60))}h | Replies: ${t.replyCount}`);
  console.log(`   ${templateDesc}`);
  console.log(`\n   📝 ТВИТ:`);
  console.log(`   "${t.text.substring(0, 150)}${t.text.length > 150 ? '...' : ''}"`);
  console.log(`\n   💬 REPLY SUGGESTION:`);
  console.log(`   "${generateReply(t)}"`);
  console.log(`\n   🔗 ССЫЛКА:`);
  console.log(`   https://x.com/${author}/status/${t.id}\n`);
  console.log(`   Контекст: ${t.inReplyToStatusId ? '↩️  Это reply к другому твиту (domain expert insight)' : '📌 Оригинальный твит'}`);
  console.log(`   ${'─'.repeat(76)}`);
});

console.log(`\n✅ Полный дайджест сохранён: ${digestFile}`);
console.log(`\n📋 ГОТОВ К АНАЛИЗУ (не постим, только проверяем качество реплаев).\n`);
