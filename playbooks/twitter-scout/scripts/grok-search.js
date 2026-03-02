#!/usr/bin/env node

/**
 * grok-search.js — xAI Grok API search for twitter-scout pipeline
 *
 * Uses Grok's x_search tool to find relevant tweets via semantic search.
 * Complementary to bird CLI (keyword-based) — Grok understands context better.
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
const XAI_MODEL = 'grok-4-1-fast';
const XAI_ENDPOINT = 'api.x.ai';

const WORKSPACE_DIR = path.resolve(__dirname, '../../..');
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(WORKSPACE_DIR, 'daily-packs');

// Search prompts by mode — semantic queries that Grok understands better than keyword search
const MODE_PROMPTS = {
  'fire-patrol': {
    prompt: `You are an expert at finding genuine developer pain on X.

Find the most recent tweets (last 48 hours) from INDIVIDUAL developers, engineers or indie founders who are visibly frustrated or venting about:

- Production crashes, outages or "everything is down"
- Deployment failing + rollback hell
- Getting woken up at 3am by PagerDuty/on-call alerts
- Alert fatigue / too many false positives from monitoring
- Infrastructure bills being stupidly high
- CI/CD pipeline breaking on every merge
- Post-mortem nightmares or "I spent 4 hours debugging this"

Only English tweets from real people (not companies, not news, not crypto/web3, not politics/sports).

Prioritize tweets with these signs of real pain:
- Words like "fuck", "nightmare", "again?!", "3am", "killed my weekend", "I'm done"
- Personal stories ("I just spent...", "why does this always...")
- 5+ likes preferred, but quality > quantity

Exclude any promotional, ad-like or neutral technical posts.`,
    x_search: {
      from_date: getDateDaysAgo(2),
      to_date: getToday()
    }
  },

  'brand-building': {
    prompt: `Find recent tweets (last 48 hours) from solo devs, indie hackers and bootstrapped founders who are:

- Shipping new products or "building in public"
- Using AI coding tools (Cursor, Claude, Copilot, Windsurf, Replit) and talking about deployment
- Celebrating or struggling with their first real deployment
- Complaining "I built the whole app with AI but now I can't deploy it reliably"
- Discussing "simple server vs complex cloud" or "I don't want to learn DevOps"

Focus ONLY on individual creators (bio contains dev, founder, indie, solo, hacker).

English only. Prefer 5+ likes. Exclude corporate accounts, crypto, politics, news, promo posts.

Especially good: tweets that end with a question or show frustration with infra after AI coding session.`,
    x_search: {
      from_date: getDateDaysAgo(2),
      to_date: getToday()
    }
  },

  'influencer-monitor': {
    prompt: `Find tweets from the last 72 hours by known tech influencers, indie devs or people with 5k+ followers about:

- Server management / deployment / infra pain
- Observability, monitoring, incident response
- On-call horror stories
- Opinions on DevOps tools
- Complaints about Vercel, Railway, Fly.io, Supabase, Heroku (pricing, outages, deploy failures)

Also specifically catch replies/complaints directed at @vercel @railway_app @flydotio @supabase @render @heroku

Only genuine pain or discussion, no promo.

English. Prefer high engagement.`,
    x_search: {
      from_date: getDateDaysAgo(3),
      to_date: getToday(),
      excluded_x_handles: ['bankrbot']
    }
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

// ============================================================================
// MAIN SEARCH
// ============================================================================

async function searchGrok(mode) {
  const config = MODE_PROMPTS[mode];
  if (!config) {
    console.error(`ERROR: Unknown mode: ${mode}`);
    process.exit(1);
  }

  const searchTool = {
    type: 'x_search',
    ...config.x_search
  };

  const structuredPrompt = `${config.prompt}

IMPORTANT: Return your findings as a JSON array. For each tweet found, include:
[
  {
    "id": "tweet_id_from_url",
    "text": "full tweet text",
    "author": {
      "username": "handle_without_at",
      "name": "Display Name"
    },
    "likeCount": 0,
    "replyCount": 0,
    "retweetCount": 0,
    "createdAt": "ISO timestamp if available",
    "url": "https://x.com/user/status/id",
    "pain_score": 7,
    "reply_opportunity": 8
  }
]

pain_score (1-10): how intense is the frustration/pain in this tweet. 10 = maximum pain, personal venting. 1 = neutral mention.
reply_opportunity (1-10): how natural and welcome would a helpful reply be here. 10 = perfect opening for advice. 1 = closed conversation.

Return ONLY the JSON array. Include up to 15 tweets, ranked by reply_opportunity descending. If you can't find the exact metrics, estimate based on what you see. If you find no relevant tweets, return an empty array [].`;

  console.log(`  Grok x_search: ${mode}`);

  const body = {
    model: XAI_MODEL,
    input: [
      { role: 'user', content: structuredPrompt }
    ],
    tools: [searchTool]
  };

  const response = await xaiRequest(body);

  // Extract text content from response
  let text = '';
  if (response.output) {
    // New responses API format
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

  if (!text) {
    console.log('  Grok returned empty response');
    return [];
  }

  // Parse JSON array from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.log('  Grok response did not contain JSON array');
    console.log('  Response preview:', text.substring(0, 200));
    return [];
  }

  try {
    const tweets = JSON.parse(jsonMatch[0]);
    console.log(`  Grok found ${tweets.length} tweets`);

    // Normalize: add source marker + grok scoring fields
    return tweets.map(t => ({
      ...t,
      _source: 'grok',
      id: String(t.id || ''),
      likeCount: t.likeCount || 0,
      replyCount: t.replyCount || 0,
      retweetCount: t.retweetCount || 0,
      pain_score: Math.min(10, Math.max(0, Number(t.pain_score) || 0)),
      reply_opportunity: Math.min(10, Math.max(0, Number(t.reply_opportunity) || 0)),
      author: {
        username: (t.author?.username || '').replace(/^@/, ''),
        name: t.author?.name || t.author?.username || ''
      }
    }));
  } catch (e) {
    console.error('  Failed to parse Grok JSON:', e.message);
    return [];
  }
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

  console.log(`Grok search: ${mode}`);

  try {
    const tweets = await searchGrok(mode);

    const result = {
      source: 'grok',
      mode,
      timestamp: new Date().toISOString(),
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
    // Non-fatal — output empty results
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
