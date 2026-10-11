import {dirname,join} from 'node:path';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {Readable} from 'node:stream';
export function privateSongFolder(){return join(dirname(process.env.DATABASE_PATH||'./data/site.sqlite'),'orders');}
export async function privateSongResponse(req:Request,file:string,preview:boolean,download=false){
 if(!/^[a-f0-9-]{36}-(?:full\.mp3|preview\.m4a)$/.test(file))return new Response(null,{status:404});
 const path=join(privateSongFolder(),file);
 try{const info=await stat(path);let start=0,end=info.size-1,status=200;const range=req.headers.get('range');
 if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${info.size}`}});if(match[1]){start=Number(match[1]);if(match[2])end=Math.min(Number(match[2]),end);}else{const suffix=Number(match[2]);if(suffix===0)return new Response(null,{status:416});start=Math.max(0,info.size-suffix);}if(start>end||start>=info.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${info.size}`}});status=206;}
 const headers:Record<string,string>={'Content-Type':download?'application/octet-stream':preview?'audio/mp4':'audio/mpeg','Content-Length':String(end-start+1),'Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;if(download)headers['Content-Disposition']='attachment; filename="SSoundCheck-song.mp3"';
 return new Response(req.method==='HEAD'?null:Readable.toWeb(createReadStream(path,{start,end})) as ReadableStream,{status,headers});
 }catch{return new Response(null,{status:404});}
}
