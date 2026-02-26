# Cron Setup для Twitter Engagement

## Время

- **6:30 MSK** → 8:30 UTC → 13:30 UTC+5 (Оренбург/Уфа)
- **17:30 MSK** → 14:30 UTC → 19:30 UTC+5

(Используем UTC для стабильности cron)

## Расписание

```cron
# Утро: 6:30 MSK (3:30 UTC)
30 3 * * * cd /home/openclaw/.openclaw/workspace && node playbooks/twitter/x-search-and-reply.js morning >> /tmp/x-engagement-morning.log 2>&1

# Вечер: 17:30 MSK (14:30 UTC)
30 14 * * * cd /home/openclaw/.openclaw/workspace && node playbooks/twitter/x-search-and-reply.js evening >> /tmp/x-engagement-evening.log 2>&1

# Еженедельный отчёт: пн 6:30 MSK (3:30 UTC)
30 3 * * 1 cd /home/openclaw/.openclaw/workspace && node playbooks/twitter/x-smart-read-weekly.js >> /tmp/x-weekly.log 2>&1
```

## Установка в OpenClaw

✅ **Уже добавлено в openclaw.json!**

Jobs содержат:

```json
{
  "jobs": [
    {
      "schedule": "30 3 * * *",
      "name": "x-engagement-morning",
      "command": "cd /home/openclaw/.openclaw/workspace && source .openclaw/.env.bird && node playbooks/twitter/x-search-and-reply-bird.js morning"
    },
    {
      "schedule": "30 14 * * *",
      "name": "x-engagement-evening",
      "command": "cd /home/openclaw/.openclaw/workspace && source .openclaw/.env.bird && node playbooks/twitter/x-search-and-reply-bird.js evening"
    },
    {
      "schedule": "30 3 * * 1",
      "name": "x-weekly-report",
      "command": "cd /home/openclaw/.openclaw/workspace && node playbooks/twitter/x-smart-read-weekly.js"
    }
  ]
}
```

**Важно:** каждая task sourсит `.env.bird` чтобы получить BIRD_AUTH_TOKEN и BIRD_CT0

## Environment Variables

В `~/.openclaw/.env` или systemd unit:

```bash
# Когда будут готовы:
export TELEGRAM_BOT_TOKEN="..."
export TELEGRAM_CHAT_ID="..."
export COMPOSIO_API_KEY="..."  # когда Дима зарегистрируется
```

## Logrotate (опционально)

```
/tmp/x-engagement-*.log
/tmp/x-weekly.log
{
  daily
  rotate 7
  compress
  delaycompress
  missingok
  notifempty
}
```

## Статус

- ✅ Скрипты готовы (`x-search-and-reply.js`, `send-to-telegram.js`)
- ⏳ Нужны: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
- ⏳ Нужны: COMPOSIO_API_KEY (когда Дима зарегистрируется)
- ⏳ Нужен: `x-smart-read-weekly.js` (для еженедельного отчета)
