# mttrly-x-marketing

Twitter/X engagement skill for @mttrly_.

## Goal
Find high-signal tweets for manual engagement. Generate response drafts. Posting is manual by Dmitry.

## Available Commands

### Search (bird CLI — FREE read via GraphQL + cookies)

```bash
bird search "server down production" -n 20 --json
bird search "vibe coding deploy" -n 15 --json
bird search "deployment failed" -n 10
bird search '"3am alert" OR "on-call nightmare"' -n 10
bird search '"vercel expensive" OR "railway pricing"' -n 10
```

### Watchlist monitoring

```bash
bird user-tweets @levelsio -n 10 --json
bird user-tweets @kelseyhightower -n 10 --json
bird user-tweets @Railway -n 5 --json
```

### Trends and news

```bash
bird trending
bird news --ai-only -n 10
```

### Read tweet/thread

```bash
bird read <tweet-url-or-id>
bird thread <tweet-url-or-id>
bird replies <tweet-url-or-id> -n 20
```

### Mentions

```bash
bird mentions -n 10
```

## Posting and replies — MANUAL ONLY
Dmitry posts manually in browser.

Hard rule:
- NEVER use `bird tweet`
- NEVER use `bird reply`

Reason: high block/ban risk.

## Account analytics (x-smart-read, ~$0.02/day)

```bash
uv run scripts/x_briefing.py --hours 24
uv run scripts/x_timeline.py top --days 7
uv run scripts/x_briefing.py --dry-run
```

## Digest script
Run:

```bash
./scripts/bird-digest.sh morning
./scripts/bird-digest.sh evening
```

Output files:
- `/tmp/bird_pain.json`
- `/tmp/bird_audience.json`
- `/tmp/bird_comp.json`
- `/tmp/bird_watch.json`

Then pass results to OpenClaw for filtering/ranking:
- likes >= 10
- English only
- fresh: morning <= 12h, evening <= 8h
- dedup using tracking file

## Cookie maintenance
Cookies expire every 1–3 months.

If auth fails:
1. Open x.com and log in
2. DevTools → Application → Cookies → x.com
3. Copy `auth_token` and `ct0`
4. Update VPS env:
   - `~/.openclaw/.env`
   - variables: `BIRD_AUTH_TOKEN`, `BIRD_CT0`
5. Verify:
   - `bird --auth-token $BIRD_AUTH_TOKEN --ct0 $BIRD_CT0 whoami`

## Budget after migration
- bird CLI read: $0
- x-smart-read: ~$0.60/month
- LLM usage: depends on usage
- Total Twitter monitoring baseline: ~$1/month
