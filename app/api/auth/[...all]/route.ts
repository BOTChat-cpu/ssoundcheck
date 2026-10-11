export const dynamic = 'force-dynamic';
import { getSiteAuth } from '../../../../lib/site-auth';
async function handle(req:Request){try{return await getSiteAuth().handler(req)}catch{return Response.json({error:'Вход временно недоступен. Попробуйте позже.'},{status:503})}}
export {handle as GET,handle as POST};
