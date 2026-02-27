#!/usr/bin/env node

/**
 * process-digest.js — v3
 *
 * Unified Twitter pipeline: Filter → Score → LLM Generate → Telegram
 *
 * Usage: node process-digest.js <candidates-file.json>
 *
 * v3 changes:
 * - 5 reply templates (A-E) with rotation rules
 * - Influencer tier scoring
 * - Author cooldown dedup (4 days)
 * - Product brief + competitive positioning in LLM prompt
 * - Quick-approve block in Telegram digest
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// ============================================================================
// CONFIG
// ============================================================================

const WORKSPACE_DIR = path.resolve(__dirname, '../../..');
const OPENCLAW_DIR = path.join(WORKSPACE_DIR, '..');
const OPENCLAW_CONFIG = path.join(OPENCLAW_DIR, 'openclaw.json');
const ALLOWFROM_CONFIG = path.join(OPENCLAW_DIR, 'credentials/telegram-default-allowFrom.json');
const DATA_DIR = path.join(WORKSPACE_DIR, 'data');
const PACKS_DIR = path.join(WORKSPACE_DIR, 'daily-packs');
const TRACKING_FILE = path.join(DATA_DIR, 'x-engagement-tracking.md');
const OPENCLAW_CLI = path.join(OPENCLAW_DIR, '..', 'openclaw', 'dist', 'entry.js');
const TOP_N = 5;

// Tracked influencers for scoring boost
const TRACKED_INFLUENCERS = {
  // Tier 1 — mega accounts (100K+ followers)
  'karpathy': 1, 'levelsio': 1, 'rauchg': 1, 'b0rk': 1,
  'noahkagan': 1, 'simonw': 1, 'marc_louvion': 1,
  // Tier 2 — strong domain experts (10K-100K)
  'mipsytipsy': 2, 'kelseyhightower': 2, 'swyx': 2,
  'jasoncrawford': 2, 'kiwicopple': 2, 'tabordasilva': 2, 'danshipper': 2,
  // Tier 3 — niche but relevant (5K-30K)
  'chaosengineerr': 3, 'robinebers': 3, 'piqsuite': 3,
  'diamondbishop': 3, '_baretto': 3
};

const AUTHOR_COOLDOWN_DAYS = 4;

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(PACKS_DIR)) fs.mkdirSync(PACKS_DIR, { recursive: true });

// ============================================================================
// LOAD CONFIG
// ============================================================================

function loadConfig() {
  const config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf8'));
  const botToken = config.channels?.telegram?.botToken;
  if (!botToken) {
    console.error('ERROR: No Telegram bot token in openclaw.json');
    process.exit(1);
  }

  let chatId = null;
  try {
    const allowFrom = JSON.parse(fs.readFileSync(ALLOWFROM_CONFIG, 'utf8'));
    // Format: { version: 1, allowFrom: ["59890423"] }
    const ids = allowFrom.allowFrom || allowFrom;
    if (Array.isArray(ids) && ids.length > 0) {
      chatId = String(ids[0]);
    }
  } catch (e) {
    console.error('WARN: Could not read allowFrom config:', e.message);
  }

  if (!chatId) {
    console.error('ERROR: No Telegram chat ID found');
    process.exit(1);
  }

  return { botToken, chatId };
}

// ============================================================================
// TRACKING (dedup with author cooldown)
// ============================================================================

function loadTracking() {
  if (!fs.existsSync(TRACKING_FILE)) {
    fs.writeFileSync(TRACKING_FILE, '# X Engagement Tracking\n\n## Replied To\n(none yet)\n\n## Skipped\n(none yet)\n');
  }
  const content = fs.readFileSync(TRACKING_FILE, 'utf8');
  const repliedIds = new Set();
  const authorHistory = {}; // { username: lastReplyDate }
  let inReplied = false;

  content.split('\n').forEach(line => {
    if (line.startsWith('## Replied To')) inReplied = true;
    else if (line.startsWith('## ')) inReplied = false;
    if (inReplied) {
      // New format: - 123456789 — @username topic (2026-02-27) — pain_point
      const match = line.match(/^- (\d+)\s*—\s*@(\S+)\s.*?\((\d{4}-\d{2}-\d{2})\)/);
      if (match) {
        repliedIds.add(match[1]);
        const username = match[2].toLowerCase();
        const dateStr = match[3];
        if (!authorHistory[username] || dateStr > authorHistory[username]) {
          authorHistory[username] = dateStr;
        }
      } else {
        // Fallback: old format (just ID)
        const oldMatch = line.match(/^- (\d+)/);
        if (oldMatch) repliedIds.add(oldMatch[1]);
      }
    }
  });

  return { repliedIds, authorHistory };
}

// ============================================================================
// HELPERS
// ============================================================================

function getInfluencerTier(username) {
  return TRACKED_INFLUENCERS[(username || '').toLowerCase()] || null;
}

function getPriority(score) {
  if (score >= 3.5) return 'HIGH';
  if (score >= 2.0) return 'MEDIUM';
  return 'LOW';
}

// ============================================================================
// FILTERS (ported from x-evening-digest.js — confirmed correct by owner)
// ============================================================================

function isEnglish(text) {
  const ascii = text.match(/[a-zA-Z0-9\s.,!?'""-]/g) || [];
  if (ascii.length / text.length <= 0.7) return false;

  // Secondary check: require common English words (catches Latin-script languages like Indonesian/Malay)
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  const commonEnglish = ['the', 'is', 'and', 'for', 'this', 'that', 'with', 'not', 'are', 'have',
    'was', 'but', 'you', 'your', 'can', 'will', 'from', 'just', 'been', 'when',
    'how', 'what', 'about', 'more', 'than', 'its', 'has', 'all', 'like', 'would'];
  const englishWordCount = words.filter(w => commonEnglish.includes(w)).length;
  const englishRatio = englishWordCount / Math.max(words.length, 1);

  // Need at least 10% common English words OR at least 3 common words in short tweets
  return englishRatio >= 0.10 || englishWordCount >= 3;
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
  const lower = text.toLowerCase();

  const noiseKeywords = [
    // Crypto / Web3 / DeFi
    'ransomware', 'crypto', 'bitcoin', 'ethereum', 'nft', 'trading bot', 'trading signal',
    'blockchain', 'web3', 'staking', 'tokenomics', 'dao', 'yield farm', 'liquidity pool',
    'defi', 'dex', 'airdrop', 'token sale', 'ico', 'ido', 'launchpad',
    'cointelegraph', 'coindesk', 'binance', 'coinbase',
    // Catch $XRP, $SOL, $ETH, $BTC style tickers
    '$xrp', '$sol', '$eth', '$btc', '$bnb', '$avax', '$ada', '$dot',
    'xrpfi', 'flare network', 'flare ecosystem',
    // Geopolitical / off-topic
    'xi jinping', 'geopolitical', 'election fraud', 'parliament', 'regime change',
    'political party', 'government shutdown',
    // Spam categories
    'interior design', 'gym', 'fitness', 'real estate', 'property',
    'onlyfans', 'adult', 'porn',
    'indian railway', 'railway station', 'bank failure', 'upi transaction', 'indusind',
    'victim incident response', 'law enforcement', 'regulatory scrutiny'
  ];

  if (noiseKeywords.some(k => lower.includes(k))) return true;

  // Catch generic crypto ticker pattern: $UPPERCASE (3-5 chars) that isn't a known tech term
  const tickerMatch = text.match(/\$[A-Z]{3,5}\b/g);
  if (tickerMatch) {
    const techTickers = ['$PATH', '$HOME', '$USER', '$PORT', '$NODE', '$TERM'];
    const hasCryptoTicker = tickerMatch.some(t => !techTickers.includes(t));
    if (hasCryptoTicker) return true;
  }

  return false;
}

function filterTweet(tweet, category, repliedIds, authorHistory) {
  if (repliedIds.has(tweet.id)) return { skip: true, reason: 'already_replied' };

  // Author cooldown: skip if same author replied within AUTHOR_COOLDOWN_DAYS
  const authorLower = (tweet.author.username || '').toLowerCase();
  if (authorHistory && authorHistory[authorLower]) {
    const lastReply = new Date(authorHistory[authorLower]);
    const daysSince = (Date.now() - lastReply.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < AUTHOR_COOLDOWN_DAYS) {
      return { skip: true, reason: 'author_cooldown' };
    }
  }

  if (isBot(tweet.author)) return { skip: true, reason: 'is_bot' };
  if (!isEnglish(tweet.text)) return { skip: true, reason: 'not_english' };
  if (isPromo(tweet.text)) return { skip: true, reason: 'is_promo' };
  if (isNoise(tweet.text)) return { skip: true, reason: 'is_noise' };

  const competitors = ['railway', 'vercel', 'render', 'heroku', 'netlify', 'fly.io'];
  const author = (tweet.author.username || '').toLowerCase();
  if (competitors.includes(author)) return { skip: true, reason: 'is_competitor' };

  const minLikes = category === 'pain_point' ? 3 : 5;
  if ((tweet.likeCount || 0) < minLikes) return { skip: true, reason: 'low_engagement' };

  const tweetTime = new Date(tweet.createdAt).getTime();
  const ageHours = (Date.now() - tweetTime) / (1000 * 60 * 60);
  if (ageHours > 72) return { skip: true, reason: 'too_old' };

  return { skip: false };
}

// ============================================================================
// CATEGORIZATION & SCORING
// ============================================================================

function getCategory(tweet) {
  const text = tweet.text.toLowerCase();
  const author = (tweet.author.username || '').toLowerCase();

  const authorities = ['theconfigguy', 'fluxdiv', 'kelseyhightower', 'rakyll', 'copyconstruct', 'jezhumble', 'allspaw'];
  if (tweet.inReplyToStatusId && authorities.some(a => text.includes(a) || author === a)) {
    return 'pain_point';
  }

  const audienceKeywords = ['indie', 'solo', 'founder', 'vibe', 'learn', 'first', 'deploy', 'afraid', 'anxious', 'scared', 'zero cs', 'zero degree', 'master electrician'];
  if (audienceKeywords.some(k => text.includes(k))) return 'audience';

  const painKeywords = ['crash', 'down', 'incident', 'alert', 'failed', 'error', 'nginx', '502', 'deployment failed', 'rollback', '3am', 'on-call', 'pager'];
  if (painKeywords.some(k => text.includes(k))) return 'pain_point';

  const competitorKeywords = ['vercel', 'railway', 'render', 'heroku', 'expensive', 'pricing', 'too complex', 'overkill'];
  if (competitorKeywords.some(k => text.includes(k))) return 'competitor';

  return 'monitoring';
}

function scoreRelevance(tweet, category) {
  let score = 0;
  const authorLower = (tweet.author.username || '').toLowerCase();

  // --- Influencer tier ---
  const tier = TRACKED_INFLUENCERS[authorLower];
  if (tier === 1) {
    score += 2;
  } else if (tier === 2 || tier === 3) {
    score += 1.5;
  } else if ((tweet.likeCount || 0) > 50) {
    score += 1;
  } else if ((tweet.likeCount || 0) >= 20) {
    score += 0.5;
  }

  // --- Engagement visibility (likes as proxy, no views in bird) ---
  const likes = tweet.likeCount || 0;
  if (likes > 30) {
    score += 1;
  } else if (likes >= 10) {
    score += 0.5;
  }

  // --- Reply opportunity ---
  const replies = tweet.replyCount || 0;
  if (replies < 5) {
    score += 1;
  } else if (replies <= 15) {
    score -= 0.5;
  } else {
    score -= 1;
  }

  // --- Relevance (pain-point directness) ---
  const text = tweet.text.toLowerCase();
  const directPainKeywords = ['crash', 'crashed', 'monitoring', 'deploy', 'deployment', 'on-call', 'oncall',
    '3am', '2am', '4am', 'incident', 'server down', 'site is down', 'app is down', 'woke up',
    'outage', 'downtime', 'rollback', 'pager', 'alert fatigue', 'post-mortem', 'postmortem'];
  const hasDirect = directPainKeywords.some(k => text.includes(k));

  const indirectKeywords = ['server', 'infrastructure', 'devops', 'hosting', 'vps', 'production',
    'observability', 'uptime', 'latency', 'docker', 'kubernetes', 'k8s', 'ci/cd', 'pipeline',
    'nginx', 'load balancer', 'ssl', 'dns', 'ssh', 'linux', 'aws', 'gcp', 'azure'];
  const hasIndirect = indirectKeywords.some(k => text.includes(k));

  if (hasDirect) {
    score += 1;
  } else if (hasIndirect) {
    score += 0.5;
  }

  // --- HARD RELEVANCE GATE ---
  // If tweet has NO DevOps/server context at all, cap score to prevent irrelevant high-engagement tweets
  const hasAnyRelevance = hasDirect || hasIndirect;
  if (!hasAnyRelevance) {
    score = Math.min(score, 1.5);
  }

  // --- Freshness ---
  const ageHours = (Date.now() - new Date(tweet.createdAt).getTime()) / (1000 * 60 * 60);
  const freshness = Math.max(2 - ageHours / 36, 0);
  score += hasAnyRelevance ? freshness : freshness * 0.3; // Reduce freshness bonus for irrelevant tweets

  // Cap at 5
  score = Math.min(score, 5);

  return Math.round(score * 100) / 100;
}

// ============================================================================
// TEMPLATE SELECTION (5 templates, context-aware)
// ============================================================================

function selectTemplates(tweet) {
  const authorLower = (tweet.author.username || '').toLowerCase();
  const tier = TRACKED_INFLUENCERS[authorLower];
  const text = tweet.text.toLowerCase();

  // Check if competitor mentioned (NOTE: 'claude' removed — it's our AI tool, not mttrly competitor)
  const competitorMentions = ['pagerduty', 'opsgenie', 'datadog', 'grafana', 'new relic', 'newrelic',
    'vercel', 'railway', 'heroku', 'render', 'fly.io', 'laravel forge', 'ploi', 'coolify',
    'chatgpt'];
  const hasCompetitor = competitorMentions.some(c => text.includes(c));

  // Check if pain complaint
  const painKeywords = ['crash', 'down', 'broke', 'failed', 'nightmare', 'hate', 'expensive', 'overkill', '3am', 'woke up'];
  const hasPain = painKeywords.some(k => text.includes(k));

  // Check if tweet has server/deploy/monitoring context (for Template C guard)
  const serverContext = ['server', 'deploy', 'monitoring', 'infrastructure', 'devops', 'hosting',
    'production', 'incident', 'on-call', 'uptime', 'downtime', 'outage', 'crash', 'alert',
    'docker', 'kubernetes', 'nginx', 'vps', 'ssh', 'ci/cd', 'pipeline', 'rollback'];
  const hasServerContext = serverContext.some(k => text.includes(k));

  let safeTemplate, punchyTemplate;

  // Tier 1 influencer rules
  if (tier === 1) {
    safeTemplate = 'D';
    punchyTemplate = Math.random() < 0.5 ? 'A' : 'E';
  }
  // Competitor in thread
  else if (hasCompetitor) {
    safeTemplate = 'D';
    // Only use Template C if server context exists, otherwise use A (pure value)
    punchyTemplate = hasServerContext ? 'C' : 'A';
  }
  // Pain complaint
  else if (hasPain) {
    safeTemplate = Math.random() < 0.5 ? 'B' : 'C';
    punchyTemplate = safeTemplate === 'B' ? 'E' : 'B';
  }
  // Default weighted distribution
  else {
    const rand = Math.random();
    if (rand < 0.30) { safeTemplate = 'A'; punchyTemplate = 'D'; }
    else if (rand < 0.55) { safeTemplate = 'B'; punchyTemplate = 'E'; }
    else if (rand < 0.75) {
      // Template C guard: only assign if server context exists
      if (hasServerContext) {
        safeTemplate = 'C'; punchyTemplate = 'A';
      } else {
        safeTemplate = 'A'; punchyTemplate = 'D';
      }
    }
    else if (rand < 0.90) { safeTemplate = 'D'; punchyTemplate = 'B'; }
    else {
      // Template C guard for punchy slot too
      if (hasServerContext) {
        safeTemplate = 'E'; punchyTemplate = 'C';
      } else {
        safeTemplate = 'E'; punchyTemplate = 'A';
      }
    }
  }

  // Enforce: SAFE and PUNCHY must be DIFFERENT
  if (safeTemplate === punchyTemplate) {
    const all = ['A', 'B', 'C', 'D', 'E'];
    const others = all.filter(t => t !== safeTemplate);
    punchyTemplate = others[Math.floor(Math.random() * others.length)];
  }

  return { safe: safeTemplate, punchy: punchyTemplate, hasCompetitor, hasServerContext };
}

// ============================================================================
// LLM REPLY GENERATION
// ============================================================================

function buildLLMPrompt(tweets) {
  const tweetsBlock = tweets.map((t, i) => {
    const ageH = Math.round((Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60));
    const templates = t._templates;
    const tier = t._tier;
    const priority = t._priority;

    return `--- TWEET ${i + 1} ---
ID: ${t.id}
Author: @${t.author.username}${tier ? ` [TIER ${tier} INFLUENCER]` : ''}
Category: ${t.category}
Priority: ${priority} (score: ${t.score})
SAFE Template: ${templates.safe} | PUNCHY Template: ${templates.punchy}
${templates.hasCompetitor ? 'COMPETITOR MENTIONED IN TWEET\n' : ''}Likes: ${t.likeCount || 0} | Replies: ${t.replyCount || 0} | Age: ${ageH}h
Is Reply: ${t.inReplyToStatusId ? 'yes' : 'no'}
Text: "${t.text}"
URL: https://x.com/${t.author.username}/status/${t.id}`;
  }).join('\n\n');

  return `You are writing Twitter replies for @mttrly — an AI-powered Telegram bot for server management.

PERSONA: Gilfoyle mode (Silicon Valley). Dry, smart, confident engineer. You've seen this 100 times before.
You share observations from production. You don't sell. Trust > sales.

═══ PRODUCT BRIEF (use ONLY when template requires it) ═══

Product: mttrly.com — AI-powered Telegram bot for server management.
Key features:
- Watchdog Mode (free): CPU/RAM/disk monitoring, crash alerts, auto-restart, triggers
- Deployment Bro ($39/mo): natural language server management, 8 diagnostic playbooks (WebsiteDown, HighLatency, PostDeployIssue, MemoryLeak etc.), safe deploy pipeline with auto-rollback
- Deployment Crew ($99/mo): multi-messenger (Telegram+Slack+Discord+WhatsApp), team access, GitHub webhooks
- Enterprise: custom recipes, SOC2-ready, RBAC, 365-day audit
Pricing: $0 (1 server) → $39 (3) → $99 (9) → Enterprise (10+)

What it does NOT do (safety by design):
- Does not edit configs directly (reads and tells what to change)
- Does not run arbitrary shell commands (only validated operations)
- Does not set up infrastructure from scratch (works with existing VPS)

═══ TARGET AUDIENCES ═══

1. Vibe Coders — use Cursor/Replit/Copilot, ship fast, no DevOps skills. Pain: "built with AI, broke in production"
2. Indie Hackers — solo founders juggling multiple projects. Pain: incidents during family dinner
3. On-Call Engineers — SRE/DevOps 24/7. Pain: VPN at 3am, simple fixes take 15+ minutes
4. Product Builders — PM/analysts shipping with AI tools. Pain: can build but can't deploy

═══ COMPETITIVE POSITIONING (use when competitor is mentioned) ═══

- vs Datadog/Grafana/New Relic: monitoring shows the problem, mttrly fixes it. Alert + diagnosis + fix in one place.
- vs PagerDuty/OpsGenie: alert comes to PagerDuty, but you still fix via SSH. mttrly does alert + fix in one chat.
- vs SSH clients (Termius, JuiceSSH): typing commands on phone at 3am is pain. Natural language chat wins.
- vs Laravel Forge/Ploi/Coolify: dashboard = open browser, find page, click around. mttrly lives in messenger you already have open.
- vs ChatGPT/Claude for DevOps: generic AI gives advice in vacuum. mttrly sees real server state — logs, metrics, processes.

═══ 5 REPLY TEMPLATES ═══

Template A — "Pure Value" (~30%): No product mention at all. Hook from tweet + expert insight. Up to 280 chars.
Template B — "Experience Story" (~25%): Personal experience + soft mention if natural. "I dealt with this → here's what helped → btw here's what I use". Product as detail, not pitch. Up to 500 chars.
Template C — "Specific Use Case" (~20%): Agreement + specific scenario + mttrly.com link. Use product features. Up to 500 chars.
Template D — "Question + Engage" (~15%): Smart question that shows expertise and invites reply. No product unless asked. Up to 280 chars.
Template E — "Contrarian Agree" (~10%): "Partly disagree — [nuance] — but the core point is right". Unexpected angle. Up to 500 chars.

═══ MANDATORY RULES ═══

1. HOOK FIRST: First 5-7 words MUST cite a specific detail from the tweet. No "I feel this", "Spot on", "Exactly this".
   GOOD: "The $30 stack works until...", "3am incidents happen because..."
2. SAFE and PUNCHY MUST use the DIFFERENT templates assigned to each tweet above.
3. Max 40% of all SAFE variants mention mttrly. Max 40% of all PUNCHY variants mention mttrly.
4. If tweet mentions competitor — one variant MUST use competitive positioning from above.
5. If author complains about specific problem — one variant MUST be Template B or C (with solution).
6. For Tier 1 influencers — do NOT sell. SAFE = Template D, PUNCHY = A or E.
7. Competitor in thread — use Template D (question), do NOT attack competitor directly.
8. NO EMOJI spam. No exclamation marks. No corporate speak.
9. NO generic openings. Every reply must be unique to the tweet content.
10. LENGTH: 1-3 sentences max. Short. People are stressed.
11. No more than 2 consecutive tweets using the same template (across SAFE variants and across PUNCHY variants separately).
12. ACCURACY: When quoting numbers, prices, stats, or facts from the original tweet, reproduce them EXACTLY. Never paraphrase, round, or change amounts. "$30/month" stays "$30/month", not "$0/month" or "under $30".
13. CONTEXT FIT: If the tweet is about client-side code, games, or frontend with NO server/deploy/monitoring context, do NOT pitch server management tools. Keep replies about the actual topic.

═══ TWEETS TO REPLY TO ═══

${tweetsBlock}

═══ OUTPUT FORMAT (strict JSON array) ═══
[
  {
    "tweet_id": "123...",
    "safe_template": "A",
    "punchy_template": "D",
    "context_ru": "Brief context in Russian (2-3 sentences)...",
    "safe": "Reply text here...",
    "safe_ru": "Russian translation of SAFE reply...",
    "punchy": "Reply text here...",
    "punchy_ru": "Russian translation of PUNCHY reply...",
    "why": "Brief explanation in Russian why this tweet and reply angle..."
  }
]

Return ONLY the JSON array. No markdown, no explanation.`;
}

function callLLM(prompt) {
  try {
    const result = execSync(
      `node "${OPENCLAW_CLI}" agent -m ${JSON.stringify(prompt)} --json --session-id twitter-digest --timeout 180`,
      {
        cwd: path.join(OPENCLAW_DIR, '..', 'openclaw'),
        timeout: 200000,
        maxBuffer: 2 * 1024 * 1024,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );

    const parsed = JSON.parse(result);
    const text = parsed?.result?.payloads?.[0]?.text || '';
    return text;
  } catch (err) {
    console.error('LLM call failed:', err.message);
    return null;
  }
}

function parseLLMResponse(text) {
  if (!text) return null;
  // Extract JSON array from response (might have markdown fences)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error('Could not find JSON array in LLM response');
    console.error('Response:', text.substring(0, 500));
    return null;
  }
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Failed to parse LLM JSON:', e.message);
    return null;
  }
}

// ============================================================================
// TELEGRAM
// ============================================================================

function formatTelegramDigest(mode, tweets, replies) {
  const replyMap = {};
  if (replies) {
    replies.forEach(r => { replyMap[r.tweet_id] = r; });
  }

  const priorityEmoji = { HIGH: '🔴', MEDIUM: '🟡', LOW: '⚪' };
  const categoryLabel = { pain_point: 'PAIN POINT', audience: 'AUDIENCE', competitor: 'COMPETITOR', monitoring: 'MONITORING' };
  const modeLabel = mode === 'fire-patrol' ? '🚨 Fire Patrol' : '🏗 Brand Building';
  const now = new Date().toISOString().split('T')[0];

  let msg = `<b>${modeLabel} Digest — ${now}</b>\n`;
  msg += `Tweets: ${tweets.length} candidates\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const quickApproveLines = [];

  tweets.forEach((t, i) => {
    const priority = t._priority || getPriority(t.score);
    const pEmoji = priorityEmoji[priority] || '⚪';
    const catLabel = categoryLabel[t.category] || t.category;
    const ageH = Math.round((Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60));
    const reply = replyMap[t.id];
    const isReply = t.inReplyToStatusId ? ' (reply в треде)' : '';
    const tier = t._tier;
    const tierLabel = tier ? ` | Tier ${tier}` : '';

    // Template labels from reply data or tweet metadata
    const safeT = reply?.safe_template || t._templates?.safe || '?';
    const punchyT = reply?.punchy_template || t._templates?.punchy || '?';

    msg += `${pEmoji} <b>${i + 1}/${tweets.length} — ${priority} | ${catLabel}</b>\n`;
    msg += `@${t.author.username} | ❤️ ${t.likeCount || 0} | 💬 ${t.replyCount || 0} | Score: ${t.score}${tierLabel} | ${ageH}h${isReply}\n\n`;

    // Context in Russian
    if (reply && reply.context_ru) {
      msg += `<b>Контекст:</b> ${escapeHtml(reply.context_ru)}\n\n`;
    }

    // Full tweet text
    msg += `<b>Твит:</b>\n<i>"${escapeHtml(truncate(t.text, 400))}"</i>\n\n`;

    if (reply) {
      msg += `🟢 <b>SAFE [${safeT}]:</b>\n${escapeHtml(reply.safe)}\n`;
      if (reply.safe_ru) {
        msg += `<i>${escapeHtml(reply.safe_ru)}</i>\n\n`;
      } else {
        msg += `\n`;
      }

      msg += `🟠 <b>PUNCHY [${punchyT}]:</b>\n${escapeHtml(reply.punchy)}\n`;
      if (reply.punchy_ru) {
        msg += `<i>${escapeHtml(reply.punchy_ru)}</i>\n\n`;
      } else {
        msg += `\n`;
      }

      if (reply.why) {
        msg += `<b>Почему:</b> ${escapeHtml(reply.why)}\n\n`;
      }
    } else {
      msg += `⚠️ LLM generation failed for this tweet\n\n`;
    }

    msg += `🔗 x.com/${t.author.username}/status/${t.id}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Build quick-approve entry
    const topic = truncate(t.text.replace(/\n/g, ' '), 40);
    quickApproveLines.push(`${i + 1}. @${t.author.username} — ${topic} → S[${safeT}] / P[${punchyT}]`);
  });

  // Quick approve block
  msg += `📋 <b>Quick Approve:</b>\n`;
  quickApproveLines.forEach(line => {
    msg += `${escapeHtml(line)}\n`;
  });
  msg += `\n<i>Ответь: 1P 2S 3P ... (P=punchy, S=safe, X=skip)</i>`;

  return msg;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + '...';
}

function sendTelegram(botToken, chatId, message) {
  // Split long messages (Telegram limit: 4096 chars)
  const chunks = splitMessage(message, 4000);

  return chunks.reduce((chain, chunk, i) => {
    return chain.then(() => {
      return new Promise((resolve, reject) => {
        const data = JSON.stringify({
          chat_id: chatId,
          text: chunk,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        });

        const options = {
          hostname: 'api.telegram.org',
          path: `/bot${botToken}/sendMessage`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          }
        };

        const req = https.request(options, (res) => {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => {
            if (res.statusCode === 200) {
              console.log(`  Telegram message ${i + 1}/${chunks.length} sent`);
              resolve();
            } else {
              console.error(`  Telegram error ${res.statusCode}:`, body);
              reject(new Error(`Telegram ${res.statusCode}: ${body}`));
            }
          });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
      });
    }).then(() => {
      // Small delay between messages
      if (i < chunks.length - 1) {
        return new Promise(r => setTimeout(r, 500));
      }
    });
  }, Promise.resolve());
}

function splitMessage(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  const separator = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  const parts = text.split(separator);
  let current = '';

  for (const part of parts) {
    const candidate = current ? current + separator + part : part;
    if (candidate.length > maxLen && current) {
      chunks.push(current);
      current = part;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.error('Usage: node process-digest.js <candidates-file.json>');
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`);
    process.exit(1);
  }

  console.log('=== PROCESS DIGEST v3 ===');
  console.log(`Input: ${inputFile}`);

  // Load config
  const { botToken, chatId } = loadConfig();
  console.log(`Telegram: bot token OK, chat ${chatId}`);

  // Load candidates
  const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const mode = data.mode || 'unknown';
  const candidates = data.candidates || [];
  console.log(`Mode: ${mode}, candidates: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('No candidates to process. Skipping.');
    return;
  }

  // Load tracking for dedup
  const tracking = loadTracking();
  console.log(`Tracking: ${tracking.repliedIds.size} replied IDs, ${Object.keys(tracking.authorHistory).length} authors tracked`);

  // Categorize
  const categorized = candidates.map(t => ({
    ...t,
    category: getCategory(t)
  }));

  // Filter
  const filtered = [];
  const skipReasons = {};

  categorized.forEach(tweet => {
    const result = filterTweet(tweet, tweet.category, tracking.repliedIds, tracking.authorHistory);
    if (result.skip) {
      skipReasons[result.reason] = (skipReasons[result.reason] || 0) + 1;
    } else {
      const score = scoreRelevance(tweet, tweet.category);
      filtered.push({ ...tweet, score });
    }
  });

  console.log(`Filtered: ${filtered.length} passed, ${candidates.length - filtered.length} skipped`);
  if (Object.keys(skipReasons).length > 0) {
    console.log('Skip reasons:', JSON.stringify(skipReasons));
  }

  if (filtered.length === 0) {
    console.log('No tweets passed filters. Sending notice to Telegram.');
    await sendTelegram(botToken, chatId,
      `📭 <b>${mode} Digest</b> — No suitable tweets found.\n` +
      `Scanned ${candidates.length} candidates, all filtered out.\n` +
      `Reasons: ${Object.entries(skipReasons).map(([k, v]) => `${k}: ${v}`).join(', ')}`
    );
    return;
  }

  // Rank and select top N
  filtered.sort((a, b) => b.score - a.score);
  const topN = filtered.slice(0, TOP_N);

  // Assign templates and metadata to top tweets
  topN.forEach(t => {
    t._templates = selectTemplates(t);
    t._tier = getInfluencerTier(t.author.username);
    t._priority = getPriority(t.score);
  });

  console.log(`\nTop ${topN.length} candidates:`);
  topN.forEach((t, i) => {
    const tierStr = t._tier ? ` [Tier ${t._tier}]` : '';
    console.log(`  ${i + 1}. @${t.author.username} [${t.category}] ${t._priority} score=${t.score}${tierStr} likes=${t.likeCount} S[${t._templates.safe}] P[${t._templates.punchy}]`);
  });

  // Call LLM for reply generation
  console.log('\nCalling LLM for reply generation...');
  const prompt = buildLLMPrompt(topN);
  const llmResponse = callLLM(prompt);
  const replies = parseLLMResponse(llmResponse);

  if (replies) {
    console.log(`LLM generated ${replies.length} reply sets`);
  } else {
    console.log('LLM generation failed — sending digest without replies');
  }

  // Format and send Telegram digest
  console.log('\nSending Telegram digest...');
  const message = formatTelegramDigest(mode, topN, replies);
  await sendTelegram(botToken, chatId, message);

  // Save digest to file
  const digestFile = path.join(PACKS_DIR, `${mode}-digest-${new Date().toISOString().split('T')[0]}.json`);
  fs.writeFileSync(digestFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    mode,
    version: 3,
    stats: {
      collected: candidates.length,
      filtered: filtered.length,
      top: topN.length
    },
    candidates: topN.map(t => ({
      id: t.id,
      author: t.author.username,
      text: t.text.substring(0, 200),
      category: t.category,
      score: t.score,
      priority: t._priority,
      tier: t._tier,
      templates: { safe: t._templates.safe, punchy: t._templates.punchy },
      likes: t.likeCount,
      replies_count: t.replyCount,
      url: `https://x.com/${t.author.username}/status/${t.id}`,
      replies: replies ? replies.find(r => r.tweet_id === t.id) : null
    }))
  }, null, 2));

  console.log(`\nDigest saved: ${digestFile}`);
  console.log('=== DONE ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
