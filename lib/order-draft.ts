export type OrderDraft={selected:number;topic:string;genre:string;mood:string;orderContact:string;recipient:string;occasion:string;requestId:string|null};
export const emptyDraft:OrderDraft={selected:2,topic:'',genre:'',mood:'',orderContact:'',recipient:'',occasion:'',requestId:null};
export function hasDraft(d:OrderDraft){return !!(d.topic||d.genre||d.mood||d.orderContact||d.recipient||d.occasion)}
export function readDraft(raw:string|null,now=Date.now()):OrderDraft|null{
 try{if(!raw)return null;const {version,savedAt,data}=JSON.parse(raw);if(version!==1||!Number.isFinite(savedAt)||now-savedAt>30*86400000||savedAt>now+60000||!data||!Number.isInteger(data.selected)||data.selected<0||data.selected>3)return null;
 for(const [key,max] of Object.entries({topic:2000,genre:100,mood:100,orderContact:200,recipient:100,occasion:100}))if(typeof data[key]!=='string'||data[key].length>max)return null;
 if(data.requestId!==null&&(typeof data.requestId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.requestId)))return null;
 return Object.fromEntries(Object.keys(emptyDraft).map(key=>[key,data[key]])) as OrderDraft;
 }catch{return null}
}
export function writeDraft(data:OrderDraft){return JSON.stringify({version:1,savedAt:Date.now(),data})}
