# Query Fan-Out (beyond vibe coding)

Используем группы интентов, а не один keyword.

## A) INCIDENT NOW
- ("site is down" OR "server down" OR "prod is down") (help OR fix OR urgent)
- ("502" OR "504" OR "bad gateway" OR "upstream timed out")
- ("OOM" OR "out of memory" OR "killed process") (node OR python OR api)
- ("disk full" OR "no space left on device") (server OR production)

## B) ON-CALL PAIN
- ("got paged" OR "pager went off" OR "on-call") (3am OR night OR incident)
- ("woke up to" AND ("alert" OR "server" OR "downtime"))
- ("incident fatigue" OR "on-call burnout")

## C) DEBUG CONFUSION
- ("works on my machine" OR "works locally") (production OR deploy)
- ("how to debug production" OR "prod debugging")
- ("logs make no sense" OR "log hell" OR "grep all night")

## D) DEPLOY FEAR
- ("deploy failed" OR "rollback" OR "migration failed") (production OR postgres)
- ("never deploy on friday" OR "friday deploy")
- ("zero downtime deploy" OR "safe deploy")

## E) SECURITY OOPS
- ("exposed API" OR "open endpoint" OR "publicly accessible")
- ("accidentally exposed" AND (server OR database OR redis))
- ("open ssh" OR "open port 22" OR bruteforce)

## F) STACK-SPECIFIC PAIN
- ("pm2" AND (restarting OR crash OR stopped))
- ("systemd" AND (failed OR "keeps restarting"))
- ("postgres" AND ("too many connections" OR "connection slots"))
- ("nginx" AND ("emerg" OR "config test failed"))

## G) PLATFORM-SPECIFIC
- ("railway" OR "render" OR "fly.io" OR "vercel") (down OR outage OR debugging)
- ("hetzner" OR "digitalocean" OR "linode") (downtime OR monitoring OR incident)

## H) BUYING SIGNALS (soft)
- ("what do you use for monitoring" OR "monitoring stack") (solo OR startup)
- ("pagerduty" OR "opsgenie" OR "datadog") (expensive OR alternative OR overkill)
- ("lightweight monitoring" OR "simple alerting")

## TRACKED ACCOUNTS
- from:levelsio
- from:mipsytipsy
- from:iarjunbharti
- from:mayank5885
- from:usewhawit (monitor-only / neutral)
