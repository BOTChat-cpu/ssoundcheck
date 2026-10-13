import {randomUUID} from 'node:crypto';
import {welcome,catalogue} from './telegram-posts.mjs';
export class TelegramError extends Error{constructor(code,retryAfter=0){super(code);this.code=code;this.retryAfter=retryAfter}}
export async function telegramCall(env,method,payload,transport=fetch){
 const token=env.TELEGRAM_BOT_TOKEN;if(!/^\d{8,12}:[A-Za-z0-9_-]{30,100}$/.test(token||''))throw new TelegramError('not_configured');
 let r;try{r=await transport('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',...(payload instanceof FormData?{body:payload}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),signal:AbortSignal.timeout(20000)})}catch{throw new TelegramError('delivery_unknown')}
 let data;try{data=await r.json()}catch{throw new TelegramError('delivery_unknown')}
 if(data.ok!==true){if(data.error_code===429)throw new TelegramError('retry_later',Math.max(30,Math.min(86400,Number(data.parameters?.retry_after)||60)));if(r.status>=500)throw new TelegramError('delivery_unknown');throw new TelegramError('telegram_rejected')}
 return data.result;
}
export function settings(db){return db.prepare('SELECT * FROM telegram_channel_settings WHERE id=1').get()||null}
export async function verifyChannel(env,username,transport=fetch){
 const me=await telegramCall(env,'getMe',{},transport);
 if(me.is_bot!==true||me.username?.toLowerCase()!==(env.TELEGRAM_BOT_USERNAME||'SSoundChekK_bot').toLowerCase())throw new TelegramError('wrong_bot');
 const chat=await telegramCall(env,'getChat',{chat_id:'@'+username},transport);
 if(chat.type!=='channel'||chat.username?.toLowerCase()!==username.toLowerCase()||!Number.isSafeInteger(chat.id))throw new TelegramError('wrong_channel');
 const member=await telegramCall(env,'getChatMember',{chat_id:chat.id,user_id:me.id},transport);
 if(member.status!=='creator'&&(member.status!=='administrator'||member.can_post_messages!==true))throw new TelegramError('no_permission');
 return {id:String(chat.id),username:chat.username,title:String(chat.title||chat.username).slice(0,200)};
}
export function nextSlot(after){
 // Wednesday and Saturday, 19:00 Moscow; Moscow is UTC+3.
 const day=new Date(after+3*3600_000);day.setUTCHours(19,0,0,0);
 for(let i=0;i<8;i++){const candidate=day.getTime()-3*3600_000;if(candidate>after&&[3,6].includes(day.getUTCDay()))return candidate;day.setUTCDate(day.getUTCDate()+1)}throw Error('slot unavailable');
}
function insert(db,channel,post,key,at,now){db.prepare('INSERT OR IGNORE INTO telegram_channel_posts(id,channel_id,dedupe_key,topic,body,image,scheduled_at,next_attempt_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(randomUUID(),channel,key,post.topic,post.body,post.image,at,at,now)}
export function replenish(db,now=Date.now()){
 const s=settings(db);if(!s?.enabled)return;
 db.transaction(()=>{
  db.prepare("UPDATE telegram_channel_posts SET state='skipped',last_error='stale' WHERE channel_id=? AND state='queued' AND scheduled_at<?").run(s.channel_id,now-48*3600_000);
  const pending=db.prepare("SELECT COUNT(*) n,MAX(scheduled_at) latest FROM telegram_channel_posts WHERE channel_id=? AND state='queued' AND dedupe_key LIKE 'regular:%'").get(s.channel_id);
  let seq=db.prepare("SELECT COUNT(*) n FROM telegram_channel_posts WHERE channel_id=? AND dedupe_key LIKE 'regular:%'").get(s.channel_id).n;
  let at=Math.max(now,pending.latest||now);
  for(let n=pending.n;n<8;n++){at=nextSlot(at);insert(db,s.channel_id,catalogue[seq%catalogue.length],'regular:'+at,at,now);seq++}
 })();
}
export function activate(db,channel,now=Date.now()){
 db.transaction(()=>{
  if(db.prepare("SELECT id FROM telegram_channel_posts WHERE state='sending' AND lease_until>?").get(now))throw new TelegramError('busy');
  db.prepare('INSERT INTO telegram_channel_settings(id,channel_id,username,title,enabled,updated_at) VALUES (1,?,?,?,1,?) ON CONFLICT(id) DO UPDATE SET channel_id=excluded.channel_id,username=excluded.username,title=excluded.title,enabled=1,last_sent_at=CASE WHEN channel_id=excluded.channel_id THEN last_sent_at ELSE NULL END,last_error=NULL,updated_at=excluded.updated_at').run(channel.id,channel.username,channel.title,now);
  insert(db,channel.id,welcome,'welcome',now+60_000,now);
 })();replenish(db,now);
}
export async function deliverOne(db,env,photo,transport=fetch,now=Date.now()){
 replenish(db,now);
 // Do not resend after an interrupted or ambiguous request: Telegram has no dedupe key.
 db.prepare("UPDATE telegram_channel_posts SET state='uncertain',lease_until=NULL,last_error='delivery_unknown' WHERE state='sending' AND lease_until<=?").run(now);
 const claimed=db.transaction(()=>{
  const s=settings(db);if(!s?.enabled||s.last_sent_at&&now-s.last_sent_at<8*3600_000)return null;
  const post=db.prepare("SELECT * FROM telegram_channel_posts WHERE channel_id=? AND state='queued' AND next_attempt_at<=? ORDER BY scheduled_at LIMIT 1").get(s.channel_id,now);if(!post)return null;
  db.prepare("UPDATE telegram_channel_posts SET state='sending',attempts=attempts+1,lease_until=? WHERE id=?").run(now+120_000,post.id);return {...post,attempts:post.attempts+1};
 })();if(!claimed)return false;
 let attempted=false;
 try{
  const bytes=await photo(claimed.image);
  const s=settings(db);if(!s?.enabled||s.channel_id!==claimed.channel_id){db.prepare("UPDATE telegram_channel_posts SET state='queued',lease_until=NULL WHERE id=?").run(claimed.id);return false}
  const form=new FormData();form.set('chat_id',claimed.channel_id);form.set('photo',new Blob([bytes],{type:'image/jpeg'}),'ssoundcheck.jpg');form.set('caption',claimed.body);form.set('protect_content','true');
  const link=new URL('/?utm_source=telegram',env.BETTER_AUTH_URL).href;
  form.set('reply_markup',JSON.stringify({inline_keyboard:[[{text:'Создать свою песню',url:link}]]}));
  attempted=true;const result=await telegramCall(env,'sendPhoto',form,transport);
  if(!Number.isSafeInteger(result?.message_id))throw new TelegramError('delivery_unknown');
  db.transaction(()=>{db.prepare("UPDATE telegram_channel_posts SET state='sent',lease_until=NULL,message_id=?,sent_at=?,last_error=NULL WHERE id=?").run(result.message_id,now,claimed.id);db.prepare('UPDATE telegram_channel_settings SET last_sent_at=?,last_error=NULL WHERE id=1 AND channel_id=?').run(now,claimed.channel_id)})();return true;
 }catch(e){
  const code=e instanceof TelegramError?e.code:attempted?'delivery_unknown':'image_unavailable';
  const uncertain=code==='delivery_unknown',terminal=uncertain||claimed.attempts>=5||['not_configured','wrong_bot','no_permission'].includes(code);
  db.prepare('UPDATE telegram_channel_posts SET state=?,lease_until=NULL,next_attempt_at=?,last_error=? WHERE id=?').run(uncertain?'uncertain':terminal?'failed':'queued',now+(e.retryAfter||Math.min(3600,60*2**claimed.attempts))*1000,code,claimed.id);
  db.prepare('UPDATE telegram_channel_settings SET last_error=? WHERE id=1 AND channel_id=?').run(code,claimed.channel_id);return false;
 }
}
