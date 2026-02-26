/**
 * Send digest to Telegram
 */

const https = require('https');
const fs = require('fs');

async function sendToTelegram(message) {
  // Пока mock (Telegram уже интегрирован через OpenClaw)
  // Когда Дима даст bot token + chat id, будет реальная отправка
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN || 'PENDING';
  const chatId = process.env.TELEGRAM_CHAT_ID || 'PENDING';
  
  console.log('[TELEGRAM] Sending digest...');
  console.log(`Token: ${botToken === 'PENDING' ? 'PENDING' : 'OK'}`);
  console.log(`Chat ID: ${chatId === 'PENDING' ? 'PENDING' : 'OK'}\n`);
  
  if (botToken === 'PENDING' || chatId === 'PENDING') {
    console.log('[INFO] Telegram not configured yet');
    console.log('Waiting for Dima to provide TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID\n');
    return;
  }
  
  // Реальная отправка
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const data = JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML'
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
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('[OK] Telegram message sent');
          resolve(true);
        } else {
          console.log(`[ERROR] Telegram returned ${res.statusCode}`);
          console.log(body);
          reject(new Error(body));
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Usage
const args = process.argv.slice(2);
const digestFile = args[0] || '/home/openclaw/.openclaw/workspace/daily-packs/digest-latest.txt';

if (fs.existsSync(digestFile)) {
  const digest = fs.readFileSync(digestFile, 'utf8');
  sendToTelegram(digest).catch(e => {
    console.error(e.message);
    process.exit(1);
  });
} else {
  console.log(`[ERROR] File not found: ${digestFile}`);
  process.exit(1);
}
