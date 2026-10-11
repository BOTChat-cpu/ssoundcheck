import {adminGuard} from '../../../../../lib/admin-auth';
import {getSqlite} from '../../../../../db';
import {orderIdSchema,noStore} from '../../../../../lib/song-orders';
import type {GiftCertificate} from '../../../../../lib/certificates';
import {certificatePng,certificatePdf} from '../../../../../lib/certificate-render';
export const dynamic='force-dynamic';
export async function GET(req:Request){const denied=adminGuard(req);if(denied)return denied;const url=new URL(req.url),id=url.searchParams.get('id'),format=url.searchParams.get('format')||'pdf';if(!orderIdSchema.safeParse(id).success||!['pdf','png'].includes(format))return Response.json({error:'Проверьте сертификат и формат файла.'},{status:400});const c=getSqlite().prepare('SELECT * FROM gift_certificates WHERE id=?').get(id) as GiftCertificate|undefined;if(!c)return Response.json({error:'Сертификат не найден.'},{status:404});try{const png=await certificatePng(c);const file=format==='pdf'?await certificatePdf(png):png;return new Response(new Uint8Array(file),{headers:{...noStore,'Content-Type':format==='pdf'?'application/pdf':'image/png','Content-Disposition':(url.searchParams.get('preview')==='1'?'inline':'attachment')+`; filename="${c.code}.${format}"`,'X-Content-Type-Options':'nosniff'}})}catch{return Response.json({error:'Не удалось создать файл. Попробуйте ещё раз.'},{status:503})}}
