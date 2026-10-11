#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Запустите от root в консоли VPS'; exit 1; }
[[ -f /etc/ssoundcheck.env && -L /srv/ssoundcheck/current ]] || { echo 'Сначала установите сайт'; exit 1; }
echo 'Используйте SMTP почтового ящика. Для Beget: smtp.beget.com, порт 465.'
read -r -p 'SMTP сервер [smtp.beget.com]: ' MAIL_HOST
MAIL_HOST=${MAIL_HOST:-smtp.beget.com}
read -r -p 'Порт [465]: ' MAIL_PORT
MAIL_PORT=${MAIL_PORT:-465}
read -r -p 'Email почтового ящика: ' MAIL_USER
read -r -s -p 'Пароль почтового ящика (или пароль приложения): ' MAIL_PASSWORD
printf '\n'
read -r -p 'Куда отправить проверочное письмо [на этот же ящик]: ' MAIL_TEST
MAIL_TEST=${MAIL_TEST:-$MAIL_USER}
cd /srv/ssoundcheck/current
# Secrets travel through stdin only. Verify SMTP and send a test before saving.
printf '%s\0' "$MAIL_HOST" "$MAIL_PORT" "$MAIL_USER" "$MAIL_PASSWORD" "$MAIL_TEST" | node --input-type=module -e '
import fs from "node:fs";
import {createSMTPTransport} from "./lib/auth-mail.mjs";
let input="";for await(const part of process.stdin)input+=part;
const [host,port,user,password,to]=input.split("\0");
if(!/^[a-zA-Z0-9.-]+$/.test(host)||!["465","587"].includes(port)||!/^\S+@\S+\.\S+$/.test(user)||!/^\S+@\S+\.\S+$/.test(to)||!password||/[\r\n\0]/.test(user+to)){console.error("Проверьте сервер, порт, email и пароль");process.exit(1)}
const values={AUTH_SMTP_HOST:host,AUTH_SMTP_PORT:port,AUTH_SMTP_USER:user,AUTH_FROM_EMAIL:user,AUTH_SMTP_PASSWORD_BASE64:Buffer.from(password).toString("base64")};
const transport=createSMTPTransport(values);
try{await transport.verify();await transport.sendMail({from:user,to,subject:"SSoundCheck: проверка почты",text:"Отправка писем SSoundCheck настроена. Теперь клиенты могут восстанавливать пароль через ссылку на email."})}catch{console.error("Не удалось отправить письмо. Проверьте SMTP, пароль и настройки ящика. Настройки сайта не изменены.");process.exitCode=1}finally{transport.close()}
if(process.exitCode)process.exit(process.exitCode);
const path="/etc/ssoundcheck.env",temp=path+".mail-new";
const keys=new Set([...Object.keys(values),"AUTH_SMTP_PASSWORD"]);
const lines=fs.readFileSync(path,"utf8").split("\n").filter(line=>!keys.has(line.split("=")[0])&&line!=="");
const quote=value=>"\""+value.replace(/\\/g,"\\\\").replace(/\"/g,"\\\"")+"\"";
for(const [key,value] of Object.entries(values))lines.push(key+"="+quote(value));
fs.writeFileSync(temp,lines.join("\n")+"\n",{mode:0o600});fs.chmodSync(temp,0o600);fs.renameSync(temp,path);
'
unset MAIL_PASSWORD
systemctl restart ssoundcheck
echo 'Письмо отправлено. Проверьте входящие и спам. Восстановление: https://ssoundcheck.ru/forgot-password'
