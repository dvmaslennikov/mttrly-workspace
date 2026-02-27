# Cron Setup for twitter-scout

**Purpose:** Automated morning/evening Twitter engagement scans for @mttrly

**Schedule:**
- **Fire Patrol (Pain Points):** 2x/day
  - Morning: 06:30 MSK (03:30 UTC)
  - Evening: 14:30 UTC / 17:30 MSK
- **Brand Building (Trends):** 1x/day
  - Midday: 14:00 MSK (11:00 UTC)

---

## Setup Instructions

### Step 1: Verify Scripts are Executable

```bash
ls -la /home/openclaw/.openclaw/workspace/playbooks/twitter-scout/scripts/
# All should show -rwxrwxr-x
```

### Step 2: Create Logs Directory

```bash
mkdir -p /home/openclaw/.openclaw/workspace/playbooks/twitter-scout/logs
chmod 755 /home/openclaw/.openclaw/workspace/playbooks/twitter-scout/logs
```

### Step 3: Edit Crontab

```bash
crontab -e
```

### Step 4: Add Cron Entries

Add these lines to your crontab (adjust timezone if needed):

```bash
# Environment
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
TZ=Europe/Amsterdam

# twitter-scout: Fire Patrol (Pain Points)
# Morning: 06:30 MSK = 03:30 UTC
30 3 * * * cd /home/openclaw/.openclaw/workspace/playbooks/twitter-scout && bash scripts/run-scout.sh fire-patrol

# Evening: 17:30 MSK = 14:30 UTC  
30 14 * * * cd /home/openclaw/.openclaw/workspace/playbooks/twitter-scout && bash scripts/run-scout.sh fire-patrol

# twitter-scout: Brand Building (Trends)
# Midday: 14:00 MSK = 11:00 UTC
0 11 * * * cd /home/openclaw/.openclaw/workspace/playbooks/twitter-scout && bash scripts/run-scout.sh brand-building
```

### Step 5: Verify Cron Installation

```bash
crontab -l | grep twitter-scout
# Should show 3 entries
```

---

## Timezone Conversion

**System timezone:** Europe/Amsterdam (UTC+1 or UTC+2 depending on DST)  
**User timezone:** MSK (UTC+3)

| User (MSK) | UTC | CRON |
|------------|-----|------|
| 06:30 | 03:30 | 30 3 |
| 14:00 | 11:00 | 0 11 |
| 17:30 | 14:30 | 30 14 |

---

## Log Management

Logs are written to: `/home/openclaw/.openclaw/workspace/playbooks/twitter-scout/logs/`

### View Latest Run

```bash
ls -lt logs/ | head -5
tail -100 logs/scout-fire-patrol-*.log
```

### Cleanup Old Logs (Optional)

```bash
# Keep only last 30 days
find logs/ -name "scout-*" -mtime +30 -delete
```

### Auto-Rotate Logs (Optional)

Create `/etc/logrotate.d/twitter-scout`:

```
/home/openclaw/.openclaw/workspace/playbooks/twitter-scout/logs/*.log {
  daily
  rotate 30
  compress
  delaycompress
  missingok
  notifempty
}
```

---

## Testing

### Manual Test (Fire Patrol)

```bash
cd /home/openclaw/.openclaw/workspace/playbooks/twitter-scout
bash scripts/run-scout.sh fire-patrol
```

**Expected output:**
```
[2026-02-27 04:30:15 UTC] === twitter-scout fire-patrol run started ===
[2026-02-27 04:30:15 UTC] Script dir: /home/openclaw/.openclaw/workspace/playbooks/twitter-scout/scripts
[2026-02-27 04:30:15 UTC] Log file: /home/openclaw/.openclaw/workspace/playbooks/twitter-scout/logs/scout-fire-patrol-2026-02-27_04-30-15.log
[2026-02-27 04:30:15 UTC] Environment loaded
[2026-02-27 04:30:15 UTC] Executing: .../scripts/scout-fire-patrol.sh
...
[2026-02-27 04:35:20 UTC] ✅ Scan completed successfully
[2026-02-27 04:35:20 UTC] === twitter-scout fire-patrol run completed ===
```

### Manual Test (Brand Building)

```bash
cd /home/openclaw/.openclaw/workspace/playbooks/twitter-scout
bash scripts/run-scout.sh brand-building
```

---

## Troubleshooting

### Cron Job Doesn't Run

1. **Check cron is running:**
   ```bash
   sudo systemctl status cron
   # or
   ps aux | grep crond
   ```

2. **Check cron logs:**
   ```bash
   # System logs
   grep CRON /var/log/syslog
   ```

3. **Check if script exists and is executable:**
   ```bash
   file /home/openclaw/.openclaw/workspace/playbooks/twitter-scout/scripts/run-scout.sh
   # Should show: executable
   ```

4. **Test cron time directly:**
   ```bash
   at now + 1 minute
   cd /home/openclaw/.openclaw/workspace/playbooks/twitter-scout && bash scripts/run-scout.sh fire-patrol
   Ctrl+D
   ```

### Bird CLI Auth Fails

If logs show `ERROR: ~/.env.bird not found`:

```bash
# Verify .env.bird exists
cat ~/.openclaw/.env.bird

# If missing, recreate:
export BIRD_AUTH_TOKEN="your_token_here"
echo "export BIRD_AUTH_TOKEN='$BIRD_AUTH_TOKEN'" > ~/.openclaw/.env.bird
chmod 600 ~/.openclaw/.env.bird
```

### Rate Limit Issues (429)

Check logs for "Rate limited":

```bash
grep "429" logs/scout-*.log
```

If frequent, adjust cron timing or add delay between queries in script.

---

## Monitoring

### Check if Scans are Running

```bash
# Count daily scans
find logs/ -name "scout-*.log" -mtime -1 | wc -l
# Should be 3 (fire-patrol x2 + brand-building x1)
```

### Monitor Output Files

```bash
# List latest candidates
ls -lt candidates-*.json | head -10

# Check file sizes (should be non-empty)
wc -l candidates-*.json
```

### Alert on Failure

Add to crontab to email on error:

```bash
# Fire Patrol morning — email if fails
30 3 * * * cd /home/openclaw/.openclaw/workspace/playbooks/twitter-scout && bash scripts/run-scout.sh fire-patrol || echo "Fire Patrol FAILED" | mail -s "twitter-scout alert" your-email@example.com
```

---

## Disabling Cron Jobs

To temporarily disable without removing:

```bash
# Comment out the line in crontab -e
# 30 3 * * * cd /home/openclaw/... # DISABLED

# Or remove all twitter-scout entries:
crontab -l | grep -v twitter-scout | crontab -
```

---

## Schedule Summary

| Job | Time (MSK) | Time (UTC) | Cadence | Purpose |
|-----|-----------|-----------|---------|---------|
| Fire Patrol | 06:30 | 03:30 | Daily | Pain points (morning) |
| Fire Patrol | 17:30 | 14:30 | Daily | Pain points (evening) |
| Brand Build | 14:00 | 11:00 | Daily | Trends (midday) |

---

**Created:** 2026-02-27  
**System:** Linux (cron)  
**Status:** Ready to deploy
