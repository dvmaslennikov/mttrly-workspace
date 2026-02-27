# Quick Cron Installation

**Automated setup for twitter-scout cron jobs**

## One-Liner Install

```bash
bash /home/openclaw/.openclaw/workspace/playbooks/twitter-scout/scripts/install-cron.sh
```

This will:
1. Create `/logs` directory
2. Add 3 cron jobs (fire-patrol x2, brand-building x1)
3. Set timezone to Europe/Amsterdam
4. Verify with `crontab -l`

## Manual Install (if needed)

```bash
crontab -e
```

Paste:
```bash
# Environment
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
TZ=Europe/Amsterdam

# twitter-scout: Fire Patrol (Pain Points) - Morning (06:30 MSK = 03:30 UTC)
30 3 * * * cd /home/openclaw/.openclaw/workspace/playbooks/twitter-scout && bash scripts/run-scout.sh fire-patrol

# twitter-scout: Fire Patrol (Pain Points) - Evening (17:30 MSK = 14:30 UTC)
30 14 * * * cd /home/openclaw/.openclaw/workspace/playbooks/twitter-scout && bash scripts/run-scout.sh fire-patrol

# twitter-scout: Brand Building (Trends) - Midday (14:00 MSK = 11:00 UTC)
0 11 * * * cd /home/openclaw/.openclaw/workspace/playbooks/twitter-scout && bash scripts/run-scout.sh brand-building
```

## Verify

```bash
# Check cron jobs installed
crontab -l | grep twitter-scout

# Test fire-patrol (should succeed)
cd /home/openclaw/.openclaw/workspace/playbooks/twitter-scout && bash scripts/run-scout.sh fire-patrol

# View logs
tail -f logs/scout-*.log
```

## Disable All

```bash
crontab -l | grep -v twitter-scout | crontab -
```

---

**See CRON-SETUP.md for detailed troubleshooting and management.**
