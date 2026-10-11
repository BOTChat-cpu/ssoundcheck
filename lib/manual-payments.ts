import {getSqlite} from '../db';
export type ManualPayment={id:string;order_id:string;price_kopecks:number;media_version:string;status:'pending'|'confirmed'|'rejected';created_at:number;reviewed_at:number|null};
export function manualSettings(){return getSqlite().prepare('SELECT * FROM manual_payment_settings WHERE id=1').get() as {enabled:number;recipient:string;bank:string;details:string};}
export function latestManualPayment(id:string){return getSqlite().prepare('SELECT * FROM manual_payment_requests WHERE order_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1').get(id) as ManualPayment|undefined;}
