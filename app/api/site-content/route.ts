import {getContent} from '../../../lib/site-content';
export const dynamic='force-dynamic';
export async function GET(){try{return Response.json(getContent(),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Не удалось загрузить настройки.'},{status:503});}}
