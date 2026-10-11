#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run as root'; exit 1; }
[[ -f /etc/ssoundcheck.env && -L /srv/ssoundcheck/current ]] || { echo 'Install the website first'; exit 1; }
read -r -s -p 'Придумайте пароль панели (12–128 символов): ' ADMIN_PASSWORD
printf '\n'
read -r -s -p 'Повторите пароль: ' ADMIN_CONFIRM
printf '\n'
[[ "$ADMIN_PASSWORD" == "$ADMIN_CONFIRM" ]] || { unset ADMIN_PASSWORD ADMIN_CONFIRM; echo 'Пароли не совпадают'; exit 1; }
# Password is sent through stdin; it is never included in commands, files or logs.
printf '%s' "$ADMIN_PASSWORD" | node -e '
const fs=require("fs"),crypto=require("crypto");
let password="";process.stdin.setEncoding("utf8");process.stdin.on("data",part=>password+=part);
process.stdin.on("end",()=>{
if(password.length<12||password.length>128){console.error("Нужно от 12 до 128 символов");process.exitCode=1;return;}
const salt=crypto.randomBytes(16).toString("hex"),hash=crypto.scryptSync(password,salt,64).toString("hex");
const path="/etc/ssoundcheck.env",tmp=path+".admin-new";
const lines=fs.readFileSync(path,"utf8").split("\n").filter(line=>!line.startsWith("SSOUNDCHECK_ADMIN_PASSWORD_HASH=")&&line!=="");
lines.push("SSOUNDCHECK_ADMIN_PASSWORD_HASH=scrypt$"+salt+"$"+hash);
fs.writeFileSync(tmp,lines.join("\n")+"\n",{mode:0o600});fs.chmodSync(tmp,0o600);fs.renameSync(tmp,path);
});'
unset ADMIN_PASSWORD ADMIN_CONFIRM
# Allow MP3 uploads; all other application limits still apply.
NGINX=/etc/nginx/sites-available/ssoundcheck
if [[ -f "$NGINX" ]]; then
 cp -a "$NGINX" "$NGINX.admin-backup"
 sed -i -E 's/client_max_body_size[[:space:]]+[^;]+;/client_max_body_size 25m;/' "$NGINX"
 if nginx -t; then systemctl reload nginx; else cp -a "$NGINX.admin-backup" "$NGINX"; echo 'Проверьте конфигурацию Nginx'; exit 1; fi
fi
systemctl restart ssoundcheck
echo 'ADMIN READY: https://ssoundcheck.ru/admin'
