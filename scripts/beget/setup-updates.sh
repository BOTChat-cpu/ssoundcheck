#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run as root'; exit 1; }
BASE=/srv/ssoundcheck
REPO="$BASE/repository"
[[ -f /etc/ssoundcheck.env && -L "$BASE/current" ]] || { echo 'Install the website first'; exit 1; }
if [[ ! -d "$REPO/.git" ]]; then
 git clone --branch main --single-branch https://github.com/BOTChat-cpu/ssoundcheck.git "$REPO"
fi
[[ $(git -C "$REPO" remote get-url origin) == https://github.com/BOTChat-cpu/ssoundcheck.git ]] || { echo 'Unexpected source repository'; exit 1; }
git -C "$REPO" -c core.hooksPath=/dev/null pull --ff-only
install -m 700 "$REPO/scripts/beget/update.sh" /usr/local/sbin/ssoundcheck-update
install -m 644 "$REPO/scripts/beget/ssoundcheck-update.service" /etc/systemd/system/ssoundcheck-update.service
install -m 644 "$REPO/scripts/beget/ssoundcheck-update.timer" /etc/systemd/system/ssoundcheck-update.timer
systemctl daemon-reload
systemctl enable --now ssoundcheck-update.timer
systemctl start ssoundcheck-update.service
systemctl is-active --quiet ssoundcheck-update.timer
echo 'AUTO UPDATE READY'
