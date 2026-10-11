import {z} from 'zod';
export type GiftCertificate={id:string;code:string;recipient:string;sender:string;service:string;plan_index:number;message:string;status:'issued'|'redeemed'|'cancelled';created_at:number;updated_at:number};
export const certificateSchema=z.object({requestId:z.string().uuid(),recipient:z.string().trim().min(1).max(80),sender:z.string().trim().min(1).max(80),planIndex:z.number().int().min(0).max(2),message:z.string().trim().min(1).max(400)});
