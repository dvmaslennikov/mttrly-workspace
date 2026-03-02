#!/usr/bin/env node

/**
 * grok-search.js — xAI Grok API search for twitter-scout pipeline
 *
 * Uses Grok's x_search tool to find relevant tweets via semantic search.
 * Complementary to bird CLI (keyword-based) — Grok understands context better.
 *
 * For fire-patrol: runs 4 focused sub-prompts in parallel for better coverage.
 * Other modes: single prompt.
 *
 * Usage: node grok-search.js <mode> [output-file]
 * Modes: fire-patrol, brand-building, influencer-monitor
 *
 * Requires: XAI_API_KEY in environment (from ~/.openclaw/.env.bird)
 * If no key — exits 0 with empty results (non-blocking).
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIG
// ============================================================================

const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_MODEL = 'grok-4-1-fast-reasoning';
const XAI_ENDPOINT = 'api.x.ai';

const WORKSPACE_DIR = path.resolve(__dirname, '../../..');
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(WORKSPACE_DIR, 'daily-packs');

// Excluded handles — corporate, news, crypto (max 10 for x_search)
const EXCLUDED_HANDLES = [
  'vercel', 'railway_app', 'flydotio', 'supabase',
  'awscloud', 'TechCrunch', 'bankrbot', 'TheHackersNews'
];

// Common JSON output instruction appended to all prompts
const JSON_INSTRUCTION = `
Return ONLY a valid JSON array (max 8 items), sorted by reply_opportunity descending.
Each item:
{
  "id": "tweet_id_from_url",
  "text": "full tweet text",
  "author": { "username": "handle_without_at", "name": "Display Name" },
  "likeCount": number,
  "url": "https://x.com/user/status/id",
  "pain_score": number_1_to_10,
  "reply_opportunity": number_1_to_10
}
pain_score: how intense is the frustration. 10 = maximum pain. 1 = neutral mention.
reply_opportunity: how natural and welcome a helpful reply would be. 10 = perfect opening.
If no relevant tweets found, return [].`;

// ============================================================================
// SUB-PROMPTS — fire-patrol split into 4 focused categories
// ============================================================================

const FIRE_PATROL_SUB_PROMPTS = [
  {
    name: 'on-call-3am',
    prompt: `Find tweets (last 48h) from individual developers frustrated about:
- Getting woken at 3am/2am/4am by PagerDuty, on-call alerts
- Production crashes at night, "I was sleeping and got paged"
- Weekend ruined by incidents
- "I can't sleep because of on-call"

Only English. Real people (not companies/news/crypto). Prefer personal stories with emotion.
${JSON_INSTRUCTION}`
  },
  {
    name: 'deploy-rollback',
    prompt: `Find tweets (last 48h) from individual developers frustrated about:
- Deployment failing, "pushed to main and broke prod"
- Rollback hell, "spent hours rolling back"
- CI/CD breaking on every merge
- "My deploy pipeline is a nightmare"

Only English. Real people (not companies/news/crypto). Prefer personal venting.
${JSON_INSTRUCTION}`
  },
  {
    name: 'infra-monitoring',
    prompt: `Find tweets (last 48h) from individual developers frustrated about:
- Infrastructure bills being stupidly high (AWS, cloud costs)
- Alert fatigue, too many false positives from monitoring
- Post-mortem nightmares, "I spent 4 hours debugging this"
- Observability / logging pain

Only English. Real people (not companies/news/crypto). Prefer personal stories.
${JSON_INSTRUCTION}`
  },
  {
    name: 'vibe-coder-pain',
    prompt: `Find tweets (last 48h) from individual developers or indie founders frustrated about:
- Built an app with AI (Cursor, Claude, Copilot) but can't deploy it reliably
- "Vibe coded the whole thing, now production is down at 2am"
- "I don't know DevOps, my AI app keeps crashing"
- Solo founder shipping but infra is breaking
- First deploy fear or failure

Only English. Real people, indie hackers, solo devs. Prefer frustrated personal stories.
${JSON_INSTRUCTION}`
  }
];

// ============================================================================
// SINGLE-MODE PROMPTS (brand-building, influencer-monitor)
// ============================================================================

const SINGLE_PROMPTS = {
  'brand-building': {
    prompt: `Find recent tweets (last 48 hours) from solo devs, indie hackers and bootstrapped founders who are:

- Shipping new products or "building in public"
- Using AI coding tools (Cursor, Claude, Copilot, Windsurf, Replit) and talking about deployment
- Celebrating or struggling with their first real deployment
- Complaining "I built the whole app with AI but now I can't deploy it reliably"
- Discussing "simple server vs complex cloud" or "I don't want to learn DevOps"

Focus ONLY on individual creators. English only. Exclude corporate accounts, crypto, politics, news, promo.
${JSON_INSTRUCTION}`,
    x_search: { from_date: getDateDaysAgo(2), to_date: getToday() }
  },

  'influencer-monitor': {
    prompt: `Find tweets (last 72 hours) by known tech influencers, indie devs or people with 5k+ followers about:

- Server management / deployment / infra pain
- Observability, monitoring, incident response
- On-call horror stories
- Opinions on DevOps tools
- Complaints about Vercel, Railway, Fly.io, Supabase, Heroku (pricing, outages, deploy failures)

Also catch replies/complaints directed at @vercel @railway_app @flydotio @supabase @render @heroku

Only genuine pain or discussion, no promo. English. Prefer high engagement.
${JSON_INSTRUCTION}`,
    x_search: { from_date: getDateDaysAgo(3), to_date: getToday() }
  }
};

// ============================================================================
// HELPERS
// ============================================================================

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getDateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function xaiRequest(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: XAI_ENDPOINT,
      path: '/v1/responses',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        } else {
          reject(new Error(`xAI API ${res.statusCode}: ${body.substring(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('xAI API request timeout (120s)'));
    });
    req.write(data);
    req.end();
  });
}

function extractText(response) {
  let text = '';
  if (response.output) {
    for (const item of response.output) {
      if (item.type === 'message' && item.content) {
        for (const block of item.content) {
          if (block.type === 'output_text') {
            text += block.text;
          }
        }
      }
    }
  }
  return text;
}

function parseTweets(text, subName) {
  if (!text) {
    console.log(`    [${subName}] empty response`);
    return [];
  }

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.log(`    [${subName}] no JSON array found`);
    console.log(`    Preview: ${text.substring(0, 150)}`);
    return [];
  }

  try {
    const tweets = JSON.parse(jsonMatch[0]);
    return tweets.map(t => ({
      ...t,
      _source: 'grok',
      _sub_prompt: subName,
      id: String(t.id || ''),
      likeCount: t.likeCount || 0,
      replyCount: t.replyCount || 0,
      retweetCount: t.retweetCount || 0,
      pain_score: Math.min(10, Math.max(0, Number(t.pain_score) || 0)),
      reply_opportunity: Math.min(10, Math.max(0, Number(t.reply_opportunity) || 0)),
      author: {
        username: (t.author?.username || String(t.author || '')).replace(/^@/, ''),
        name: t.author?.name || t.author?.username || String(t.author || '')
      }
    }));
  } catch (e) {
    console.log(`    [${subName}] JSON parse error: ${e.message}`);
    return [];
  }
}

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

async function searchSingle(prompt, xSearchConfig, name) {
  const body = {
    model: XAI_MODEL,
    input: [{ role: 'user', content: prompt }],
    tools: [{
      type: 'x_search',
      ...xSearchConfig,
      excluded_x_handles: EXCLUDED_HANDLES
    }]
  };

  const response = await xaiRequest(body);
  const text = extractText(response);
  const tweets = parseTweets(text, name);
  console.log(`    [${name}] ${tweets.length} tweets`);
  return tweets;
}

async function searchFirePatrol() {
  const xSearchConfig = {
    from_date: getDateDaysAgo(2),
    to_date: getToday()
  };

  console.log('  Running 4 sub-prompts in parallel...');

  const results = await Promise.all(
    FIRE_PATROL_SUB_PROMPTS.map(sub =>
      searchSingle(sub.prompt, xSearchConfig, sub.name)
        .catch(err => {
          console.error(`    [${sub.name}] failed: ${err.message}`);
          return [];
        })
    )
  );

  // Merge and deduplicate by tweet ID
  const seen = new Set();
  const allTweets = [];
  for (const tweets of results) {
    for (const t of tweets) {
      if (t.id && !seen.has(t.id)) {
        seen.add(t.id);
        allTweets.push(t);
      }
    }
  }

  // Sort by reply_opportunity descending
  allTweets.sort((a, b) => (b.reply_opportunity || 0) - (a.reply_opportunity || 0));

  console.log(`  Grok total: ${allTweets.length} unique tweets from ${results.length} sub-prompts`);
  return allTweets;
}

async function searchMode(mode) {
  if (mode === 'fire-patrol') {
    return searchFirePatrol();
  }

  const config = SINGLE_PROMPTS[mode];
  if (!config) {
    console.error(`ERROR: Unknown mode: ${mode}`);
    process.exit(1);
  }

  console.log(`  Grok x_search: ${mode}`);
  return searchSingle(config.prompt, config.x_search, mode);
}

// ============================================================================
// ENTRY
// ============================================================================

async function main() {
  const mode = process.argv[2];
  const outputFile = process.argv[3];

  if (!mode) {
    console.error('Usage: node grok-search.js <mode> [output-file]');
    console.error('Modes: fire-patrol, brand-building, influencer-monitor');
    process.exit(1);
  }

  // Graceful skip if no API key
  if (!XAI_API_KEY) {
    console.log('SKIP: XAI_API_KEY not set. Grok search disabled.');
    const result = { source: 'grok', mode, status: 'skipped', reason: 'no_api_key', candidates: [] };
    if (outputFile) {
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    } else {
      console.log(JSON.stringify(result));
    }
    process.exit(0);
  }

  console.log(`Grok search: ${mode} (model: ${XAI_MODEL})`);

  try {
    const tweets = await searchMode(mode);

    const result = {
      source: 'grok',
      mode,
      timestamp: new Date().toISOString(),
      model: XAI_MODEL,
      status: 'ok',
      tweet_count: tweets.length,
      candidates: tweets
    };

    if (outputFile) {
      const dir = path.dirname(outputFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
      console.log(`Output: ${outputFile} (${tweets.length} tweets)`);
    } else {
      console.log(JSON.stringify(result));
    }
  } catch (err) {
    console.error(`Grok search failed: ${err.message}`);
    const result = { source: 'grok', mode, status: 'error', error: err.message, candidates: [] };
    if (outputFile) {
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    } else {
      console.log(JSON.stringify(result));
    }
    process.exit(0); // Exit 0 — grok failure is non-blocking
  }
}

main();
