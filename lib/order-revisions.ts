import {getSqlite} from '../db';
export type RevisionRequest={id:string;order_id:string;message:string;status:'pending'|'reviewed';created_at:number;updated_at:number};
export function revisionsByOrder(ids:string[]){const grouped=new Map<string,RevisionRequest[]>();if(!ids.length)return grouped;const rows=getSqlite().prepare(`SELECT * FROM order_revisions WHERE order_id IN (${ids.map(()=>'?').join(',')}) ORDER BY created_at DESC`).all(...ids) as RevisionRequest[];for(const row of rows){const list=grouped.get(row.order_id)||[];list.push(row);grouped.set(row.order_id,list)}return grouped}
