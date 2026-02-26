# Twitter Engagement Engine — mttrly

**Цель:** Найти и подготовить контент для ручного engagement на @mttrly_  
**Статус:** 🔨 В разработке (Playwright + later Composio)  
**Расписание:** 6:30 MSK + 17:30 MSK (автоматический поиск → дайджест в Telegram)

## Статус внедрения

| Что | Статус | Файл |
|-----|--------|------|
| bird CLI поиск | ✅ Готово | bird-digest.sh |
| Фильтрация + ranking | ✅ Готово | x-search-and-reply-bird.js |
| Генерация реплаев | ✅ Готово | x-search-and-reply-bird.js |
| Трекинг (дедупликация) | ✅ Готово | data/x-engagement-tracking.md |
| Дайджест (ГОРЯЧЕЕ/ХОРОШЕЕ/МОНИТОРИНГ) | ✅ Готово | x-search-and-reply-bird.js |
| Cron 6:30 + 17:30 MSK | ✅ Готово | openclaw.json (jobs) |
| x-smart-read-weekly.js | ✅ Готово (skeleton) | x-smart-read-weekly.js |
| Telegram отправка | ⏳ Нужны bot token + chat id | send-to-telegram.js |
| Composio (optional future) | ⏳ Не нужен (bird бесплатен) | - |

## Что дальше (Ready to Deploy)

1. ✅ **bird CLI установлен** на VPS
2. ✅ **Cookies получены** (auth_token + ct0 в .env.bird)
3. ✅ **bird-digest.sh** готов (4 категории + watchlist)
4. ✅ **x-search-and-reply-bird.js** готов (filter + rank + replies)
5. ✅ **Cron jobs** добавлены в openclaw.json (6:30 + 17:30 MSK)
6. ⏳ **Telegram integration** — нужны bot token + chat id (использовать send-to-telegram.js)
7. 🧪 **Тестирование** — запустить bird-digest.sh вручную, проверить outputs
8. 📊 **x-smart-read** — опционально, когда захочешь аналитику своего аккаунта

## Timeline

```
❌ Composio (не нужен — используем bird)
✅ bird CLI (установлен, работает)
✅ Architecture (done)
✅ Cron (done)
⏳ Telegram (bot token needed)
🧪 Test run
📱 Go live
```

## Файлы проекта

### 📚 Стратегия
- `gilfoyle-mode.md` — Persona + Tone + Примеры реплаев
- `query-fanout.md` — 4 категории поиска (pain, audience, competitors, community)
- `response-policy.md` — Правила: value/promo = 90/10, no spam, только organic
- `CRON-SETUP.md` — Расписание (6:30 + 17:30 MSK), установка

### 🔧 Код
- `x-search-and-reply.js` — Поиск → фильтр → генерация реплаев → дайджест
- `send-to-telegram.js` — Отправка дайджеста в Telegram (когда bot token будет)
- `x-smart-read-weekly.js` — ⏳ TODO: еженедельный отчёт (аналитика)

### 📊 Данные
- `../../../data/x-engagement-tracking.md` — Трекинг replied/skipped (дедупликация)
- `../../../daily-packs/` — Сохранённые дайджесты
