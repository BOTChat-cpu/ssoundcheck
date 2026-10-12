import {adminGuard} from '../../../../lib/admin-auth';
import {getSqlite} from '../../../../db';
import {dayOf} from '../../../../lib/site-traffic';
export const dynamic='force-dynamic';
export function GET(req:Request){
 const denied=adminGuard(req);if(denied)return denied;
 const days=Number(new URL(req.url).searchParams.get('days')||7);if(![1,7,30,90].includes(days))return Response.json({error:'Выберите допустимый период.'},{status:400});
 const now=Date.now(),today=dayOf(now),start=Date.parse(today+'T00:00:00+03:00')-(days-1)*86400_000,db=getSqlite();
 const summary=db.prepare(`SELECT COUNT(*) visits,COUNT(DISTINCT CASE WHEN state!=3 THEN visitor END) visitors,COALESCE(SUM(CASE WHEN state!=3 THEN views ELSE 0 END),0) views,COALESCE(SUM(state=2),0) active,COALESCE(SUM(state=1),0) browser,COALESCE(SUM(state=0),0) unknown,COALESCE(SUM(state=3),0) automated FROM site_visits WHERE started_at>=?`).get(start) as Record<string,number>;
 const bots=db.prepare('SELECT COALESCE(SUM(requests),0) requests FROM site_bot_days WHERE day>=?').get(dayOf(start)) as {requests:number};
 const daily=db.prepare(`SELECT date(started_at/1000,'unixepoch','+3 hours') day,COUNT(*) visits,SUM(state=2) active,SUM(state=1) browser,SUM(state=0) unknown,SUM(state=3) automated FROM site_visits WHERE started_at>=? GROUP BY day ORDER BY day`).all(start);
 const botDays=db.prepare('SELECT day,requests FROM site_bot_days WHERE day>=? ORDER BY day').all(dayOf(start));
 const sources=db.prepare(`SELECT source,COUNT(*) visits,SUM(state=2) active FROM site_visits WHERE started_at>=? AND state!=3 GROUP BY source ORDER BY visits DESC`).all(start);
 const devices=db.prepare(`SELECT device,COUNT(*) visits FROM site_visits WHERE started_at>=? AND state!=3 GROUP BY device ORDER BY visits DESC`).all(start);
 const recent=db.prepare('SELECT substr(id,1,8) ref,started_at,last_seen,views,state,device,source FROM site_visits WHERE started_at>=? ORDER BY started_at DESC LIMIT 50').all(start);
 const registrations={total:(db.prepare('SELECT COUNT(*) count FROM auth_user').get() as {count:number}).count,period:(db.prepare('SELECT COUNT(*) count FROM auth_user WHERE created_at>=?').get(start) as {count:number}).count,today:(db.prepare('SELECT COUNT(*) count FROM auth_user WHERE created_at>=?').get(Date.parse(today+'T00:00:00+03:00')) as {count:number}).count};
 const first=db.prepare('SELECT MIN(started_at) started FROM site_visits').get() as {started:number|null};
 return Response.json({days,from:dayOf(start),today,firstRecordedAt:first.started,registrations,summary:{...summary,robotRequests:bots.requests},daily,botDays,sources,devices,recent},{headers:{'Cache-Control':'private, no-store'}});
}
