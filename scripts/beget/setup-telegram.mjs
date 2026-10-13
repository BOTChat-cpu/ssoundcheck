import {readFileSync,writeFileSync,renameSync,unlinkSync,lstatSync,realpathSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export async function verifyBot(token,expected,request=fetch){
 if(!/^\d{8,12}:[A-Za-z0-9_-]{30,100}$/.test(token))throw Error('Неверный формат токена. Скопируйте новый токен целиком из BotFather.');
 let response;
 try{response=await request('https://api.telegram.org/bot'+token+'/getMe',{method:'POST',signal:AbortSignal.timeout(15000)})}catch{throw Error('Не удалось связаться с Telegram. Настройки не изменены; повторите позже.')}
 if(!response.ok)throw Error('Telegram не принял токен. Проверьте, что используете новый действующий токен.');
 let data;try{data=await response.json()}catch{throw Error('Не удалось проверить ответ Telegram. Настройки не изменены.')}
 if(data.ok!==true||data.result?.is_bot!==true||typeof data.result.username!=='string')throw Error('Telegram не подтвердил бота. Настройки не изменены.');
 if(data.result.username.toLowerCase()!==expected.toLowerCase())throw Error('Токен относится к другому боту. Нужен токен @'+expected+'.');
 return data.result.username;
}
export function saveBotToken(envPath,token,username){
 const info=lstatSync(envPath);if(!info.isFile()||info.isSymbolicLink())throw Error('Файл настроек должен быть обычным файлом.');
 const original=readFileSync(envPath,'utf8');
 // Token alphabet cannot contain shell metacharacters. Never print secrets.
 const kept=original.split(/\r?\n/).filter(line=>!/^\s*(?:export\s+)?TELEGRAM_BOT_(?:TOKEN|USERNAME)=/.test(line)).join('\n').replace(/\n*$/,'');
 const text=kept+'\nTELEGRAM_BOT_TOKEN='+token+'\nTELEGRAM_BOT_USERNAME='+username+'\n';
 const temporary=envPath+'.telegram-'+randomUUID();
 try{writeFileSync(temporary,text,{encoding:'utf8',mode:0o600,flag:'wx'});renameSync(temporary,envPath)}finally{try{unlinkSync(temporary)}catch{}}
}
async function main(){
 if(process.getuid?.()!==0)throw Error('Запустите настройку от root на сервере.');
 const expected=process.argv[2];if(!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(expected||''))throw Error('Не указано корректное имя бота.');
 const token=readFileSync(0,'utf8').trim();
 const username=await verifyBot(token,expected);
 try{saveBotToken('/etc/ssoundcheck.env',token,username)}catch{throw Error('Не удалось сохранить настройки бота. Проверьте файл настроек сервера.')}
 console.log('Бот @'+username+' проверен. Новый токен сохранён в закрытом файле настроек сервера.');
 console.log('Публикации пока не включены. Следующий шаг: добавьте бота администратором канала с правом публикации и передайте ссылку на канал.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(realpathSync(process.argv[1])).href)main().catch(e=>{console.error(e.message||'Не удалось настроить бота.');process.exitCode=1});
