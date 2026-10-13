import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {getSqlite} from '../db';
import {deliverOne} from './telegram-channel-core.mjs';
const files={welcome:'telegram/welcome.jpg',story:'process-01.webp',sound:'process-03.webp',gift:'process-04.webp'};
const photos=new Map<string,Promise<Buffer>>();
async function photo(key:string){if(!(key in files))throw Error('image_unavailable');if(!photos.has(key)){const pending=readFile(join(process.cwd(),'public/images',files[key as keyof typeof files])).then(b=>sharp(b).rotate().resize({width:1254,withoutEnlargement:true}).jpeg({quality:88}).toBuffer());photos.set(key,pending);pending.catch(()=>photos.delete(key))}return photos.get(key)!}
let started=false,running=false;
async function tick(){if(running||!process.env.TELEGRAM_BOT_TOKEN)return;running=true;try{await deliverOne(getSqlite(),process.env,photo)}catch{/* Never log credentials or upstream URLs. */}finally{running=false}}
export function startChannelWorker(){if(started)return;started=true;setTimeout(()=>void tick(),1500).unref();setInterval(()=>void tick(),60000).unref()}
export function kickChannelWorker(){void tick()}
