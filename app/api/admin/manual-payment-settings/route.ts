import {adminGuard} from '../../../../lib/admin-auth';
import {getSqlite} from '../../../../db';
import {manualSettings} from '../../../../lib/manual-payments';
import {noStore} from '../../../../lib/song-orders';
import {z} from 'zod';
export const dynamic='force-dynamic';
export async function GET(req:Request){const denied=adminGuard(req);if(denied)return denied;return Response.json(manualSettings(),{headers:noStore});}
const schema=z.object({enabled:z.boolean(),recipient:z.string().trim().max(100),bank:z.string().trim().max(100),details:z.string().trim().max(500)}).refine(s=>!s.enabled||(s.recipient.length>0&&s.bank.length>0&&s.details.length>0));
export async function PUT(req:Request){const denied=adminGuard(req);if(denied)return denied;try{const p=schema.safeParse(await req.json());if(!p.success)return Response.json({error:'Для включения заполните получателя, банк и реквизиты.'},{status:400});const s=p.data;getSqlite().prepare('UPDATE manual_payment_settings SET enabled=?,recipient=?,bank=?,details=? WHERE id=1').run(s.enabled?1:0,s.recipient,s.bank,s.details);return Response.json({ok:true},{headers:noStore});}catch{return Response.json({error:'Не удалось сохранить реквизиты.'},{status:400});}}
