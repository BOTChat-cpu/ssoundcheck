export const dynamic = 'force-dynamic';
import {sameOrigin} from '../../../../lib/admin-auth';
import { getSiteAuth } from '../../../../lib/site-auth';
async function handle(req:Request){const path=new URL(req.url).pathname;if(req.method==='POST'&&(path==='/api/auth/request-password-reset'||path==='/api/auth/reset-password')&&!sameOrigin(req))return Response.json({error:'Недопустимый запрос.'},{status:403});try{return await getSiteAuth().handler(req)}catch{return Response.json({error:'Вход временно недоступен. Попробуйте позже.'},{status:503})}}
export {handle as GET,handle as POST};
