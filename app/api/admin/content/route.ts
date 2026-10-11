import {adminGuard} from '../../../../lib/admin-auth';
import {getContent,contentSchema} from '../../../../lib/site-content';
import {getSqlite} from '../../../../db';
export const dynamic='force-dynamic';
export async function GET(req:Request){const denied=adminGuard(req);if(denied)return denied;return Response.json(getContent(),{headers:{'Cache-Control':'no-store'}});}
export async function PUT(req:Request){const denied=adminGuard(req);if(denied)return denied;try{const raw=await req.text();if(raw.length>60000)return Response.json({error:'Слишком большой объём текста.'},{status:413});const parsed=contentSchema.safeParse(JSON.parse(raw));if(!parsed.success)return Response.json({error:'Проверьте заполнение полей. Цена — цифры и пробелы, длительность — минуты:секунды, ссылка — Telegram.'},{status:400});getSqlite().prepare('INSERT INTO site_content VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').run(JSON.stringify(parsed.data),Date.now());return Response.json({ok:true});}catch{return Response.json({error:'Не удалось сохранить настройки.'},{status:400});}}
