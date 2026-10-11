import {getSqlite} from '../db';
import {getSiteAuth} from './site-auth';
import {sameOrigin} from './admin-auth';
import {z} from 'zod';
export type SongOrder={song_title:string;cover_theme:'night'|'rose'|'sunrise';id:string;user_id:string;service:string;price_kopecks:number;currency:string;recipient:string;occasion:string;genre:string;mood:string;story:string;contact:string;status:'submitted'|'working'|'ready'|'cancelled';full_file:string|null;preview_file:string|null;media_version:string|null;duration:number|null;paid_at:number|null;payment_provider:string|null;payment_id:string|null;due_date:string|null;customer_message:string;created_at:number;updated_at:number};
export type CustomerOrder=Omit<SongOrder,'user_id'|'full_file'|'preview_file'|'media_version'|'payment_provider'|'payment_id'> & {hasPreview:boolean;canDownload:boolean};
export const briefSchema=z.object({requestId:z.string().uuid().optional(),planIndex:z.number().int().min(0).max(3),recipient:z.string().trim().min(1).max(100),occasion:z.string().trim().min(1).max(100),genre:z.string().trim().min(1).max(100),mood:z.string().trim().min(1).max(100),story:z.string().trim().min(10).max(2000),contact:z.string().trim().min(3).max(200)});
export const orderIdSchema=z.string().uuid();
export function getOrder(id:string){if(!orderIdSchema.safeParse(id).success)return undefined;return getSqlite().prepare('SELECT * FROM song_orders WHERE id=?').get(id) as SongOrder|undefined;}
export function customerOrder(order:SongOrder):CustomerOrder{
 const {user_id,full_file,preview_file,media_version,payment_provider,payment_id,...safe}=order;
 return {...safe,hasPreview:!!preview_file&&order.status==='ready',canDownload:!!full_file&&!!order.paid_at&&order.status==='ready'};
}
export async function customerGuard(req:Request){
 if(req.method!=='GET'&&req.method!=='HEAD'&&!sameOrigin(req))return {error:Response.json({error:'Недопустимый запрос.'},{status:403})};
 try{const session=await getSiteAuth().api.getSession({headers:req.headers});if(!session)return {error:Response.json({error:'Войдите в аккаунт сайта.',signIn:true},{status:401})};return {user:session.user};}catch{return {error:Response.json({error:'Вход временно недоступен.'},{status:503})};}
}
export const noStore={'Cache-Control':'private, no-store'};
