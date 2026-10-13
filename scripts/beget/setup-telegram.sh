#!/usr/bin/env bash
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then
  echo 'Запустите команду от root на сервере.' >&2
  exit 1
fi
if [[ ! -f /etc/ssoundcheck.env ]]; then
  echo 'Не найден файл настроек сайта /etc/ssoundcheck.env.' >&2
  exit 1
fi
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
trap 'unset telegram_setup_token' EXIT
printf 'Введите НОВЫЙ токен от BotFather (символы не отображаются): '
IFS= read -r -s telegram_setup_token
printf '\n'
printf '%s' "$telegram_setup_token" | node "$script_dir/setup-telegram.mjs" SSoundChekK_bot
unset telegram_setup_token
