import {sameOrigin,isAdmin} from '../../../lib/admin-auth';
import {trafficReady,updateTraffic} from '../../../lib/site-traffic';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 const headers={'Cache-Control':'private, no-store'};
 if(!sameOrigin(req))return new Response(null,{status:403,headers});
 if(!trafficReady()||isAdmin(req))return new Response(null,{status:204,headers});
 if(Number(req.headers.get('content-length')||0)>256)return new Response(null,{status:413,headers});
 let state:string;try{const raw=await req.text();if(raw.length>256)return new Response(null,{status:413,headers});state=JSON.parse(raw).state}catch{return new Response(null,{status:400,headers})}
 if(!['browser','active','automated'].includes(state))return new Response(null,{status:400,headers});
 try{updateTraffic(req,state as 'browser'|'active'|'automated')}catch{/* No effect on customer flows. */}
 return new Response(null,{status:204,headers});
}
