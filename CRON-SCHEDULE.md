# CRON-SCHEDULE.md — Системный крон (systemd timer)

**Timezone:** UTC+5

---

## Schedule

```
8:30  UTC+5  → Fire Patrol (morning pain points)
12:00 UTC+5  → Health Check (workspace integrity)
13:00 UTC+5  → Brand Building (trends)
17:30 UTC+5  → Fire Patrol (evening pain points)
21:00 UTC+5  → Daily Reflection (learnings, mood, metrics)
вс 11:00 UTC+5 → Weekly Review (patterns, growth)
```

---

## Systemd Timers (preferred over crontab)

**Why systemd over cron:**
- Better logging (journalctl)
- Can run as specific user (openclaw)
- Easier to manage/reload
- Built-in dependency management

---

## Installation

### 1. Create timer units in `/etc/systemd/system/`

**fire-patrol-morning.timer**
```ini
[Unit]
Description=Twitter Scout Fire Patrol (morning)
After=network-online.target

[Timer]
OnCalendar=*-*-* 08:30:00
Persistent=true
Unit=fire-patrol-morning.service

[Install]
WantedBy=timers.target
```

**fire-patrol-morning.service**
```ini
[Unit]
Description=Twitter Scout Fire Patrol (morning)
After=network-online.target

[Service]
Type=oneshot
User=openclaw
WorkingDirectory=/home/openclaw/.openclaw/workspace
ExecStart=/home/openclaw/.openclaw/workspace/playbooks/twitter-scout/scripts/scout-fire-patrol.sh
StandardOutput=journal
StandardError=journal
```

### 2. Repeat for all tasks:
- `health-check.timer` + `health-check.service` (12:00)
- `brand-building.timer` + `brand-building.service` (13:00)
- `fire-patrol-evening.timer` + `fire-patrol-evening.service` (17:30)
- `daily-reflection.timer` + `daily-reflection.service` (21:00)
- `weekly-review.timer` + `weekly-review.service` (вс 11:00)

### 3. Enable and start
```bash
sudo systemctl daemon-reload
sudo systemctl enable fire-patrol-morning.timer
sudo systemctl start fire-patrol-morning.timer
sudo systemctl list-timers  # verify all running
```

### 4. View logs
```bash
journalctl -u fire-patrol-morning.service -f
journalctl -S today  # all tasks today
```

---

## Or: Simple crontab (if systemd not available)

Add to `crontab -e`:
```
30 8 * * * /home/openclaw/.openclaw/workspace/playbooks/twitter-scout/scripts/scout-fire-patrol.sh >> /home/openclaw/.openclaw/workspace/logs/fire-patrol-morning.log 2>&1
0 12 * * * /home/openclaw/.openclaw/workspace/playbooks/twitter-scout/scripts/health-check.sh >> /home/openclaw/.openclaw/workspace/logs/health-check.log 2>&1
0 13 * * * /home/openclaw/.openclaw/workspace/playbooks/twitter-scout/scripts/scout-brand-building.sh >> /home/openclaw/.openclaw/workspace/logs/brand-building.log 2>&1
30 17 * * * /home/openclaw/.openclaw/workspace/playbooks/twitter-scout/scripts/scout-fire-patrol.sh >> /home/openclaw/.openclaw/workspace/logs/fire-patrol-evening.log 2>&1
0 21 * * * [daily-reflection-command] >> /home/openclaw/.openclaw/workspace/logs/daily-reflection.log 2>&1
0 11 * * 0 [weekly-review-command] >> /home/openclaw/.openclaw/workspace/logs/weekly-review.log 2>&1
```

---

## Output & Notification Flow

**Each task:**
1. Runs script → collects results
2. Writes to `/logs/[task]-YYYY-MM-DD.log`
3. Writes to `/daily-packs/[task]-YYYY-MM-DD.json`
4. **Proposes MEMORY.md updates** (see below)
5. Notifies user with summary + key findings
6. Waits for approval to add to MEMORY.md

---

## Memory.md Update Proposal Pattern

After each script runs:

```
🤙 Fire Patrol (08:30, 2026-02-27)
Found: 5 candidates (Top: @TheConfigGuy, @fluxdiv)

💡 Propose to add to MEMORY.md:
- Pattern: "$30 stack" tweets get 14+ score consistently
- Error: Filter caught 1 false positive (non-English)
- Action: Lower non-English detection threshold?

✅ Approve? (y/n)
```

If yes → I add to MEMORY.md + commit.
If no → skip, try again tomorrow.

---

## Next Steps (for Dima)

Choose:
1. **Systemd timers** (recommended, better logging)
2. **crontab** (simpler, if systemd unavailable)

Then I'll:
- Create timer/service files (or provide crontab commands)
- Update each script to output results + MEMORY.md proposals
- Test one task end-to-end
- Set up logging

Готов? 🤙
