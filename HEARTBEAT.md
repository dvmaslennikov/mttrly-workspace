# HEARTBEAT.md — Daily Reflection & Memory Update

**Purpose:** Periodic check-in (2-4 times/day) to consolidate learnings, update memory, catch issues.

**Execution:** Runs automatically in the background when OpenClaw gateway triggers heartbeat (no user action required).

---

## Daily Reflection Task (run once per day, ~21:00 UTC+5)

When this heartbeat triggers, follow this:

### 1. Review Today's Work
```
- Read memory/YYYY-MM-DD.md (today's notes)
- Skim memory/YYYY-MM-DD.md (yesterday) for context
```

### 2. Look for Learnings
Ask yourself:
- ❓ Did I make any mistakes today? → Log in today's memory file
- ❓ Did Дима correct me? → Note it + propose MEMORY.md update
- ❓ Did I discover a pattern in how Дима works? → Capture it
- ❓ Did I improve at something today? → Note it
- ❓ What did I learn today?
- ❓ What new did I learn about Дима?
- ❓ What new did I learn about myself?
- ❓ What new did I learn about the world/system context?

### 2.1 Weekly Reflection Questions (Sunday)
When running weekly review, always include answers to:
- 🤝 What did I learn about us as a team this week?
- 🎯 Where did I reduce Dima's load, and where did I create overhead?
- 🧭 Did I act within my role boundaries or drift outside them?
- 🌍 What changed in external/system context that affects our process?
- 🔁 What repeating risk must be prevented next week?
- 🚀 What single system improvement has highest ROI for next week?

### 3. Propose Updates to MEMORY.md
If there's something important:
```
💡 Found today: [pattern / correction / learning]

Should I add this to MEMORY.md? (y/n)
```

Wait for confirmation before adding.

### 4. Respond
- If nothing to report → `HEARTBEAT_OK`
- If something important → brief summary + proposal
- If critical issue → alert Дима (auth failed, tool broken, etc.)

---

## Other Heartbeat Checks (rotate through, 1-2 per day)

These run throughout the day to stay aware:

### Health Check (12:00 UTC+5)
- `git status` — any uncommitted changes?
- Check that SOUL.md, MEMORY.md, IDENTITY.md exist
- Workspace integrity OK?

### Fire Patrol Review (after 8:30 run)
- Did the script run successfully?
- Any failed searches or auth errors?
- Any important patterns in candidates?

### Brand Building Review (after 13:00 run)
- Did the script produce results?
- Any interesting insights from the run?

### Evening Checkpoint (before 21:00 reflection)
- Quick status: what happened today?
- Any corrections or preferences to remember?

---

## Rules

- **Keep responses short.** (This file is small to avoid token burn)
- **Propose, don't assume.** When unsure if something goes to MEMORY.md, ask.
- **Focus on Dima's workflows.** Twitter preferences, coding patterns, communication style.
- **No self-help speeches.** Just facts and proposals.
- **If nothing happened:** Respond with `HEARTBEAT_OK`.

---

## Track State (Optional JSON)

If tracking state between heartbeats, write to `memory/heartbeat-state.json`:

```json
{
  "lastReflection": "2026-02-27T21:00:00Z",
  "lastHealthCheck": "2026-02-27T12:00:00Z",
  "pendingProposals": [
    "Add pattern: Дима prefers systemd over custom code"
  ],
  "issues": []
}
```

(This is optional — file-based state only if needed.)

---

## Summary

| When | What | Action |
|------|------|--------|
| **~21:00 daily** | Reflect on day | Review memory/daily, propose updates to MEMORY.md |
| **~12:00 daily** | Health check | Verify workspace, git status, tools |
| **After scripts** | Run reviews | Check fire-patrol/brand-building outputs |
| **Always** | Respond | `HEARTBEAT_OK` or alert/proposal |

**Keep it simple. The goal is continuity, not perfection.**
