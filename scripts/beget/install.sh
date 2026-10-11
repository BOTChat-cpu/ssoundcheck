#!/usr/bin/env bash
set -euo pipefail
if [[ $(id -u) != 0 ]]; then echo 'Run this installer as root'; exit 1; fi
SOURCE=$(cd "$(dirname "$0")/../.." && pwd)
BASE=/srv/ssoundcheck
RELEASE="$BASE/releases/$(date -u +%Y%m%dT%H%M%SZ)"
apt-get update
apt-get install -y build-essential python3 nginx curl
id ssoundcheck >/dev/null 2>&1 || useradd --system --create-home --home-dir "$BASE" --shell /usr/sbin/nologin ssoundcheck
install -d -m 750 -o ssoundcheck -g ssoundcheck "$BASE" "$BASE/data" "$BASE/releases" "$RELEASE"
# Copy only the distributable; no credentials, old database, or local dependencies.
cp -a "$SOURCE"/. "$RELEASE"/
chown -R ssoundcheck:ssoundcheck "$RELEASE"
if [[ ! -f /etc/ssoundcheck.env ]]; then
  umask 077
  SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))")
  printf 'BETTER_AUTH_SECRET=%s\nBETTER_AUTH_URL=http://141.133.201.46\nDATABASE_PATH=/srv/ssoundcheck/data/site.sqlite\nNODE_ENV=production\nHOSTNAME=127.0.0.1\nPORT=3000\n' "$SECRET" > /etc/ssoundcheck.env
fi
cd "$RELEASE"
runuser -u ssoundcheck -- npm install --include=dev --no-audit --no-fund
runuser -u ssoundcheck -- env DATABASE_PATH="$BASE/data/site.sqlite" npm run db:migrate
runuser -u ssoundcheck -- npm run build
mkdir -p .next/standalone/public
cp -a public/. .next/standalone/public/
mkdir -p .next/standalone/.next
cp -a .next/static .next/standalone/.next/static
chown -R ssoundcheck:ssoundcheck .next
ln -sfn "$RELEASE" "$BASE/current"
cat > /etc/systemd/system/ssoundcheck.service <<'UNIT'
[Unit]
Description=SSoundCheck website
After=network.target
[Service]
Type=simple
User=ssoundcheck
Group=ssoundcheck
WorkingDirectory=/srv/ssoundcheck/current/.next/standalone
EnvironmentFile=/etc/ssoundcheck.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable ssoundcheck
systemctl restart ssoundcheck
READY=0
for attempt in {1..30}; do
 if curl --fail --silent http://127.0.0.1:3000/api/reviews >/dev/null; then READY=1; break; fi
 sleep 1
done
if [[ "$READY" != 1 ]]; then echo 'Application startup failed; inspect journalctl -u ssoundcheck'; exit 1; fi
cat > /etc/nginx/sites-available/ssoundcheck <<'NGINX'
server {
 listen 80;
 server_name 141.133.201.46;
 client_max_body_size 1m;
 location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_set_header X-Forwarded-Proto $scheme;
 }
}
NGINX
ln -sfn /etc/nginx/sites-available/ssoundcheck /etc/nginx/sites-enabled/ssoundcheck
nginx -t
systemctl reload nginx
echo 'SSOUNDCHECK READY: http://141.133.201.46'
