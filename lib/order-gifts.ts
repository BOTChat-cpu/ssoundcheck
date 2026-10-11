import {z} from 'zod';
import {orderIdSchema} from './song-orders';
export type OrderGift={order_id:string;token:string;recipient:string;sender:string;title:string;message:string;theme:'night'|'rose'|'sunrise';enabled:number;updated_at:number};
export const giftSchema=z.object({orderId:orderIdSchema,recipient:z.string().trim().min(1).max(100),sender:z.string().trim().min(1).max(100),title:z.string().trim().min(1).max(120),message:z.string().trim().min(1).max(1500),theme:z.enum(['night','rose','sunrise']),enabled:z.boolean()});
