#!/usr/bin/env node

/**
 * process-digest.js
 *
 * Unified Twitter pipeline: Filter → Score → LLM Generate → Telegram
 *
 * Usage: node process-digest.js <candidates-file.json>
 *
 * Reads scout output (fire-patrol or brand-building candidates),
 * filters/scores tweets, calls LLM to generate 2 reply variants
 * (SAFE + PUNCHY), and sends digest to Telegram for approval.
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
// TRACKING (dedup)
// ============================================================================

function loadTracking() {
  if (!fs.existsSync(TRACKING_FILE)) {
    fs.writeFileSync(TRACKING_FILE, '# X Engagement Tracking\n\n## Replied To\n(none yet)\n\n## Skipped\n(none yet)\n');
  }
  const content = fs.readFileSync(TRACKING_FILE, 'utf8');
  const repliedIds = new Set();
  let inReplied = false;
  content.split('\n').forEach(line => {
    if (line.startsWith('## Replied To')) inReplied = true;
    else if (line.startsWith('## ')) inReplied = false;
    if (inReplied) {
      const match = line.match(/^- (\d+)/);
      if (match) repliedIds.add(match[1]);
    }
  });
  return repliedIds;
}

// ============================================================================
// FILTERS (ported from x-evening-digest.js — confirmed correct by owner)
// ============================================================================

function isEnglish(text) {
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

function filterTweet(tweet, category, repliedIds) {
  if (repliedIds.has(tweet.id)) return { skip: true, reason: 'already_replied' };
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
// CATEGORIZATION & SCORING (ported from x-evening-digest.js)
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
  score += Math.min((tweet.likeCount || 0) / 20, 3);

  const ageHours = (Date.now() - new Date(tweet.createdAt).getTime()) / (1000 * 60 * 60);
  const freshness = Math.max(2 - ageHours / 36, 0);
  score += freshness;

  if (tweet.inReplyToStatusId) score += 1;

  const weights = { pain_point: 3, audience: 2, competitor: 1.5, monitoring: 0.8 };
  score *= weights[category] || 1;

  return Math.round(score * 100) / 100;
}

function selectTemplate(tweet) {
  const estimatedViews = (tweet.likeCount || 0) * 7;
  if (estimatedViews < 500 || tweet.category === 'audience') return 'A';
  if (estimatedViews >= 500 && tweet.category !== 'pain_point') return 'B';
  if (estimatedViews >= 500 && tweet.category === 'pain_point') return 'C';
  return 'A';
}

// ============================================================================
// LLM REPLY GENERATION
// ============================================================================

function buildLLMPrompt(tweets) {
  const tweetsBlock = tweets.map((t, i) => {
    const ageH = Math.round((Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60));
    const template = selectTemplate(t);
    const categoryEmoji = { pain_point: 'ГОРЯЧЕЕ', audience: 'ХОРОШЕЕ', competitor: 'МОНИТОРИНГ', monitoring: 'МОНИТОРИНГ' };
    return `--- TWEET ${i + 1} ---
ID: ${t.id}
Author: @${t.author.username} (${t.author.followers || '?'} followers)
Category: ${categoryEmoji[t.category] || t.category}
Score: ${t.score}
Template: ${template}
Likes: ${t.likeCount || 0} | Replies: ${t.replyCount || 0} | Age: ${ageH}h
Is Reply: ${t.inReplyToStatusId ? 'yes' : 'no'}
Text: "${t.text}"
URL: https://x.com/${t.author.username}/status/${t.id}`;
  }).join('\n\n');

  return `You are writing Twitter replies for @mttrly — a server monitoring tool for indie makers.

PERSONA: Gilfoyle mode (Silicon Valley). Dry, smart, confident engineer. You've seen this 100 times before.
You share observations from production. You don't sell. Trust > sales.

MANDATORY RULES:
1. HOOK FIRST: First 5-7 words MUST cite a specific detail from the tweet. Prove you read it.
   BAD: "I feel this", "Spot on", "Exactly this"
   GOOD: "The $30 stack works until...", "3am incidents happen because..."
2. LENGTH: 1-3 sentences max. Short. People are stressed.
3. NO SALES: No "check out", "buy now", "try us". Value only.
4. NO EMOJI spam. No exclamation marks. No corporate speak.
5. NO generic openings. Every reply must be unique to the tweet.

TEMPLATE RULES:
- Template A (Pure Value): No mention of mttrly. Hook + insight. For low engagement tweets.
- Template B (Question): No mention of mttrly. Hook + thoughtful question. For medium engagement.
- Template C (Value + Soft Mention): CAN mention mttrly IF natural. Only for 500+ views + pain_point. Max 40% of C replies mention mttrly.

For each tweet, generate exactly 2 reply variants:
- SAFE: Neutral-expert tone. Pure value, safe for any context.
- PUNCHY: Slightly edgier, more personality, still respectful. A bit more Gilfoyle.

Additionally for EACH tweet provide:
- context_ru: Brief context in Russian (2-3 sentences). Explain what the tweet is about, why it's relevant. If it's a reply in a thread — explain the thread context. This is for the human reviewer who reads digest in Telegram.
- safe_ru: Russian translation of the SAFE reply (for context, not for posting).
- punchy_ru: Russian translation of the PUNCHY reply.
- why: Brief explanation in Russian why this tweet was selected and why this reply angle works.

TWEETS TO REPLY TO:

${tweetsBlock}

OUTPUT FORMAT (strict JSON array):
[
  {
    "tweet_id": "123...",
    "context_ru": "Краткий контекст на русском...",
    "safe": "Reply text here...",
    "safe_ru": "Перевод safe реплая...",
    "punchy": "Reply text here...",
    "punchy_ru": "Перевод punchy реплая...",
    "why": "Почему выбран этот твит и почему такой угол ответа..."
  }
]

Return ONLY the JSON array. No markdown, no explanation.`;
}

function callLLM(prompt) {
  try {
    const result = execSync(
      `node "${OPENCLAW_CLI}" agent -m ${JSON.stringify(prompt)} --json --session-id twitter-digest --timeout 120`,
      {
        cwd: path.join(OPENCLAW_DIR, '..', 'openclaw'),
        timeout: 150000,
        maxBuffer: 1024 * 1024,
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

  const categoryEmoji = { pain_point: '🔥', audience: '👍', competitor: '📈', monitoring: '📈' };
  const categoryLabel = { pain_point: 'ГОРЯЧЕЕ', audience: 'ХОРОШЕЕ', competitor: 'МОНИТОРИНГ', monitoring: 'МОНИТОРИНГ' };
  const modeLabel = mode === 'fire-patrol' ? '🚨 Fire Patrol' : '🏗 Brand Building';
  const now = new Date().toISOString().split('T')[0];

  let msg = `<b>${modeLabel} Digest — ${now}</b>\n`;
  msg += `Tweets: ${tweets.length} candidates\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  tweets.forEach((t, i) => {
    const emoji = categoryEmoji[t.category] || '📌';
    const label = categoryLabel[t.category] || t.category;
    const ageH = Math.round((Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60));
    const reply = replyMap[t.id];
    const isReply = t.inReplyToStatusId ? ' (reply в треде)' : '';

    msg += `${emoji} <b>${i + 1}/${tweets.length} — ${label}</b>\n`;
    msg += `@${t.author.username} | ❤️ ${t.likeCount || 0} | Score: ${t.score} | ${ageH}h${isReply}\n\n`;

    // Context in Russian
    if (reply && reply.context_ru) {
      msg += `<b>Контекст:</b> ${escapeHtml(reply.context_ru)}\n\n`;
    }

    // Full tweet text
    msg += `<b>Твит:</b>\n<i>"${escapeHtml(truncate(t.text, 400))}"</i>\n\n`;

    if (reply) {
      // SAFE reply + Russian translation
      msg += `🟢 <b>SAFE:</b>\n${escapeHtml(reply.safe)}\n`;
      if (reply.safe_ru) {
        msg += `<i>${escapeHtml(reply.safe_ru)}</i>\n\n`;
      } else {
        msg += `\n`;
      }

      // PUNCHY reply + Russian translation
      msg += `🟠 <b>PUNCHY:</b>\n${escapeHtml(reply.punchy)}\n`;
      if (reply.punchy_ru) {
        msg += `<i>${escapeHtml(reply.punchy_ru)}</i>\n\n`;
      } else {
        msg += `\n`;
      }

      // Why this tweet
      if (reply.why) {
        msg += `<b>Почему:</b> ${escapeHtml(reply.why)}\n\n`;
      }
    } else {
      msg += `⚠️ LLM generation failed for this tweet\n\n`;
    }

    msg += `🔗 x.com/${t.author.username}/status/${t.id}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  });

  msg += `<i>Ответь номером твита + SAFE/PUNCHY для аппрува.</i>`;
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

  console.log('=== PROCESS DIGEST ===');
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
  const repliedIds = loadTracking();
  console.log(`Tracking: ${repliedIds.size} previously replied IDs`);

  // Categorize
  const categorized = candidates.map(t => ({
    ...t,
    category: getCategory(t)
  }));

  // Filter
  const filtered = [];
  const skipReasons = {};

  categorized.forEach(tweet => {
    const result = filterTweet(tweet, tweet.category, repliedIds);
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

  console.log(`\nTop ${topN.length} candidates:`);
  topN.forEach((t, i) => {
    console.log(`  ${i + 1}. @${t.author.username} [${t.category}] score=${t.score} likes=${t.likeCount}`);
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
      likes: t.likeCount,
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
