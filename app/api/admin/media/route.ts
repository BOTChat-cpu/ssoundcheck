import {adminGuard} from '../../../../lib/admin-auth';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';
export const dynamic='force-dynamic';
const LIMIT=20*1024*1024;
export async function POST(req:Request){
 const denied=adminGuard(req);if(denied)return denied;
 if(req.headers.get('content-type')!=='audio/mpeg')return Response.json({error:'Выберите MP3-файл.'},{status:415});
 if(Number(req.headers.get('content-length'))>LIMIT)return Response.json({error:'Размер файла — не более 20 МБ.'},{status:413});
 try{
  const reader=req.body?.getReader();if(!reader)return Response.json({error:'Файл не получен.'},{status:400});const chunks:Uint8Array[]=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>LIMIT){await reader.cancel();return Response.json({error:'Размер файла — не более 20 МБ.'},{status:413});}chunks.push(value);}
  const buffer=Buffer.concat(chunks);
  if(buffer.length<128 || !(buffer.subarray(0,3).toString()==='ID3'||(buffer[0]===255&&(buffer[1]&224)===224)))return Response.json({error:'Файл не распознан как MP3.'},{status:400});
  const folder=join(dirname(process.env.DATABASE_PATH||'./data/site.sqlite'),'media');await mkdir(folder,{recursive:true,mode:0o700});const name=randomUUID()+'.mp3';await writeFile(join(folder,name),buffer,{mode:0o600,flag:'wx'});
  return Response.json({src:'/api/media/'+name},{status:201});
 }catch{return Response.json({error:'Не удалось загрузить файл.'},{status:503});}
}
