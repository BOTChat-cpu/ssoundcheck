import {NextResponse,type NextRequest} from 'next/server';
import {isAdmin} from './lib/admin-auth';
import {recordTraffic,trafficReady,robotAgent,VISIT_COOKIE,VISITOR_COOKIE} from './lib/site-traffic';
export function proxy(req:NextRequest){
 const response=NextResponse.next();
 if(req.method!=='GET'||req.nextUrl.pathname!=='/'||req.nextUrl.searchParams.has('_rsc')||req.headers.has('rsc')||req.headers.has('next-router-prefetch')||req.headers.get('purpose')==='prefetch'||(!req.headers.get('accept')?.includes('text/html')&&!robotAgent(req.headers.get('user-agent')||''))||!trafficReady())return response;
 try{
  if(isAdmin(req))return response;
  const ids=recordTraffic(req);
  if(ids){const opts={httpOnly:true,sameSite:'lax' as const,secure:process.env.BETTER_AUTH_URL?.startsWith('https://')||false,path:'/'};response.cookies.set(VISIT_COOKIE,ids.visit,{...opts,maxAge:1800});response.cookies.set(VISITOR_COOKIE,ids.visitor,{...opts,maxAge:30*86400});response.headers.set('Cache-Control','private, no-store')}
 }catch{/* Analytics must never stop the public site from loading. */}
 return response;
}
export const config={matcher:[{source:'/',missing:[{type:'header',key:'rsc'},{type:'header',key:'next-router-prefetch'}]}]};
