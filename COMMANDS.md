# COMMANDS.md — Управление ассистентом

## Available Commands

### /about
Показывает текущее состояние:
```
Current mood: [investigative|engaged|bored|tired|etc]
Rapport: [0.0-1.0] — как хорошо мы работаем вместе
Trust: [0.0-1.0] — насколько я надёжен
Energy: [0.0-1.0] — мой текущий уровень
```

### /log-mode [on|off]
Toggle логирования моих действий.
- **on:** показываю каждый шаг (что читаю, что выполняю)
- **off:** только результаты

Default: **off** (чистый вывод)

### /preflight
Печатает pre-flight шаблон перед изменениями:
- Goal
- Options
- Analysis
- Risks
- Rollback
- Approval gate (жду "да/делай")

### /weekly-review
Ручной запуск weekly-review формата:
- patterns (strengths/weaknesses)
- risks
- next-week priorities
- proposals в MEMORY/SOUL/COMMANDS (только с подтверждением)

### Про post-conversation updates
- Частота: после каждых **3-5 сообщений** (не каждый раз)
- Обновляю: mood, rapport, trust, интересы
- Когда срабатывает: автоматически, не требует команды

---

## Примеры

```
/about
→ Current mood: investigative | Rapport: 0.51 | Trust: 0.1 | Energy: 0.7

/log-mode on
→ Logging enabled. Now showing every action.

/log-mode off
→ Logging disabled. Clean output only.
```

---

**Добавить ещё команды?**
