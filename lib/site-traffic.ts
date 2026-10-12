import {createHmac,createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {getSqlite} from '../db';
export const VISIT_COOKIE='ssoundcheck_visit',VISITOR_COOKIE='ssoundcheck_visitor';
const UUID=/^[a-f0-9-]{36}$/;
const sign=(value:string)=>createHmac('sha256',process.env.BETTER_AUTH_SECRET!).update('traffic:'+value).digest('hex');
export function trafficReady(){return Boolean(process.env.BETTER_AUTH_SECRET&&process.env.DATABASE_PATH)}
export function seal(value:string){return value+'.'+sign(value)}
export function unseal(value:string|undefined){if(!value||!trafficReady())return null;const [id,sig]=value.split('.');if(!UUID.test(id||'')||!/^[a-f0-9]{64}$/.test(sig||''))return null;return timingSafeEqual(Buffer.from(sig),Buffer.from(sign(id)))?id:null}
export function trafficCookie(req:Request,name:string){return req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)}
export const dayOf=(now:number)=>new Date(now+3*3600_000).toISOString().slice(0,10);
export function robotAgent(ua:string){return /bot\b|crawler|spider|headless|slurp|facebookexternalhit|telegrambot|curl\/|wget\/|python-requests|python-urllib|go-http-client/i.test(ua)}
function sourceOf(req:Request){const url=new URL(req.url),utm=url.searchParams.get('utm_source')?.toLowerCase();const known:Record<string,string>={telegram:'telegram',tg:'telegram',vk:'vk',vkontakte:'vk',yandex:'yandex',google:'google',bing:'bing'};if(utm)return known[utm]||'campaign';try{const h=new URL(req.headers.get('referer')||'').hostname;if(h===url.hostname)return 'internal';if(h==='t.me'||h.endsWith('.telegram.org'))return 'telegram';if(h==='vk.com'||h.endsWith('.vk.com'))return 'vk';if(/(^|\.)yandex\./.test(h))return 'yandex';if(/(^|\.)google\./.test(h))return 'google';if(/(^|\.)bing\.com$/.test(h))return 'bing';return 'external'}catch{return 'direct'}}
let cleanedAt=0;
export function recordTraffic(req:Request){
 const db=getSqlite(),now=Date.now();
 if(now-cleanedAt>3600_000){db.prepare('DELETE FROM site_visits WHERE started_at < ?').run(now-90*86400_000);db.prepare('DELETE FROM site_bot_days WHERE day < ?').run(dayOf(now-90*86400_000));cleanedAt=now}
 const ua=req.headers.get('user-agent')||'';
 if(robotAgent(ua)){db.prepare('INSERT INTO site_bot_days VALUES (?,1) ON CONFLICT(day) DO UPDATE SET requests=requests+1').run(dayOf(now));return null}
 const visitor=unseal(trafficCookie(req,VISITOR_COOKIE))||randomUUID();
 let visit=unseal(trafficCookie(req,VISIT_COOKIE));
 const old=visit?db.prepare('SELECT last_seen FROM site_visits WHERE id=?').get(visit) as {last_seen:number}|undefined:null;
 if(!old||now-old.last_seen>1800_000)visit=randomUUID();
 const device=/iPad|Tablet/i.test(ua)?'tablet':/Mobile|iPhone|Android/i.test(ua)?'mobile':'desktop';
 db.prepare('INSERT INTO site_visits(id,visitor,started_at,last_seen,device,source) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen,views=views+1').run(visit,createHash('sha256').update(visitor).digest('hex'),now,now,device,sourceOf(req));
 return {visit:seal(visit!),visitor:seal(visitor)};
}
export function updateTraffic(req:Request,state:'browser'|'active'|'automated'){
 const id=unseal(trafficCookie(req,VISIT_COOKIE));if(!id)return false;
 const db=getSqlite(),now=Date.now(),row=db.prepare('SELECT started_at,last_seen,state FROM site_visits WHERE id=?').get(id) as {started_at:number;last_seen:number;state:number}|undefined;
 if(!row||now-row.last_seen>1800_000)return false;
 if(state==='active'&&now-row.started_at<2000)return false;
 const next=state==='automated'?3:state==='active'?2:1;
 // Robot state is terminal; visibility pings never downgrade an active visitor.
 db.prepare('UPDATE site_visits SET state=MAX(state,?),last_seen=? WHERE id=?').run(next,now,id);return true;
}
