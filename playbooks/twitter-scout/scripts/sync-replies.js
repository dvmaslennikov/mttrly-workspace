#!/usr/bin/env node

/**
 * sync-replies.js — Auto-track which digest tweets @mttrly_ actually replied to
 *
 * Searches for recent tweets from @mttrly_, cross-references with "Seen In Digest"
 * in x-engagement-tracking.md, and moves matched entries to "Replied To".
 *
 * Also rotates old "Seen In Digest" entries (>14 days).
 *
 * Usage: node sync-replies.js
 * Cron: run once daily before first scout (e.g., 08:00)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE_DIR = path.resolve(__dirname, '../../..');
const DATA_DIR = path.join(WORKSPACE_DIR, 'data');
const TRACKING_FILE = path.join(DATA_DIR, 'x-engagement-tracking.md');
const BIRD_CLI = path.join(WORKSPACE_DIR, 'node_modules/@steipete/bird/dist/cli.js');
const MTTRLY_HANDLE = 'mttrly_';
const SEEN_MAX_AGE_DAYS = 14;

function loadEnv() {
  const envFile = path.join(WORKSPACE_DIR, '..', '..', '.env.bird');
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

function fetchMttrlyReplies() {
  try {
    const result = execSync(
      `node "${BIRD_CLI}" search "from:${MTTRLY_HANDLE}" -n 50 --json`,
      { timeout: 60000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return JSON.parse(result);
  } catch (err) {
    console.error('Failed to fetch @mttrly_ tweets:', err.message);
    return [];
  }
}

function main() {
  loadEnv();

  console.log('=== SYNC REPLIES ===');
  console.log(`Tracking file: ${TRACKING_FILE}`);

  if (!fs.existsSync(TRACKING_FILE)) {
    console.log('No tracking file found. Nothing to sync.');
    return;
  }

  // 1. Fetch recent @mttrly_ tweets
  const tweets = fetchMttrlyReplies();
  const replies = tweets.filter(t => t.inReplyToStatusId);
  console.log(`Fetched ${tweets.length} tweets, ${replies.length} are replies`);

  // Build map: inReplyToStatusId → reply info
  const replyMap = {};
  for (const t of replies) {
    replyMap[t.inReplyToStatusId] = {
      replyId: t.id,
      date: t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      text: (t.text || '').substring(0, 80)
    };
  }

  // 2. Parse tracking file
  const content = fs.readFileSync(TRACKING_FILE, 'utf8');
  const lines = content.split('\n');

  const sections = { before: [], repliedTo: [], seen: [], after: [] };
  let currentSection = 'before';

  for (const line of lines) {
    if (line.startsWith('## Replied To')) {
      currentSection = 'repliedTo';
      sections.repliedTo.push(line);
      continue;
    }
    if (line.startsWith('## Seen In Digest')) {
      currentSection = 'seen';
      sections.seen.push(line);
      continue;
    }
    if (line.startsWith('## ') && (currentSection === 'repliedTo' || currentSection === 'seen')) {
      currentSection = 'after';
    }
    sections[currentSection].push(line);
  }

  // 3. Process "Seen In Digest" — move matched to "Replied To", rotate old
  const today = new Date();
  const newSeen = [sections.seen[0]]; // Keep header
  const newReplied = [];
  let matchCount = 0;
  let rotatedCount = 0;

  for (let i = 1; i < sections.seen.length; i++) {
    const line = sections.seen[i];
    const match = line.match(/^- (\d+)\s*—\s*(\S+)\s*\((\d{4}-\d{2}-\d{2})\)/);

    if (!match) {
      // Keep non-entry lines (like "(none yet)")
      if (line.trim() !== '(none yet)') newSeen.push(line);
      continue;
    }

    const tweetId = match[1];
    const mode = match[2];
    const dateStr = match[3];

    // Check if we replied to this tweet
    if (replyMap[tweetId]) {
      const r = replyMap[tweetId];
      newReplied.push(`- ${tweetId} — @${MTTRLY_HANDLE} replied (${r.date}) — ${mode}`);
      matchCount++;
      continue;
    }

    // Rotate old entries
    const entryDate = new Date(dateStr);
    const ageDays = (today - entryDate) / (1000 * 60 * 60 * 24);
    if (ageDays > SEEN_MAX_AGE_DAYS) {
      rotatedCount++;
      continue;
    }

    newSeen.push(line);
  }

  // 4. Rebuild tracking file
  // Merge new replied entries into existing Replied To section
  const repliedSection = [...sections.repliedTo];
  if (newReplied.length > 0) {
    // Remove "(no replies yet)" if present
    const noRepliesIdx = repliedSection.findIndex(l => l.includes('(no replies yet)') || l.includes('(no skipped yet)'));
    if (noRepliesIdx > 0) repliedSection.splice(noRepliesIdx, 1);
    repliedSection.push(...newReplied);
  }

  // Ensure seen section has content
  if (newSeen.length <= 1) {
    newSeen.push('(none yet)');
  }

  const output = [
    ...sections.before,
    ...repliedSection,
    ...newSeen,
    ...sections.after
  ].join('\n');

  fs.writeFileSync(TRACKING_FILE, output);

  console.log(`Matched: ${matchCount} replies synced to "Replied To"`);
  console.log(`Rotated: ${rotatedCount} old "Seen In Digest" entries removed (>${SEEN_MAX_AGE_DAYS} days)`);
  console.log(`Remaining in "Seen In Digest": ${newSeen.length - 1} entries`);
  console.log('=== DONE ===');
}

main();
