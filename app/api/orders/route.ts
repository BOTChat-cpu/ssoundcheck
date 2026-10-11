import {revisionsByOrder} from '../../../lib/order-revisions';
import {briefSchema,customerGuard,customerOrder,noStore,type SongOrder} from '../../../lib/song-orders';
import {getContent} from '../../../lib/site-content';
import {getSqlite} from '../../../db';
import {randomUUID} from 'node:crypto';
export const dynamic='force-dynamic';
export async function GET(req:Request){const auth=await customerGuard(req);if(auth.error)return auth.error;const rows=getSqlite().prepare('SELECT * FROM song_orders WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(auth.user.id) as SongOrder[];const revisions=revisionsByOrder(rows.map(o=>o.id));return Response.json({orders:rows.map(o=>({...customerOrder(o),revisions:revisions.get(o.id)||[]})),paymentAvailable:false},{headers:noStore});}
export async function POST(req:Request){const auth=await customerGuard(req);if(auth.error)return auth.error;
 try{const raw=await req.text();if(raw.length>8000)return Response.json({error:'Слишком длинная заявка.'},{status:413});const parsed=briefSchema.safeParse(JSON.parse(raw));if(!parsed.success)return Response.json({error:'Заполните поля заявки. История — от 10 до 2000 символов.'},{status:400});
 const data=parsed.data,config=getContent(),plan=[...config.plans,config.revisionAddon][data.planIndex];const price=Number(plan.price.replace(/ /g,''))*100;
 if(!Number.isSafeInteger(price)||price<=0)return Response.json({error:'Стоимость услуги уточняется. Напишите нам в Telegram.'},{status:503});
 const db=getSqlite(),id=data.requestId||randomUUID(),now=Date.now();
 const inserted=db.transaction(()=>{const existing=db.prepare('SELECT * FROM song_orders WHERE id=?').get(id) as SongOrder|undefined;if(existing){const same=existing.user_id===auth.user.id&&existing.service===plan.name&&existing.recipient===data.recipient&&existing.occasion===data.occasion&&existing.genre===data.genre&&existing.mood===data.mood&&existing.story===data.story&&existing.contact===data.contact;return same?'existing':'conflict';}const recent=db.prepare('SELECT COUNT(*) AS n FROM song_orders WHERE user_id=? AND created_at>?').get(auth.user.id,now-60*60*1000) as {n:number};if(recent.n>=5)return false;
 db.prepare('INSERT INTO song_orders(id,user_id,service,price_kopecks,recipient,occasion,genre,mood,story,contact,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,auth.user.id,plan.name,price,data.recipient,data.occasion,data.genre,data.mood,data.story,data.contact,now,now);return true;})();
 if(inserted==='conflict')return Response.json({error:'Заявка уже была отправлена с другими данными. Откройте форму заново.'},{status:409});if(!inserted)return Response.json({error:'Вы уже отправили несколько заявок. Попробуйте позже.'},{status:429});return Response.json({ok:true,id},{status:inserted==='existing'?200:201,headers:noStore});
 }catch{return Response.json({error:'Не удалось сохранить заявку.'},{status:400});}
}
