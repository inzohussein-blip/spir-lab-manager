#!/usr/bin/env bash
# Starts the standby, and keeps it on the same version as the main site: fetches main, and rebuilds
# and restarts only when it changed (or when the app is not running). docs/SELF_HOST_STANDBY.md
#
#   First start:        ./update.sh
#   Every 10 minutes:   crontab -e, then add the line
#     */10 * * * * /full/path/to/spir-lab-manager/deploy/standby-server/update.sh >> $HOME/standby-update.log 2>&1
set -e
cd "$(dirname "$0")"
[ -f .env ] || { echo "Copy .env.example to .env and fill it in first."; exit 1; }
git -C ../.. fetch -q origin main
if [ "$(git -C ../.. rev-parse HEAD)" = "$(git -C ../.. rev-parse origin/main)" ] && [ -n "$(docker compose ps --status running -q app)" ]; then exit 0; fi
git -C ../.. merge -q --ff-only origin/main
echo "$(date '+%F %T') building $(git -C ../.. rev-parse --short HEAD)"
docker compose up -d --build
docker image prune -f >/dev/null
