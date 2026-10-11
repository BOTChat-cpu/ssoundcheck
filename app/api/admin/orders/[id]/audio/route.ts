import {latestManualPayment} from '../../../../../../lib/manual-payments';
import {adminGuard} from '../../../../../../lib/admin-auth';
import {getOrder} from '../../../../../../lib/song-orders';
import {privateSongFolder,privateSongResponse} from '../../../../../../lib/private-song-media';
import {getSqlite} from '../../../../../../db';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
export const dynamic='force-dynamic';
const run=promisify(execFile),LIMIT=20*1024*1024;let processing=false;
export async function GET(req:Request,ctx:{params:Promise<{id:string}>}){const denied=adminGuard(req);if(denied)return denied;const {id}=await ctx.params,order=getOrder(id);if(!order)return new Response(null,{status:404});const preview=new URL(req.url).searchParams.get('version')!=='full',file=preview?order.preview_file:order.full_file;if(!file)return new Response(null,{status:404});return privateSongResponse(req,file,preview);}
export async function POST(req:Request,ctx:{params:Promise<{id:string}>}){
 const denied=adminGuard(req);if(denied)return denied;
 const {id}=await ctx.params,order=getOrder(id);if(!order)return Response.json({error:'Заказ не найден.'},{status:404});if(order.status==='cancelled')return Response.json({error:'Этот заказ отменён.'},{status:409});
 if(req.headers.get('content-type')!=='audio/mpeg')return Response.json({error:'Выберите MP3-файл.'},{status:415});if(Number(req.headers.get('content-length'))>LIMIT)return Response.json({error:'Файл должен быть не больше 20 МБ.'},{status:413});if(processing)return Response.json({error:'Другая песня обрабатывается. Повторите через минуту.'},{status:409});
 const offset=Number(new URL(req.url).searchParams.get('start')||'0');if(!Number.isFinite(offset)||offset<0||offset>1800)return Response.json({error:'Начало фрагмента — от 0 до 1800 секунд.'},{status:400});
 processing=true;const version=randomUUID(),full=version+'-full.mp3',preview=version+'-preview.m4a',folder=privateSongFolder();let saved=false;
 try{
  try{await run('/usr/bin/ffmpeg',['-version'],{timeout:5000});await run('/usr/bin/ffprobe',['-version'],{timeout:5000});}catch{return Response.json({error:'На сервере нужно один раз включить обработку песен. В консоли VPS выполните: bash /srv/ssoundcheck/current/scripts/beget/setup-order-media.sh'},{status:503});}
  const reader=req.body?.getReader();if(!reader)return Response.json({error:'Файл не получен.'},{status:400});const chunks:Uint8Array[]=[];let size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>LIMIT){await reader.cancel();return Response.json({error:'Файл должен быть не больше 20 МБ.'},{status:413});}chunks.push(value);}
  const buffer=Buffer.concat(chunks);if(buffer.length<128||!(buffer.subarray(0,3).toString()==='ID3'||(buffer[0]===255&&(buffer[1]&224)===224)))return Response.json({error:'Файл не распознан как MP3.'},{status:400});await mkdir(folder,{recursive:true,mode:0o700});await writeFile(join(folder,full),buffer,{mode:0o600,flag:'wx'});
  const inspected=await run('/usr/bin/ffprobe',['-v','error','-protocol_whitelist','file,pipe','-show_entries','format=duration:stream=codec_name,codec_type','-of','json',join(folder,full)],{timeout:10000,maxBuffer:65536});const info=JSON.parse(inspected.stdout) as {format:{duration:string};streams:{codec_type:string;codec_name:string}[]};const duration=Number(info.format?.duration);
  if(!info.streams?.some(s=>s.codec_type==='audio'&&s.codec_name==='mp3')||!Number.isFinite(duration)||duration<offset+40||duration>1800)return Response.json({error:'Нужна MP3-песня длиной не менее 40 секунд после начала фрагмента и не более 30 минут.'},{status:400});
  await run('/usr/bin/ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-protocol_whitelist','file,pipe','-i',join(folder,full),'-ss',String(offset),'-t','40','-map','0:a:0','-vn','-map_metadata','-1','-ar','48000','-ac','2','-c:a','aac','-b:a','192k','-threads','1','-movflags','+faststart','-y',join(folder,preview)],{timeout:60000,maxBuffer:65536});
  const checked=await run('/usr/bin/ffprobe',['-v','error','-show_entries','format=duration','-of','json',join(folder,preview)],{timeout:5000,maxBuffer:65536});const previewDuration=Number(JSON.parse(checked.stdout).format?.duration);if(Math.abs(previewDuration-40)>0.001)throw Error('Invalid preview duration');
  const result=getSqlite().transaction(()=>{const latest=getOrder(id);if(!latest||latest.status==='cancelled')return false;const payment=getSqlite().prepare("SELECT id FROM order_payments WHERE order_id=? AND state IN ('created','pending') LIMIT 1").get(id);if(payment||latestManualPayment(id)?.status==='pending')return false;getSqlite().prepare('UPDATE song_orders SET full_file=?,preview_file=?,media_version=?,duration=?,status=?,updated_at=? WHERE id=?').run(full,preview,version,duration,'ready',Date.now(),id);return true;})();
  if(!result)return Response.json({error:'Заказ изменился или по нему уже идёт оплата. Повторите после завершения платежа.'},{status:409});saved=true;return Response.json({ok:true,previewDuration:40,duration});
 }catch{return Response.json({error:'Не удалось обработать песню. Проверьте MP3-файл и попробуйте снова.'},{status:503});}
 finally{processing=false;if(!saved)await Promise.allSettled([unlink(join(folder,full)),unlink(join(folder,preview))]);}
}
