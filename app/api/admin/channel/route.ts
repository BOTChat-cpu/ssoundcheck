import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {adminGuard} from '../../../../lib/admin-auth';
import {getSqlite} from '../../../../db';
import {settings,verifyChannel,activate,replenish,TelegramError} from '../../../../lib/telegram-channel-core.mjs';
import {kickChannelWorker} from '../../../../lib/telegram-channel';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const messages:Record<string,string>={not_configured:'Сначала подключите токен бота на сервере.',wrong_bot:'Токен относится к другому боту.',wrong_channel:'Не удалось подтвердить публичный канал.',no_permission:'Добавьте @SSoundChekK_bot администратором канала с правом публикации.',telegram_rejected:'Telegram отклонил запрос. Проверьте токен и права бота.',delivery_unknown:'Нет достоверного ответа Telegram. Попробуйте подключение позже.',busy:'Пост уже отправляется. Подождите минуту и повторите.'};
export function GET(req:Request){const denied=adminGuard(req);if(denied)return denied;const db=getSqlite(),s=settings(db);const posts=s?db.prepare('SELECT id,topic,body,image,scheduled_at,state,attempts,message_id,sent_at,last_error FROM telegram_channel_posts WHERE channel_id=? ORDER BY scheduled_at DESC LIMIT 50').all(s.channel_id):[];return Response.json({configured:Boolean(process.env.TELEGRAM_BOT_TOKEN),bot:process.env.TELEGRAM_BOT_USERNAME||'SSoundChekK_bot',channel:s,posts},{headers})}
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('connect')}),z.object({action:z.literal('pause')}),z.object({action:z.literal('resume')}),
 z.object({action:z.literal('add'),topic:z.string().trim().min(1).max(100),body:z.string().trim().min(1).max(950),at:z.number().int().positive(),image:z.enum(['story','sound','gift'])}),
 z.object({action:z.enum(['cancel','retry','published']),id:z.string().uuid()})
]);
export async function POST(req:Request){
 const denied=adminGuard(req);if(denied)return denied;
 let body;try{const text=await req.text();if(text.length>10000)return Response.json({error:'Слишком большой запрос.'},{status:413,headers});body=schema.parse(JSON.parse(text))}catch{return Response.json({error:'Проверьте заполнение формы.'},{status:400,headers})}
 const db=getSqlite(),now=Date.now();
 try{
  if(body.action==='connect'){const channel=await verifyChannel(process.env,'SSoundChekKK');activate(db,channel,now);return Response.json({ok:true},{headers})}
  const s=settings(db);if(!s)return Response.json({error:'Сначала подключите канал.'},{status:409,headers});
  if(body.action==='pause'||body.action==='resume'){db.prepare('UPDATE telegram_channel_settings SET enabled=?,updated_at=? WHERE id=1').run(body.action==='resume'?1:0,now);if(body.action==='resume'){replenish(db);kickChannelWorker()}return Response.json({ok:true},{headers})}
  if(body.action==='add'){if(body.at<now+60_000||body.at>now+180*86400_000)return Response.json({error:'Выберите время от минуты до 180 дней в будущем.'},{status:400,headers});db.prepare('INSERT INTO telegram_channel_posts(id,channel_id,dedupe_key,topic,body,image,scheduled_at,next_attempt_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(randomUUID(),s.channel_id,'custom:'+randomUUID(),body.topic,body.body,body.image,body.at,body.at,now);return Response.json({ok:true},{headers})}
  const post=db.prepare('SELECT state FROM telegram_channel_posts WHERE id=? AND channel_id=?').get(body.id,s.channel_id) as {state:string}|undefined;
  if(!post)return Response.json({error:'Пост не найден.'},{status:404,headers});
  if(body.action==='cancel'){const changed=db.prepare("UPDATE telegram_channel_posts SET state='cancelled' WHERE id=? AND state IN ('queued','failed','uncertain')").run(body.id).changes;if(!changed)return Response.json({error:'Отправленный или отправляемый пост нельзя отменить здесь.'},{status:409,headers})}
  if(body.action==='retry'){const changed=db.prepare("UPDATE telegram_channel_posts SET state='queued',attempts=0,next_attempt_at=?,last_error=NULL WHERE id=? AND state IN ('failed','uncertain')").run(now,body.id).changes;if(!changed)return Response.json({error:'Повтор доступен только для ошибки или неподтверждённой отправки.'},{status:409,headers});kickChannelWorker()}
  if(body.action==='published'){const changed=db.prepare("UPDATE telegram_channel_posts SET state='sent',sent_at=?,last_error=NULL WHERE id=? AND state='uncertain'").run(now,body.id).changes;if(!changed)return Response.json({error:'Это действие доступно только для неподтверждённой отправки.'},{status:409,headers});db.prepare('UPDATE telegram_channel_settings SET last_sent_at=?,last_error=NULL WHERE id=1').run(now)}
  return Response.json({ok:true},{headers});
 }catch(e){const code=e instanceof TelegramError?e.code:'';return Response.json({error:messages[code]||'Не удалось выполнить действие. Повторите позже.'},{status:503,headers})}
}
