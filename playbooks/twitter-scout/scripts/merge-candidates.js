#!/usr/bin/env node

/**
 * merge-candidates.js — Merge & deduplicate candidates from multiple sources
 *
 * Takes bird CLI output (primary) and optionally grok-search output (supplementary),
 * deduplicates by tweet ID, and produces a single candidates file.
 *
 * Usage: node merge-candidates.js <bird-file> [grok-file] -o <output-file>
 *
 * - Bird results are primary (more accurate metadata: likes, replies, timestamps)
 * - Grok results fill gaps (semantic search finds tweets keyword search misses)
 * - When same tweet appears in both: bird version wins (better metadata)
 */

const fs = require('fs');
const path = require('path');

function loadCandidatesFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data;
  } catch (e) {
    console.error(`WARN: Failed to parse ${filePath}: ${e.message}`);
    return null;
  }
}

function main() {
  const args = process.argv.slice(2);

  // Parse args
  let birdFile = null;
  let grokFile = null;
  let outputFile = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-o' && args[i + 1]) {
      outputFile = args[++i];
    } else if (!birdFile) {
      birdFile = args[i];
    } else if (!grokFile) {
      grokFile = args[i];
    }
  }

  if (!birdFile || !outputFile) {
    console.error('Usage: node merge-candidates.js <bird-file> [grok-file] -o <output-file>');
    process.exit(1);
  }

  // Load sources
  const birdData = loadCandidatesFile(birdFile);
  const grokData = loadCandidatesFile(grokFile);

  if (!birdData) {
    console.error(`ERROR: Cannot load bird file: ${birdFile}`);
    process.exit(1);
  }

  const birdCandidates = birdData.candidates || [];
  const grokCandidates = (grokData && grokData.candidates) || [];
  const grokStatus = grokData ? grokData.status : 'not_provided';

  console.log(`Bird: ${birdCandidates.length} candidates`);
  console.log(`Grok: ${grokCandidates.length} candidates (status: ${grokStatus})`);

  // Index grok scores by tweet ID (so we can attach them to bird duplicates)
  const grokScores = new Map();
  for (const tweet of grokCandidates) {
    const id = String(tweet.id || '');
    if (id) {
      grokScores.set(id, {
        pain_score: tweet.pain_score || 0,
        reply_opportunity: tweet.reply_opportunity || 0
      });
    }
  }

  // Deduplicate: bird wins on conflicts, but preserve grok scores
  const seen = new Map();

  // Add bird candidates first (primary source)
  for (const tweet of birdCandidates) {
    const id = String(tweet.id || '');
    if (id) {
      const scores = grokScores.get(id) || {};
      seen.set(id, {
        ...tweet,
        _source: tweet._source || 'bird',
        pain_score: scores.pain_score || tweet.pain_score || 0,
        reply_opportunity: scores.reply_opportunity || tweet.reply_opportunity || 0
      });
    }
  }

  // Add grok candidates (only if not already present)
  let grokAdded = 0;
  for (const tweet of grokCandidates) {
    const id = String(tweet.id || '');
    if (id && !seen.has(id)) {
      seen.set(id, { ...tweet, _source: 'grok' });
      grokAdded++;
    }
  }

  const merged = Array.from(seen.values());

  // Sort by likes descending (same as individual scanners)
  merged.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));

  console.log(`Merged: ${merged.length} unique candidates (${grokAdded} new from grok)`);

  // Output
  const result = {
    mode: birdData.mode || 'unknown',
    timestamp: new Date().toISOString(),
    sources: {
      bird: { count: birdCandidates.length, status: 'ok' },
      grok: { count: grokCandidates.length, added: grokAdded, status: grokStatus }
    },
    query_count: birdData.query_count || 0,
    successful_queries: birdData.successful_queries || 0,
    failed_queries: birdData.failed_queries || 0,
    tweet_count: merged.length,
    candidates: merged
  };

  const dir = path.dirname(outputFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

  console.log(`Output: ${outputFile}`);
}

main();
