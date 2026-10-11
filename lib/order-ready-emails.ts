import {access} from 'node:fs/promises';
import {join} from 'node:path';
import {privateSongFolder} from './private-song-media';
import {randomUUID} from 'node:crypto';
import {getSqlite} from '../db';
import {getOrder,type SongOrder} from './song-orders';
import {mailConfigured,sendTransactionalEmail} from './auth-mail.mjs';
export type ReadyEmail={id:string;order_id:string;media_version:string;state:'queued'|'sending'|'sent'|'failed'|'skipped';attempts:number;next_attempt_at:number;lease_until:number|null;sent_at:number|null;last_error:string|null;created_at:number;updated_at:number};
export function readyEmail(order:SongOrder){if(!order.media_version)return null;return (getSqlite().prepare('SELECT * FROM order_ready_emails WHERE order_id=? AND media_version=?').get(order.id,order.media_version) as ReadyEmail|undefined)||null;}
export function publicReadyEmail(row:ReadyEmail|null){return row?{state:row.state,attempts:row.attempts,sentAt:row.sent_at,nextAttemptAt:row.next_attempt_at,reason:row.last_error}:null;}
// Called inside the same SQLite transaction that makes the preview available.
export function enqueueReadyEmail(order:SongOrder){if(order.status!=='ready'||!order.preview_file||!order.full_file||!order.media_version)return false;const now=Date.now();return getSqlite().prepare('INSERT OR IGNORE INTO order_ready_emails(id,order_id,media_version,next_attempt_at,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(randomUUID(),order.id,order.media_version,now,now,now).changes>0;}
function escape(value:string){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));}
function message(order:SongOrder,email:string,id:string){
 const origin=new URL(process.env.BETTER_AUTH_URL!).origin,url=origin+'/account#music',number=order.id.slice(0,8).toUpperCase(),title=order.song_title||'Ваша песня';
 const step=order.paid_at?'Полная песня уже доступна в личном кабинете.':'Послушайте фрагмент длительностью 40 секунд. Если всё нравится, откройте реквизиты в кабинете. Полная песня станет доступна после подтверждения оплаты студией.';
 return {from:process.env.AUTH_FROM_EMAIL,to:email,subject:'Ваш фрагмент готов — SSoundCheck',messageId:'<'+id+'@'+new URL(origin).hostname+'>',text:'Ваш фрагмент готов!\n\n'+title+'\nЗаказ № '+number+'\n\n'+step+'\n\nОткрыть личный кабинет:\n'+url+'\n\nВойдите с email, на который пришло это письмо. Если нужны изменения, откройте вкладку «Правки».\n\nSSoundCheck',html:'<!doctype html><html lang="ru"><body style="margin:0;background:#101424;font-family:Arial,sans-serif;color:#f5f5fa"><div style="max-width:560px;margin:32px auto;padding:32px;background:#20283b;border-radius:16px"><p style="color:#c4f36c;font-size:12px;letter-spacing:2px">SSOUNDCHECK</p><h1 style="font-size:28px;line-height:1.3">Ваш фрагмент готов!</h1><p style="font-size:20px">'+escape(title)+'</p><p style="color:#b3bdd0">Заказ № '+number+'</p><p style="line-height:1.7">'+step+'</p><p style="margin:28px 0"><a href="'+escape(url)+'" style="display:inline-block;padding:15px 22px;border-radius:9px;background:#c4f36c;color:#172111;text-decoration:none;font-weight:bold">Послушать в кабинете</a></p><p style="font-size:13px;line-height:1.7;color:#b3bdd0">Войдите с email, на который пришло это письмо. Если нужны изменения, откройте вкладку «Правки».</p><p style="font-size:12px;color:#b3bdd0">Если кнопка не открывается: <a style="color:#c4f36c" href="'+escape(url)+'">'+escape(url)+'</a></p></div></body></html>'};
}
function claim(){const db=getSqlite(),now=Date.now();return db.transaction(()=>{
 const row=db.prepare("SELECT * FROM order_ready_emails WHERE (state='queued' AND next_attempt_at<=?) OR (state='sending' AND lease_until<=?) ORDER BY created_at LIMIT 1").get(now,now) as ReadyEmail|undefined;if(!row)return null;
 if(row.attempts>=5){db.prepare("UPDATE order_ready_emails SET state='failed',lease_until=NULL,last_error='delivery_failed',updated_at=? WHERE id=?").run(now,row.id);return null;}
 db.prepare("UPDATE order_ready_emails SET state='sending',attempts=attempts+1,lease_until=?,updated_at=? WHERE id=?").run(now+120000,now,row.id);return {...row,attempts:row.attempts+1,lease_until:now+120000};
 })();}
export async function processReadyEmails(){
 if(!mailConfigured()||!process.env.BETTER_AUTH_URL)return;
 const db=getSqlite();for(let i=0;i<3;i++){const row=claim();if(!row)return;
 const update=(state:ReadyEmail['state'],reason:string|null=null)=>db.prepare('UPDATE order_ready_emails SET state=?,last_error=?,lease_until=NULL,sent_at=?,updated_at=? WHERE id=? AND lease_until=?').run(state,reason,state==='sent'?Date.now():null,Date.now(),row.id,row.lease_until);
 const order=getOrder(row.order_id);
 if(!order||order.status!=='ready'||order.media_version!==row.media_version||!order.preview_file||!order.full_file){update('skipped','order_changed');continue;}
 const owner=db.prepare('SELECT email FROM auth_user WHERE id=?').get(order.user_id) as {email:string}|undefined;
 if(!owner||owner.email.endsWith('.invalid')||!/^\S+@\S+\.\S+$/.test(owner.email)||/[\r\n]/.test(owner.email)){update('skipped','no_email');continue;}
 try{await Promise.all([access(join(privateSongFolder(),order.preview_file)),access(join(privateSongFolder(),order.full_file))]);await sendTransactionalEmail(message(order,owner.email,row.id),process.env,'order-ready-'+row.id);update('sent');}
 catch{const now=Date.now(),delay=[60000,300000,900000,3600000][row.attempts-1]||3600000;db.prepare('UPDATE order_ready_emails SET state=?,last_error=?,lease_until=NULL,next_attempt_at=?,updated_at=? WHERE id=? AND lease_until=?').run(row.attempts>=5?'failed':'queued','delivery_failed',now+delay,now,row.id,row.lease_until);console.error('Order ready email delivery failed');}
 }
}
const workerKey=Symbol.for('ssoundcheck.ready-email-worker');
export function startReadyEmailWorker(){
 const state=globalThis as typeof globalThis&{[workerKey]?:boolean};if(state[workerKey])return;state[workerKey]=true;let busy=false;
 const tick=async()=>{if(busy)return;busy=true;try{await processReadyEmails()}catch{console.error('Order email queue unavailable')}finally{busy=false}};
 setTimeout(()=>void tick(),1000).unref();setInterval(()=>void tick(),30000).unref();
}

export function kickReadyEmails(){void processReadyEmails().catch(()=>console.error('Order email queue unavailable'));}
