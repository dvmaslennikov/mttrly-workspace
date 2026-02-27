# CRON-SCHEDULE.md — Полное расписание задач

**Последнее обновление:** 2026-02-27 (Дима + Claude Opus)

---

## Timezone: UTC+5 (Asia/Yekaterinburg)

Дима живёт на Южном Урале. Все времена — по UTC+5.

---

## Две системы запуска

### 1. Crontab (юзер `openclaw`) — bash-скрипты

Проверить: `crontab -l`

| Время (UTC+5) | День | Задача | Скрипт |
|---|---|---|---|
| 08:30 | ежедневно | Fire Patrol (утро) | `run-scout.sh fire-patrol` |
| 13:00 | ежедневно | Brand Building | `run-scout.sh brand-building` |
| 17:30 | ежедневно | Fire Patrol (вечер) | `run-scout.sh fire-patrol` |
| 07:00 | понедельник | Weekly Analytics | `x-smart-read-weekly.js` |

### 2. OpenClaw Gateway (APScheduler) — LLM-сессии

Эти задачи запускаются через gateway как LLM-сессии (не bash). Описание в CRON.md и HEARTBEAT.md.

| Время (UTC+5) | День | Задача | Описание |
|---|---|---|---|
| 12:00 | ежедневно | Health Check | Целостность workspace, git status, валидация файлов |
| 21:00 | ежедневно | Daily Reflection | Обзор дня, learnings, mood/rapport/trust, предложения в MEMORY.md |
| 11:00 | воскресенье | Weekly Review | Паттерны за неделю, рост, приоритеты, предложения в SOUL.md |

Конфиг: `~/.openclaw/cron/jobs.json`
Инструкции: CRON.md (шаблоны), HEARTBEAT.md (протокол)

---

## Pipeline crontab-задач

```
crontab (UTC+5)
  → run-scout.sh [mode]
    → scout-fire-patrol.sh / scout-brand-building.sh (bird CLI → собирает твиты)
    → process-digest.js (фильтрует → скорит → вызывает LLM → генерит replies)
    → отправляет Telegram дайджест Диме
    → сохраняет JSON в daily-packs/
```

### Файлы скриптов

**Twitter Scout** (`playbooks/twitter-scout/scripts/`):

| Файл | Что делает |
|---|---|
| `run-scout.sh` | Обёртка: логирование, env, вызов скрипта + digest |
| `scout-fire-patrol.sh` | 10 queries по pain points (server down, 502, aws bill...) |
| `scout-brand-building.sh` | 10 queries по трендам (vibe coding, indie hackers...) |
| `process-digest.js` | Фильтрация, скоринг, LLM replies, Telegram отправка |

**Аналитика** (`playbooks/twitter/`):

| Файл | Что делает |
|---|---|
| `x-smart-read-weekly.js` | Еженедельный отчёт: impressions, engagements, followers, budget |

### Выходные файлы

| Файл | Где |
|---|---|
| Логи scout | `playbooks/twitter-scout/logs/scout-[mode]-YYYY-MM-DD_HH-MM-SS.log` |
| Кандидаты (сырые) | `[mode]-candidates-YYYY-MM-DDTHH:MM:SSZ.json` |
| Дайджест (финальный) | `daily-packs/[mode]-digest-YYYY-MM-DD.json` |
| Логи weekly | `logs/twitter/weekly-YYYYMMDD.log` |

Старые candidates-файлы автоматически удаляются через 3 дня.

---

## Правила

1. **НЕ трогай crontab** без явной команды от Димы
2. **НЕ добавляй systemd timers** — используем только crontab (systemd timers удалены 2026-02-27)
3. **НЕ меняй timezone** — UTC+5 (Asia/Yekaterinburg) зафиксирован
4. **НЕ запускай скрипты вручную** без просьбы Димы
5. **НЕ удаляй задачи** из крона без явного разрешения Димы
6. Если крон сломался — сообщи Диме, не чини сам

---

## Диагностика

```bash
# Проверить расписание
crontab -l

# Посмотреть последний лог
ls -lt playbooks/twitter-scout/logs/ | head -5

# Посмотреть последний дайджест
ls -lt daily-packs/*digest* | head -5

# Проверить что bird CLI работает
source ~/.openclaw/.env.bird && npx bird whoami

# Gateway cron jobs
cat ~/.openclaw/cron/jobs.json
```
