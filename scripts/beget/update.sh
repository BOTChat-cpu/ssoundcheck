#!/usr/bin/env bash
# Runs as root from a fixed, administrator-installed copy, not from repository hooks.
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run as root'; exit 1; }
BASE=${SSOUNDCHECK_BASE:-/srv/ssoundcheck}
REPO="$BASE/repository"
exec 9>"$BASE/update.lock"
flock -n 9 || exit 0
git -C "$REPO" -c core.hooksPath=/dev/null fetch --quiet origin main
COMMIT=$(git -C "$REPO" rev-parse --verify origin/main)
[[ "$COMMIT" =~ ^[0-9a-f]{40,64}$ ]] || exit 1
if [[ -f "$BASE/deployed-commit" ]] && [[ $(cat "$BASE/deployed-commit") == "$COMMIT" ]]; then exit 0; fi
RELEASE=$(mktemp -d "$BASE/releases/${COMMIT:0:12}.XXXXXX")
OLD=$(readlink -f "$BASE/current")
BACKUP=''
STOPPED=0
rollback() {
 status=$?
 if [[ $status != 0 ]] && [[ "$STOPPED" == 1 ]]; then
  systemctl stop ssoundcheck || true
  if [[ -n "$BACKUP" ]] && [[ -f "$BACKUP" ]]; then
   rm -f "$BASE/data/site.sqlite-wal" "$BASE/data/site.sqlite-shm"
   cp "$BACKUP" "$BASE/data/site.sqlite"
   chown ssoundcheck:ssoundcheck "$BASE/data/site.sqlite"
   chmod 600 "$BASE/data/site.sqlite"
  fi
  ln -sfn "$OLD" "$BASE/current"
  systemctl start ssoundcheck || true
  echo 'Update failed: previous version restored' >&2
 fi
 exit "$status"
}
trap rollback EXIT
git -C "$REPO" archive "$COMMIT" | tar -x -C "$RELEASE"
chown -R ssoundcheck:ssoundcheck "$RELEASE"
cd "$RELEASE"
# npm install reconciles npm 9 / npm 11 peer lockfile differences.
runuser -u ssoundcheck -- npm install --include=dev --no-audit --no-fund
runuser -u ssoundcheck -- npm run build
mkdir -p .next/standalone/public
cp -a public/. .next/standalone/public/
mkdir -p .next/standalone/.next
cp -a .next/static .next/standalone/.next/static
chown -R ssoundcheck:ssoundcheck .next
systemctl stop ssoundcheck
STOPPED=1
if [[ -f "$BASE/data/site.sqlite" ]]; then
 install -d -m 700 "$BASE/backups"
 BACKUP="$BASE/backups/$(date -u +%Y%m%dT%H%M%SZ)-${COMMIT:0:12}.sqlite"
 python3 - "$BASE/data/site.sqlite" "$BACKUP" <<'PYBACKUP'
import sqlite3, sys, os
with sqlite3.connect(sys.argv[1]) as source, sqlite3.connect(sys.argv[2]) as target:
    source.backup(target)
os.chmod(sys.argv[2], 0o600)
PYBACKUP
fi
runuser -u ssoundcheck -- env DATABASE_PATH="$BASE/data/site.sqlite" npm run db:migrate
ln -sfn "$RELEASE" "$BASE/current"
systemctl start ssoundcheck
READY=0
for attempt in {1..30}; do
 if curl --fail --silent http://127.0.0.1:3000/api/reviews >/dev/null; then READY=1; break; fi
 sleep 1
done
[[ "$READY" == 1 ]] || { echo 'Application health check failed'; exit 1; }
printf '%s\n' "$COMMIT" > "$BASE/deployed-commit"
STOPPED=0
echo "Deployed $COMMIT"
