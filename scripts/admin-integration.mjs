import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {randomBytes,scryptSync} from 'node:crypto';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const require=createRequire(root+'/package.json'),Database=require('better-sqlite3');
const dir=mkdtempSync(join(tmpdir(),'ssound-admin-test-')),dbPath=join(dir,'site.sqlite');
const db=new Database(dbPath);db.exec('CREATE TABLE ssoundcheck_migrations(name TEXT PRIMARY KEY,applied_at INTEGER NOT NULL)');
for(const name of ['0000_funny_the_leader.sql','0001_lively_star_brand.sql']){db.exec(readFileSync(root+'/drizzle/'+name,'utf8'));db.prepare('INSERT INTO ssoundcheck_migrations VALUES (?,?)').run(name,Date.now());}
db.prepare('INSERT INTO reviews VALUES (?,?,?,?,?,?)').run('existing','test:existing','Слушатель','Существующий отзыв сохраняется',5,Date.now());db.close();
const password=randomBytes(16).toString('hex'),salt=randomBytes(16).toString('hex');
const env={...process.env,DATABASE_PATH:dbPath,BETTER_AUTH_URL:'http://127.0.0.1:3189',BETTER_AUTH_SECRET:randomBytes(48).toString('hex'),SSOUNDCHECK_ADMIN_PASSWORD_HASH:'scrypt$'+salt+'$'+scryptSync(password,salt,64).toString('hex')};
async function migrate(){await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['scripts/beget/migrate.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});let output='';p.stderr.on('data',b=>output+=b);p.on('exit',code=>code?reject(Error(output)):resolve());});}
await migrate();await migrate();
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3189'],{cwd:root,env,stdio:['ignore','pipe','pipe']});let logs='';server.stderr.on('data',b=>logs+=b);server.stdout.on('data',()=>{});
const origin=env.BETTER_AUTH_URL;let cookie='';
async function request(path,{method='GET',body,auth=true,requestOrigin=origin,headers={}}={}){return fetch(origin+path,{method,headers:{...(method!=='GET'?{Origin:requestOrigin}:{}),...(auth&&cookie?{Cookie:cookie}:{}),...(body&&typeof body==='string'?{'Content-Type':'application/json'}:{}),...headers},body});}
let checks=0;
function check(condition,message){assert.ok(condition,message);checks++;}
try{
 for(let i=0;i<60;i++){try{const r=await fetch(origin+'/api/admin/session');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,150));}
 let r=await request('/api/reviews');let list=await r.json();check(list.length===1&&list[0].id==='existing','existing review remains published');
 for(const path of ['/api/admin/content','/api/admin/reviews']){r=await request(path,{auth:false});check(r.status===401,'anonymous admin denied');}
 r=await request('/api/admin/session',{method:'POST',body:JSON.stringify({password}),requestOrigin:'https://evil.example'});check(r.status===403,'cross-origin login rejected');
 r=await request('/api/admin/session',{method:'POST',body:JSON.stringify({password:'wrong'})});check(r.status===401,'wrong password rejected');
 r=await request('/api/admin/session',{method:'POST',body:JSON.stringify({password})});check(r.status===200,'admin login');const setCookie=r.headers.get('set-cookie');check(setCookie.includes('HttpOnly')&&setCookie.includes('SameSite=Strict'),'cookie protections');cookie=setCookie.split(';')[0];
 r=await request('/api/admin/reviews');list=await r.json();check(list[0].status==='published','migration default preserved');
 const review={...list[0],body:'Исправленный текст проверенного отзыва',status:'hidden'};
 r=await request('/api/admin/reviews',{method:'PATCH',body:JSON.stringify(review),requestOrigin:'https://evil.example'});check(r.status===403,'cross-origin edit rejected');
 r=await request('/api/admin/reviews',{method:'PATCH',body:JSON.stringify(review)});check(r.ok,'review hidden');r=await request('/api/reviews');check((await r.json()).length===0,'hidden review not public');
 r=await request('/api/admin/reviews',{method:'PATCH',body:JSON.stringify({...review,status:'published'})});check(r.ok,'review republished');r=await request('/api/reviews');check((await r.json())[0].body===review.body,'corrected text public');
 r=await request('/api/admin/content');const content=await r.json();content.plans[0].price='700';content.heroLead='Новый текст главного экрана';
 r=await request('/api/admin/content',{method:'PUT',body:JSON.stringify(content)});check(r.ok,'content save');r=await request('/api/site-content');const updated=await r.json();check(updated.plans[0].price==='700'&&updated.heroLead===content.heroLead,'public content updated');
 r=await request('/api/admin/content',{method:'PUT',body:JSON.stringify({...content,songs:[{...content.songs[0],src:'https://evil.example/file.mp3'}]})});check(r.status===400,'external media URL rejected');
 r=await request('/api/admin/media',{method:'POST',body:Buffer.from('not-mp3'),headers:{'Content-Type':'audio/mpeg'}});check(r.status===400,'invalid upload rejected');
 r=await request('/api/admin/media',{method:'POST',body:readFileSync(root+'/public/audio/navstrechu.mp3'),headers:{'Content-Type':'audio/mpeg'}});check(r.status===201,'MP3 upload');const uploaded=await r.json();
 r=await request(uploaded.src,{headers:{Range:'bytes=0-99'},auth:false});check(r.status===206&&(await r.arrayBuffer()).byteLength===100,'audio range playback');
 r=await request('/api/admin/reviews?id=existing',{method:'DELETE'});check(r.ok,'review delete');
 // New visitor reviews wait for moderation.
 const email='test-'+randomBytes(6).toString('hex')+'@example.com';
 r=await request('/api/auth/sign-up/email',{method:'POST',body:JSON.stringify({email,password,name:'Тестовый слушатель'}),auth:false});check(r.ok,'visitor signup still works');const visitorCookie=r.headers.get('set-cookie').split(';')[0];
 r=await request('/api/reviews',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify({name:'Тестовый слушатель',body:'Спасибо за замечательную песню!',rating:5})});check(r.status===201,'visitor review submitted');r=await request('/api/reviews',{auth:false});check((await r.json()).length===0,'new review awaits moderation');
 r=await request('/api/admin/reviews');check((await r.json())[0].status==='pending','pending visible to admin');
 r=await request('/api/admin/session',{method:'DELETE'});check(r.ok,'logout');r=await request('/api/admin/reviews');check(r.status===401,'session revoked');cookie='';
 for(let i=0;i<5;i++)await request('/api/admin/session',{method:'POST',body:JSON.stringify({password:'wrong'})});r=await request('/api/admin/session',{method:'POST',body:JSON.stringify({password})});check(r.status===429,'password brute force throttled');
 console.log('PASS: '+checks+' integration checks; repeatable migration preserves existing review.');
}catch(e){console.error(logs.slice(-2000));throw e;}finally{server.kill('SIGTERM');await new Promise(r=>server.on('exit',r));rmSync(dir,{recursive:true,force:true});}
