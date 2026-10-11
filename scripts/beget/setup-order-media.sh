#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run as root'; exit 1; }
if ! command -v ffmpeg >/dev/null || ! command -v ffprobe >/dev/null; then
 apt-get update
 apt-get install -y ffmpeg
fi
ffmpeg -version >/dev/null
ffprobe -version >/dev/null
echo 'SONG PREVIEW READY: 40 seconds'
