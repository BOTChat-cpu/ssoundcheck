import {adminGuard} from '../../../../../../lib/admin-auth';
import {getOrder,noStore} from '../../../../../../lib/song-orders';
import {getSqlite} from '../../../../../../db';
import {kickReadyEmails,enqueueReadyEmail,readyEmail,publicReadyEmail} from '../../../../../../lib/order-ready-emails';
import {mailConfigured} from '../../../../../../lib/auth-mail.mjs';
export const dynamic='force-dynamic';
export async function GET(req:Request,ctx:{params:Promise<{id:string}>}){const denied=adminGuard(req);if(denied)return denied;const order=getOrder((await ctx.params).id);if(!order)return Response.json({error:'Заказ не найден.'},{status:404});return Response.json({configured:mailConfigured(),notification:publicReadyEmail(readyEmail(order))},{headers:noStore});}
export async function POST(req:Request,ctx:{params:Promise<{id:string}>}){
 const denied=adminGuard(req);if(denied)return denied;const id=(await ctx.params).id;
 if(!mailConfigured())return Response.json({error:'Сначала подключите исходящую почту сайта.'},{status:503});
 const result=getSqlite().transaction(()=>{const order=getOrder(id);if(!order)return {status:404,error:'Заказ не найден.'};if(order.status!=='ready'||!order.full_file||!order.preview_file||!order.media_version)return {status:409,error:'Сначала загрузите песню и подготовьте фрагмент.'};
 const row=readyEmail(order),now=Date.now();if(row?.state==='sent')return {status:409,error:'Письмо для этой версии песни уже отправлено.'};if(row?.state==='sending'||row?.state==='queued')return {status:409,error:'Письмо уже ожидает отправки.'};if(row&&now-row.updated_at<60000)return {status:429,error:'Повторите через минуту.'};
 if(row)getSqlite().prepare("UPDATE order_ready_emails SET state='queued',attempts=0,lease_until=NULL,last_error=NULL,next_attempt_at=?,updated_at=? WHERE id=?").run(now,now,row.id);else enqueueReadyEmail(order);return {status:200};})();
 if(result.status===200)kickReadyEmails();
 return Response.json(result.status===200?{ok:true}:{error:result.error},{status:result.status,headers:noStore});
}
