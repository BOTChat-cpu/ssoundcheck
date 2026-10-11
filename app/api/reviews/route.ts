export const dynamic = 'force-dynamic';
import {getSiteAuth} from '../../../lib/site-auth';
import { getDb } from '../../../db';
import { reviews } from '../../../db/schema';
import { desc,eq } from 'drizzle-orm';
export async function GET(){try{return Response.json(await getDb().select({id:reviews.id,name:reviews.name,body:reviews.body,rating:reviews.rating,createdAt:reviews.createdAt}).from(reviews).where(eq(reviews.status,'published')).orderBy(desc(reviews.createdAt)).limit(30));}catch{return Response.json({error:'Не удалось загрузить отзывы. Попробуйте позже.'},{status:503});}}
export async function POST(req:Request){
if(req.headers.get('origin')!==(process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL).origin : new URL(req.url).origin))return Response.json({error:'Недопустимый запрос'},{status:403});
try{const authSession=await getSiteAuth().api.getSession({headers:req.headers});if(!authSession)return Response.json({error:'Войдите в аккаунт сайта, чтобы оставить отзыв.',signIn:true},{status:401});const userId='site:'+authSession.user.id;const data=await req.json() as {name?:unknown;body?:unknown;rating?:unknown};const name=typeof data.name==='string'?data.name.trim():'';const body=typeof data.body==='string'?data.body.trim():'';const rating=Number(data.rating);
if(name.length<2||name.length>60||body.length<10||body.length>1500||!Number.isInteger(rating)||rating<1||rating>5)return Response.json({error:'Проверьте имя, оценку и текст отзыва (10–1500 символов).'},{status:400});
const db=getDb();const old=await db.select({id:reviews.id}).from(reviews).where(eq(reviews.userId,userId)).limit(1);if(old.length)return Response.json({error:'Вы уже оставили отзыв. Спасибо!'},{status:409});
await db.insert(reviews).values({id:crypto.randomUUID(),userId,name,body,rating,createdAt:Date.now(),status:'pending'});return Response.json({ok:true},{status:201});}catch{return Response.json({error:'Не удалось сохранить отзыв. Попробуйте позже.'},{status:503});}}