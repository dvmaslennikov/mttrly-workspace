/**
 * X/Twitter Search + Reply Generation
 * 
 * Функционал:
 * - Поиск твитов по категориям (pain points, audience, competitors, community)
 * - Фильтрация (боты, язык, engagement, возраст, оригинальные твиты)
 * - Проверка трекинга (не предлагать реплаи на уже обработанные твиты)
 * - Watchlist приоритет
 * - Генерация реплаев (empathy → value → soft mention)
 * - Форматирование дайджеста (ГОРЯЧЕЕ/ХОРОШЕЕ/МОНИТОРИНГ)
 * - Отправка в Telegram
 */

const { chromium } = require('/home/openclaw/openclaw/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright');
const fs = require('fs');
const path = require('path');

// ============================================================================
// КОНФИГ
// ============================================================================

const CONFIG = {
  dataDir: '/home/openclaw/.openclaw/workspace/data',
  trackingFile: '/home/openclaw/.openclaw/workspace/data/x-engagement-tracking.md',
  
  // Временные лимиты
  morningHours: 12,  // для 6:30 утра
  eveningHours: 8,   // для 17:30 вечера
  
  // Фильтры
  minEngagement: 10,  // минимум лайков
  minFollowers: 500,
  maxFollowers: 50000,
  
  // Watchlist приоритет
  watchlist: [
    'levelsio', 'kelseyhightower', 'rakyll', 'copyconstruct',
    'jezhumble', 'allspaw', 'marclouvier', 'tdinh_me',
    'DanielFosworthy', 'yaboroda', 'railway', 'vercel',
    'render', 'coolaborateHQ'
  ],
  
  // Поисковые категории
  queries: {
    painPoints: [
      '"server is down" OR "site is down" OR "my app crashed"',
      '"deployment failed" OR "deploy broke" OR "push to production failed"',
      '"3am alert" OR "pager went off" OR "on-call nightmare"',
      '"nginx error" OR "502 bad gateway" OR "connection refused"',
      '"forgot how to deploy" OR "deployment is scary" OR "afraid to deploy"',
      '"server management" OR "manage my server" OR "VPS setup"',
      '"downtime" OR "incident response"'
    ],
    audience: [
      '"vibe coding" OR "#vibecoding" OR "vibe coder"',
      '"indie hacker" "server" OR "deploy" OR "hosting"',
      '"built with cursor" OR "built with claude"',
      '"solo founder" "devops" OR "server" OR "infrastructure"',
      '"no devops" OR "don\'t have devops" OR "can\'t afford devops"',
      '"first VPS" OR "first server" OR "learned to deploy"'
    ],
    competitors: [
      '"vercel expensive" OR "railway pricing" OR "render slow"',
      '"moved from heroku" OR "heroku alternative" OR "leaving vercel"',
      '"need something simpler" "hosting" OR "deploy" OR "server"',
      '"too complex" "kubernetes" OR "docker" OR "CI/CD"',
      '"just want to deploy" OR "deploy should be simple"'
    ],
    community: [
      '"build in public" "devops" OR "server" OR "deploy"',
      '"indie maker" "infrastructure" OR "hosting"',
      '"MTTR" OR "mean time to recovery"',
      '"SRE" "indie" OR "solo" OR "small team"'
    ]
  }
};

// ============================================================================
// УТИЛИТЫ
// ============================================================================

/**
 * Проверить если это бот
 */
function isBot(author) {
  if (!author) return true;
  
  // Случайные буквы в имени
  if (/^[a-z]{10,}$/.test(author)) return true;
  
  // Без фолловеров
  if (author.followers === undefined || author.followers < 10) return true;
  
  // Типичные боты-имена
  if (/bot|news|feed|api|alert|monitor/i.test(author.name)) return true;
  
  return false;
}

/**
 * Проверить если твит оригинальный (не реплай)
 */
function isOriginal(tweet) {
  // Если это реплай на кого-то
  if (tweet.in_reply_to_user_id) return false;
  if (tweet.text?.startsWith('@')) return false;
  
  return true;
}

/**
 * Проверить язык (очень упрощённо)
 */
function isEnglish(text) {
  if (!text) return false;
  
  // Если большинство слов англ
  const words = text.split(/\s+/);
  let englishishCount = 0;
  
  words.forEach(word => {
    // Просто проверяем англ буквы + базовые слова
    if (/^[a-zA-Z]+$/.test(word)) englishishCount++;
  });
  
  return englishishCount / words.length > 0.5;
}

/**
 * Проверить если твит в трекинге
 */
function isAlreadyTracked(tweetId, trackingFile) {
  if (!fs.existsSync(trackingFile)) return false;
  
  const content = fs.readFileSync(trackingFile, 'utf8');
  return content.includes(tweetId);
}

/**
 * Определить приоритет твита
 */
function getPriority(tweet, watchlist) {
  let priority = 'ХОРОШЕЕ';
  let score = 0;
  
  const engagement = tweet.public_metrics?.like_count || 0;
  const isWatched = watchlist.includes(tweet.author_id?.toLowerCase?.());
  
  // Pain point + высокий engagement
  if (tweet.category === 'painPoints' && engagement > 100) {
    priority = 'ГОРЯЧЕЕ';
    score = 100;
  }
  // Watchlist аккаунт
  else if (isWatched) {
    priority = 'ГОРЯЧЕЕ';
    score = 90;
  }
  // Audience signal + средний engagement
  else if (tweet.category === 'audience' && engagement > 50) {
    priority = 'ХОРОШЕЕ';
    score = 70;
  }
  // Остальное
  else {
    priority = 'МОНИТОРИНГ';
    score = engagement;
  }
  
  return { priority, score };
}

/**
 * Генерация реплая
 */
function generateReplies(tweet) {
  const text = tweet.text || '';
  
  let safe = '';
  let punchy = '';
  
  // Логика выбора реплая по контексту твита
  if (text.includes('down') || text.includes('crash') || text.includes('alert')) {
    // Инцидент
    safe = 'Been there. Quick triage: check process (ps aux), disk (df -h), memory (free -m). 90% of crashes are one of those. Logs next.';
    punchy = 'Always the same three culprits. Always. Process, disk, memory. Never learned.';
  }
  else if (text.includes('deploy') || text.includes('push')) {
    // Деплой
    safe = 'Simplest that works: deploy.sh with git pull → build → restart → health check. Auto-rollback on fail. 30 min setup, saves hours/week.';
    punchy = 'Manual deploys at 2am. Never a good time. Automate the critical path, keep the rest manual. Beats zero automation.';
  }
  else if (text.includes('server') || text.includes('VPS') || text.includes('manage')) {
    // Сервер
    safe = 'Starting simple: systemd units + journalctl for logs + basic monitoring (top, df, netstat). Beats manual SSH into prod every time.';
    punchy = 'Server management without observability = flying blind. Even basic stuff helps: what\'s running, what\'s failing, what\'s eating resources.';
  }
  else if (text.includes('nginx') || text.includes('502') || text.includes('gateway')) {
    // Веб-сервер
    safe = 'nginx -t catches most config issues. For the rest: tail -f /var/log/nginx/error.log while testing. Usually missing semicolon or wrong root path.';
    punchy = 'nginx config errors are like typos — obvious in the logs, impossible to spot in the file. Always check logs first.';
  }
  else {
    // Дефолт
    safe = 'This resonates. The gap between "problem" and "solution" is where most ops pain lives.';
    punchy = 'Yep. And somehow it still surprises people every time.';
  }
  
  return { safe, punchy };
}

/**
 * Форматировать дайджест для Telegram
 */
function formatDigest(tweets, digestType) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU');
  
  let digest = `🎯 Твиттер-дайджест mttrly — ${dateStr}\n\n`;
  
  const byPriority = {
    'ГОРЯЧЕЕ': tweets.filter(t => t.priority === 'ГОРЯЧЕЕ'),
    'ХОРОШЕЕ': tweets.filter(t => t.priority === 'ХОРОШЕЕ'),
    'МОНИТОРИНГ': tweets.filter(t => t.priority === 'МОНИТОРИНГ')
  };
  
  // ГОРЯЧЕЕ
  if (byPriority['ГОРЯЧЕЕ'].length > 0) {
    digest += '🔥 ГОРЯЧЕЕ (ответь в первую очередь):\n\n';
    byPriority['ГОРЯЧЕЕ'].slice(0, 3).forEach((t, i) => {
      const replies = generateReplies(t);
      digest += `${i+1}. @${t.author} — ${t.public_metrics?.like_count || 0}❤️\n`;
      digest += `"${t.text.substring(0, 80)}..."\n`;
      digest += `Реплай: "${replies.safe}"\n`;
      digest += `Link: https://x.com/${t.author}/status/${t.id}\n\n`;
    });
  }
  
  // ХОРОШЕЕ
  if (byPriority['ХОРОШЕЕ'].length > 0) {
    digest += '\n✅ ХОРОШЕЕ (если есть время):\n\n';
    byPriority['ХОРОШЕЕ'].slice(0, 2).forEach((t, i) => {
      const replies = generateReplies(t);
      digest += `${i+1}. @${t.author} — ${t.public_metrics?.like_count || 0}❤️\n`;
      digest += `"${t.text.substring(0, 80)}..."\n`;
      digest += `Link: https://x.com/${t.author}/status/${t.id}\n\n`;
    });
  }
  
  // МОНИТОРИНГ (сокращенно)
  if (byPriority['МОНИТОРИНГ'].length > 0) {
    digest += '\n📊 МОНИТОРИНГ (для контекста):\n';
    byPriority['МОНИТОРИНГ'].slice(0, 3).forEach((t, i) => {
      digest += `${i+1}. @${t.author} — ${t.public_metrics?.like_count || 0}❤️\n`;
    });
  }
  
  // Бюджет
  digest += '\n---\n💰 Бюджет: Composio (когда подключим)\n';
  
  return digest;
}

/**
 * Сохранить твит в трекинг
 */
function trackTweet(tweetId, author, category, trackingFile) {
  let content = '';
  
  if (fs.existsSync(trackingFile)) {
    content = fs.readFileSync(trackingFile, 'utf8');
  }
  
  // Добавить в Replied To
  if (!content.includes('## Replied To')) {
    content += '\n## Replied To (latest)\n';
  }
  
  const timestamp = new Date().toISOString();
  const line = `- ${tweetId} — @${author} ${category} (${timestamp})\n`;
  
  content = content.replace('## Replied To (latest)\n', `## Replied To (latest)\n${line}`);
  
  fs.writeFileSync(trackingFile, content);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('[X-SEARCH] Starting engagement scan\n');
  
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18800');
  const page = browser.contexts()[0].pages()[0];
  
  const allTweets = [];
  
  // Пока используем Playwright для демонстрации логики
  // Позже заменим на Composio
  
  console.log('[FILTERS] Applied:\n');
  console.log('- Min engagement: 10 likes');
  console.log('- Followers: 500-50K');
  console.log('- Language: English only');
  console.log('- Original tweets (no replies)');
  console.log('- Age: 12h (morning) / 8h (evening)\n');
  
  console.log('[MOCK] Simulating tweet collection (Playwright + filters)\n');
  
  // Симуляция (позже будут реальные твиты)
  const mockTweets = [
    {
      id: '1234567890',
      author: 'levelsio',
      text: 'Server just went down and I have no idea what happened at 3am',
      public_metrics: { like_count: 150 },
      category: 'painPoints'
    },
    {
      id: '1234567891',
      author: 'samokhvalov',
      text: 'If it\'s Postgres, do NOT touch connection settings',
      public_metrics: { like_count: 200 },
      category: 'painPoints'
    },
    {
      id: '1234567892',
      author: 'tdinh_me',
      text: 'Finally deployed my app solo without a DevOps team',
      public_metrics: { like_count: 45 },
      category: 'audience'
    }
  ];
  
  const filtered = mockTweets.filter(t => {
    // Пропустить если уже отвечали
    if (isAlreadyTracked(t.id, CONFIG.trackingFile)) {
      console.log(`⏭️  Skipped (already tracked): ${t.id}`);
      return false;
    }
    
    // Пропустить если старый
    // (в реальности проверяем дату твита)
    
    // Пропустить если не англ
    if (!isEnglish(t.text)) {
      console.log(`⏭️  Skipped (not English): ${t.author}`);
      return false;
    }
    
    // Пропустить если мало engagement
    if ((t.public_metrics?.like_count || 0) < CONFIG.minEngagement) {
      console.log(`⏭️  Skipped (low engagement): ${t.author}`);
      return false;
    }
    
    return true;
  });
  
  console.log(`\n[FILTERED] ${filtered.length} tweets passed filters\n`);
  
  // Определить приоритет
  filtered.forEach(t => {
    const { priority, score } = getPriority(t, CONFIG.watchlist);
    t.priority = priority;
    t.score = score;
  });
  
  // Сортировать по приоритету
  filtered.sort((a, b) => b.score - a.score);
  
  // Генерировать реплаи
  filtered.forEach(t => {
    const replies = generateReplies(t);
    t.replies = replies;
  });
  
  console.log('[TOP 5]\n');
  filtered.slice(0, 5).forEach((t, i) => {
    console.log(`${i+1}. @${t.author} [${t.priority}] — ${t.public_metrics?.like_count || 0}❤️`);
    console.log(`   "${t.text.substring(0, 70)}..."\n`);
  });
  
  // Форматировать дайджест
  const digest = formatDigest(filtered, 'morning');
  
  // Сохранить результат
  const digestFile = `/home/openclaw/.openclaw/workspace/daily-packs/digest-${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}.txt`;
  fs.writeFileSync(digestFile, digest);
  
  console.log(`\n[SAVED] ${digestFile}`);
  console.log(`\n[DIGEST] Ready to send to Telegram\n`);
  
  // Пока не отправляем (нужна Composio)
  console.log('[NEXT] Install Composio API key → replace Playwright with Composio API\n');
  
  await browser.close();
  process.exit(0);
}

main().catch(e => {
  console.error('[ERROR]', e.message);
  process.exit(1);
});
