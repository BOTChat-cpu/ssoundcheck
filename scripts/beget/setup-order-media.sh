#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run as root'; exit 1; }
if ! command -v ffmpeg >/dev/null || ! command -v ffprobe >/dev/null; then
 apt-get update
 apt-get install -y ffmpeg
fi
ffmpeg -version >/dev/null
ffprobe -version >/dev/null
# Existing servers were installed with a 1 MB nginx request limit.
CONFIG=/etc/nginx/sites-available/ssoundcheck
[[ -f "$CONFIG" ]] || { echo 'Website nginx config not found'; exit 1; }
BACKUP=$(mktemp /etc/nginx/ssoundcheck-upload-backup.XXXXXX)
cp -a "$CONFIG" "$BACKUP"
python3 - "$CONFIG" <<'PYCONFIG'
from pathlib import Path
import re, sys
p=Path(sys.argv[1]); source=p.read_text()
if not re.search(r'\bclient_max_body_size\s+[^;]+;',source):
    raise SystemExit('No upload limit directive found; nginx config unchanged')
p.write_text(re.sub(r'\bclient_max_body_size\s+[^;]+;', 'client_max_body_size 21m;', source))
PYCONFIG
if ! nginx -t; then
 cp -a "$BACKUP" "$CONFIG"
 rm -f "$BACKUP"
 echo 'Nginx config check failed; previous config restored'
 exit 1
fi
if ! systemctl reload nginx; then
 cp -a "$BACKUP" "$CONFIG"
 rm -f "$BACKUP"
 echo 'Nginx reload failed; previous config restored'
 exit 1
fi
rm -f "$BACKUP"
echo 'SONG PREVIEW READY: 40 seconds; MP3 upload up to 20 MB' 
