# OpenClaw Upgrade Runbook (2026-02-28)

## Goal
Safely upgrade OpenClaw to latest stable and preserve current working setup (Telegram + cron + twitter-scout pipeline + model controls).

## Important Context
- Current workflow relies on **crontab only** (no systemd timers).
- Timezone must stay: `Asia/Yekaterinburg`.
- Model behavior must remain controlled (no unwanted auto-switches).
- If restart interrupts chat context, resume from this file.

---

## Phase 0 — Pre-flight Snapshot (mandatory)

Run and save outputs:

```bash
openclaw --version
openclaw status
crontab -l
git -C /home/openclaw/.openclaw/workspace status --short
```

Backup critical config:

```bash
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak-$(date +%F-%H%M%S)
crontab -l > ~/.openclaw/crontab.bak-$(date +%F-%H%M%S).txt
```

Optional: snapshot current scout scripts

```bash
cp /home/openclaw/.openclaw/workspace/playbooks/twitter-scout/scripts/process-digest.js \
   /home/openclaw/.openclaw/workspace/playbooks/twitter-scout/scripts/process-digest.js.bak-$(date +%F-%H%M%S)
cp /home/openclaw/.openclaw/workspace/playbooks/twitter-scout/scripts/scout-fire-patrol.sh \
   /home/openclaw/.openclaw/workspace/playbooks/twitter-scout/scripts/scout-fire-patrol.sh.bak-$(date +%F-%H%M%S)
```

---

## Phase 1 — Upgrade

Use your existing installation method for OpenClaw and upgrade to latest stable.

After install:

```bash
openclaw --version
```

Expected: `2026.2.26` or newer.

---

## Phase 2 — Restart & Immediate Health

Restart gateway once (your standard method), then run:

```bash
openclaw status
```

Check:
- Gateway is running
- No crash loop
- No auth/config validation failures

---

## Phase 3 — Post-Upgrade Verification Checklist

### A) Core

```bash
openclaw --version
openclaw status
```

### B) Cron integrity (must remain crontab-only)

```bash
crontab -l
```

Expected entries:
- `TZ=Asia/Yekaterinburg`
- `08:30 fire-patrol`
- `13:00 brand-building`
- `17:30 fire-patrol`

### C) No systemd timer drift

```bash
systemctl --user list-timers | grep -E 'fire-patrol|brand-building' || true
```

Expected: nothing active for these jobs.

### D) Telegram delivery sanity
- Send one test reply in this chat and ensure it is delivered.

### E) Model control sanity
- Confirm active model in-session (`/status` / session status card).
- Ensure no unexpected model switch events.

### F) Twitter scout sanity (single manual run)

```bash
cd /home/openclaw/.openclaw/workspace/playbooks/twitter-scout
bash scripts/run-scout.sh fire-patrol
```

Expected:
- candidate file generated in `daily-packs/`
- digest processed
- Telegram digest sent

---

## Phase 4 — Acceptance Criteria

Upgrade is accepted only if all are true:
- OpenClaw version updated
- Gateway stable (no loop)
- crontab unchanged and active
- no systemd timer duplication
- Telegram replies work
- scout manual run succeeds end-to-end
- no unexpected model switching behavior

---

## Rollback Plan

If critical failure appears:
1. Restore previous binary/package version.
2. Restore config backup:
   ```bash
   cp ~/.openclaw/openclaw.json.bak-<timestamp> ~/.openclaw/openclaw.json
   ```
3. Restore crontab backup:
   ```bash
   crontab ~/.openclaw/crontab.bak-<timestamp>.txt
   ```
4. Restart gateway.
5. Re-run Phase 3 checks.

---

## Resume Protocol After Restart

If chat context is lost after restart, send:

> "Продолжай по UPGRADE-RUNBOOK-2026-02-28.md, Phase X"

Agent should resume from file, not memory.
