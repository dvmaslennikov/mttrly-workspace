#!/bin/bash
export OUTPUT_DIR="$HOME/.openclaw/workspace/daily-packs"
mkdir -p "$OUTPUT_DIR"
bash playbooks/twitter-scout/scripts/scout-fire-patrol.sh 2>&1 | tail -10
ls -lh "$OUTPUT_DIR"/fire-patrol-candidates-*.json | tail -1
