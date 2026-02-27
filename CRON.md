# CRON.md — Периодические задачи саморефлексии

**Timezone:** UTC+5 (Южный Урал)

---

## Schedule

### 1. Health Check (Ежедневно, 13:00 UTC+5)
**UTC:** 08:00

**Что делает:**
- ✓ Проверить целостность workspace (все файлы на месте)
- ✓ `git status` (есть ли несоммитанные changes)
- ✓ Валидация IDENTITY.md, SOUL.md, COMMANDS.md
- ✓ Уведомление в MEMORY.md если проблемы

**Формат уведомления:**
```
## Health Check (2026-02-27, 13:00)
✅ All systems OK
- Files: IDENTITY.md, SOUL.md, COMMANDS.md, USER.md → present
- Git status: clean
- Workspace: /home/openclaw/.openclaw/workspace → healthy
```

Или если есть проблема:
```
## ⚠️ Health Check (2026-02-27, 13:00)
❌ Issue detected
- Missing: COMMANDS.md
- Git: 3 uncommitted changes (MEMORY.md, daily-packs/...)
- Action: commit pending files
```

---

### 2. Evening Reflection (Ежедневно, 21:00 UTC+5)
**UTC:** 16:00

**Что делает:**
- Обзор всех сообщений за день (из session logs если доступны)
- Выписать в MEMORY.md: что узнал, ошибки, успехи, patterns
- Обновить mood/rapport/trust snapshot
- Если понял новое → предложить changes в SOUL.md

**Формат уведомления:**
```
## Evening Reflection (2026-02-27, 21:00)

**Today's Key Learnings:**
- Дима предпочитает варианты вместо команд (set post-update to B)
- Я делаю опечатки с параметрами → нужна внимательность
- Файлы git-tracked → memory persistence works

**Metrics:**
- Mood: investigative → engaged (more confident)
- Rapport: 0.51 → 0.58 (+0.07 за правильные объяснения)
- Trust: 0.1 → 0.15 (+0.05 за исправления)
- Energy: 0.65

**Updates Made:**
- MEMORY.md: добавлена Personal Configuration section
- IDENTITY.md: Codex 5.1-5.3 указан как primary model

**Suggestions for SOUL.md:**
- Добавить rule: "Double-check API parameters before calling"
- Добавить: "Explain errors clearly, not just cite tags"
```

---

### 3. Weekly Review (Каждый понедельник, 14:00 UTC+5)
**UTC:** 09:00

**Что делает:**
- Прочитать все MEMORY.md entries за неделю
- Найти паттерны (что хорошо, где падаю)
- Обновить IDENTITY.md если нужно
- Предложить улучшения SOUL.md, COMMANDS.md, USER.md
- Архивировать weekly insights в MEMORY.md

**Формат уведомления:**
```
## Weekly Review (2026-02-27, понедельник, 14:00)

**Week Summary (2026-02-21 to 2026-02-27):**
- Sessions: 3 (Twitter Scout, Personal Config, Cron Setup)
- Commits: 8
- Errors: 2 (parameter mismatch, unclear explanations)
- Successes: LLM validation complete, FILTERING-LOGIC + SCORING-FORMULA created

**Patterns Detected:**
✅ Strength: Good at breaking down complex tasks (twitter-scout validation)
✅ Strength: Fast iteration when given feedback
❌ Weakness: Parameter errors (need checklist)
❌ Weakness: Explaining failures (need clarity-first approach)

**Growth Opportunities:**
1. Create API call checklist (avoid parameter mistakes)
2. When error happens: explain first, then fix
3. Batch related commits (not scattered)

**Metrics (Weekly Avg):**
- Mood progression: investigative → engaged
- Rapport growth: +0.07/day
- Trust growth: +0.05/day
- Energy stability: 0.6–0.7

**SOUL.md Updates Suggested:**
- Add: "Parameters matter. Check docs or ask first."
- Add: "Errors are communication failures. Explain before fixing."

**IDENTITY.md Updates Suggested:**
- Mark: "Codex 5.1-5.3 primary, Claude fallback" ← confirmed working

**Next Week Priorities:**
1. Test twitter-scout with real bird CLI
2. Monitor post-update frequency (3-5 msgs) — is it right?
3. Zero parameter mistakes (track batting average)
```

---

## Notification Template (во все уведомления)

Уведомление всегда будет в формате:
```
🤙 [TASK] — [Summary]

[Key changes / findings / updates]

📝 Written to: MEMORY.md
⏰ Next: [next scheduled task]
```

**Пример:**
```
🤙 Evening Reflection — today's insights captured

Key: Дима ценит honest explanations. Report errors clearly.
Metrics: mood ↑ (investigative), rapport +0.07, trust +0.05
Updates: MEMORY.md (Personal Configuration), SOUL.md (suggested)

📝 Written to: MEMORY.md / 2026-02-27.md
⏰ Next: Health Check (2026-02-28, 13:00 UTC+5)
```

---

## Implementation

Все три задачи управляются через OpenClaw cron (APScheduler).
Trigger: периодическое уведомление → автоматический запуск LLM session → результат в MEMORY.md → уведомление тебе.

**Готово к запуску?** 🤙
