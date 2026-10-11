import {stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import {dirname,join} from 'node:path';
export const dynamic='force-dynamic';
async function serve(req:Request,context:{params:Promise<{file:string}>},head:boolean){
 const {file}=await context.params;
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.mp3$/.test(file))return new Response(null,{status:404});
 const path=join(dirname(process.env.DATABASE_PATH||'./data/site.sqlite'),'media',file);
 try{const info=await stat(path);let start=0,end=info.size-1,status=200;const range=req.headers.get('range');
 if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${info.size}`}});if(match[1]){start=Number(match[1]);if(match[2])end=Math.min(Number(match[2]),end);}else{const suffix=Number(match[2]);if(suffix===0)return new Response(null,{status:416});start=Math.max(0,info.size-suffix);}if(start>end||start>=info.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${info.size}`}});status=206;}
 const headers:Record<string,string>={'Content-Type':'audio/mpeg','Content-Length':String(end-start+1),'Accept-Ranges':'bytes','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'};if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
 return new Response(head?null:Readable.toWeb(createReadStream(path,{start,end})) as ReadableStream,{status,headers});
 }catch{return new Response(null,{status:404});}
}
export async function GET(req:Request,context:{params:Promise<{file:string}>}){return serve(req,context,false);}
export async function HEAD(req:Request,context:{params:Promise<{file:string}>}){return serve(req,context,true);}
