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

 // Direct applications: authenticated, private, server-priced and retry-safe.
 const orderBrief={requestId:crypto.randomUUID(),planIndex:0,recipient:'Для любимого человека',occasion:'Годовщина',genre:'Поп',mood:'Нежное',story:'История нашей встречи и счастливые моменты.',contact:'@customer_contact',price_kopecks:1,paid_at:Date.now(),due_date:'2026-10-12',customer_message:'Поддельное сообщение'};
 r=await request('/api/orders',{method:'POST',auth:false,body:JSON.stringify(orderBrief)});check(r.status===401,'anonymous application rejected');
 r=await request('/api/orders',{method:'POST',auth:false,requestOrigin:'https://evil.example',headers:{Cookie:visitorCookie},body:JSON.stringify(orderBrief)});check(r.status===403,'cross-origin application rejected');
 r=await request('/api/orders',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify(orderBrief)});check(r.status===201,'direct application submitted');const orderId=(await r.json()).id;
 r=await request('/api/orders',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify(orderBrief)});check(r.status===200&&(await r.json()).id===orderId,'retry returns same application');
 r=await request('/api/orders',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify({...orderBrief,story:'Другие пожелания и новая история'})});check(r.status===409,'changed retry payload rejected');
 r=await request('/api/orders',{auth:false,headers:{Cookie:visitorCookie}});let customerOrders=await r.json();check(customerOrders.orders.length===1&&customerOrders.orders[0].price_kopecks===70000,'server price and deduplication');check(customerOrders.orders[0].paid_at===null&&!('full_file' in customerOrders.orders[0])&&!('user_id' in customerOrders.orders[0]),'payment spoof ignored and private fields omitted');check(customerOrders.orders[0].due_date===null&&customerOrders.orders[0].customer_message==='','customer cannot spoof studio deadline or message in application');
 r=await request('/api/admin/orders',{auth:false,headers:{Cookie:visitorCookie}});check(r.status===401,'ordinary account cannot read admin orders');
 r=await request('/api/admin/orders');const adminOrders=await r.json();check(adminOrders.length===1&&adminOrders[0].customerEmail===email&&adminOrders[0].contact===orderBrief.contact,'application appears in admin panel');
 r=await request('/api/admin/orders',{method:'PATCH',body:JSON.stringify({id:orderId,status:'working',price_kopecks:75000})});check(r.ok,'admin can update application status');
 r=await request('/api/orders',{auth:false,headers:{Cookie:visitorCookie}});customerOrders=await r.json();check(customerOrders.orders[0].status==='working'&&customerOrders.orders[0].price_kopecks===75000,'updated status persists for owner');
 r=await request('/api/admin/orders',{method:'PATCH',body:JSON.stringify({id:orderId,status:'ready',price_kopecks:75000})});check(r.ok,'admin can mark result ready');
 r=await request('/api/orders',{auth:false,headers:{Cookie:visitorCookie}});customerOrders=await r.json();check(customerOrders.orders[0].status==='ready'&&!customerOrders.orders[0].canDownload&&!customerOrders.orders[0].hasPreview,'ready status is visible without opening media access');
 const orderUpdate={id:orderId,status:'working',price_kopecks:75000,due_date:'2026-10-14',customer_message:'Начали работу.\nВыбрали пианино и нежный вокал.'};
 r=await request('/api/admin/orders',{method:'PATCH',body:JSON.stringify(orderUpdate),auth:false,headers:{Cookie:visitorCookie}});check(r.status===401,'customer cannot change deadline or studio message');
 r=await request('/api/admin/orders',{method:'PATCH',body:JSON.stringify(orderUpdate),requestOrigin:'https://evil.example'});check(r.status===403,'cross-origin order update blocked');
 r=await request('/api/admin/orders',{method:'PATCH',body:JSON.stringify({...orderUpdate,due_date:'2026-02-30'})});check(r.status===400,'impossible deadline rejected');
 r=await request('/api/admin/orders',{method:'PATCH',body:JSON.stringify({...orderUpdate,customer_message:'x'.repeat(1501)})});check(r.status===400,'oversized customer message rejected');
 r=await request('/api/admin/orders',{method:'PATCH',body:JSON.stringify(orderUpdate)});check(r.ok,'studio deadline and message saved');
 r=await request('/api/orders',{auth:false,headers:{Cookie:visitorCookie}});customerOrders=await r.json();check(customerOrders.orders[0].due_date===orderUpdate.due_date&&customerOrders.orders[0].customer_message===orderUpdate.customer_message,'owner sees studio deadline and message');
 r=await request('/api/admin/orders',{method:'PATCH',body:JSON.stringify({id:orderId,status:'ready',price_kopecks:75000})});check(r.ok,'older status-only updates remain supported');
 r=await request('/api/orders',{auth:false,headers:{Cookie:visitorCookie}});customerOrders=await r.json();check(customerOrders.orders[0].customer_message===orderUpdate.customer_message,'status change preserves studio message');
 r=await request('/api/admin/orders',{method:'PATCH',body:JSON.stringify({...orderUpdate,due_date:null,customer_message:''})});check(r.ok,'deadline and message can be cleared');
 r=await request('/api/orders',{auth:false,headers:{Cookie:visitorCookie}});customerOrders=await r.json();check(customerOrders.orders[0].due_date===null&&customerOrders.orders[0].customer_message==='','cleared update visible to owner');
 const revision={orderId,requestId:crypto.randomUUID(),message:'Добавьте пианино и сделайте припев нежнее.'};
 r=await request('/api/orders/revisions',{method:'POST',auth:false,body:JSON.stringify(revision)});check(r.status===401,'anonymous revision rejected');
 r=await request('/api/orders/revisions',{method:'POST',auth:false,headers:{Cookie:visitorCookie},requestOrigin:'https://evil.example',body:JSON.stringify(revision)});check(r.status===403,'cross-origin revision rejected');
 r=await request('/api/orders/revisions',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify(revision)});check(r.status===409,'revision unavailable before result ready');
 r=await request('/api/admin/orders',{method:'PATCH',body:JSON.stringify({id:orderId,status:'ready',price_kopecks:75000})});check(r.ok,'result prepared for revision request');
 r=await request('/api/orders/revisions',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify({...revision,message:'коротко'})});check(r.status===400,'short revision message rejected');
 r=await request('/api/orders/revisions',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify(revision)});check(r.status===201,'owner revision submitted');
 r=await request('/api/orders/revisions',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify(revision)});check(r.status===200,'retry does not duplicate revision');
 r=await request('/api/orders/revisions',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify({...revision,requestId:crypto.randomUUID()})});check(r.status===409,'second pending revision blocked');
 r=await request('/api/orders',{auth:false,headers:{Cookie:visitorCookie}});customerOrders=await r.json();check(customerOrders.orders[0].revisions.length===1&&customerOrders.orders[0].revisions[0].message===revision.message&&customerOrders.orders[0].price_kopecks===75000,'owner sees revision and price stays unchanged');
 r=await request('/api/admin/orders');check((await r.json())[0].revisions[0].status==='pending','revision visible in admin panel');
 r=await request('/api/admin/revisions',{method:'PATCH',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify({id:revision.requestId,status:'reviewed'})});check(r.status===401,'customer cannot mark revision reviewed');
 r=await request('/api/admin/revisions',{method:'PATCH',requestOrigin:'https://evil.example',body:JSON.stringify({id:revision.requestId,status:'reviewed'})});check(r.status===403,'cross-origin revision review blocked');
 r=await request('/api/admin/revisions',{method:'PATCH',body:JSON.stringify({id:revision.requestId,status:'reviewed'})});check(r.ok,'admin can review revision');
 r=await request('/api/orders',{auth:false,headers:{Cookie:visitorCookie}});customerOrders=await r.json();check(customerOrders.orders[0].revisions[0].status==='reviewed','reviewed status visible to owner');
 const nextRevision={...revision,requestId:crypto.randomUUID(),message:'Ещё одна просьба: изменить последнюю строку.'};r=await request('/api/orders/revisions',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify(nextRevision)});check(r.status===201,'next revision accepted after review');
 r=await request('/api/admin/revisions',{method:'PATCH',body:JSON.stringify({id:revision.requestId,status:'pending'})});check(r.status===409,'cannot reopen older request while another is pending');
 const otherEmail='other-'+randomBytes(6).toString('hex')+'@example.com';r=await request('/api/auth/sign-up/email',{method:'POST',body:JSON.stringify({email:otherEmail,password,name:'Другой слушатель'}),auth:false});check(r.ok,'second visitor account');const otherCookie=r.headers.get('set-cookie').split(';')[0];
 r=await request('/api/orders',{auth:false,headers:{Cookie:otherCookie}});check((await r.json()).orders.length===0,'another visitor cannot see customer application');
 r=await request('/api/orders/revisions',{method:'POST',auth:false,headers:{Cookie:otherCookie},body:JSON.stringify({...revision,requestId:crypto.randomUUID()})});check(r.status===404,'another visitor cannot submit revision for someone else');
 r=await request('/api/orders/revisions',{method:'POST',auth:false,headers:{Cookie:otherCookie},body:JSON.stringify(revision)});check(r.status===404,'revision retry does not expose another owner request');
 r=await request('/api/orders',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify({...orderBrief,requestId:crypto.randomUUID(),planIndex:99})});check(r.status===400,'invalid service rejected');
 for(let i=0;i<4;i++){r=await request('/api/orders',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify({...orderBrief,requestId:crypto.randomUUID(),planIndex:i===0?3:1})});check(r.status===201,'additional services accepted');}
 r=await request('/api/orders',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify({...orderBrief,requestId:crypto.randomUUID()})});check(r.status===429,'application spam throttled');
 // Gift greetings expose only explicitly shared content, never order data or media.
 const giftInput={orderId,recipient:'Мама',sender:'Кирилл',title:'Эта песня для тебя',message:'Спасибо за любовь и поддержку!',theme:'rose',enabled:true};
 r=await request('/api/orders/gift?orderId='+orderId,{auth:false});check(r.status===401,'anonymous gift editor denied');
 r=await request('/api/orders/gift?orderId='+orderId,{auth:false,headers:{Cookie:otherCookie}});check(r.status===404,'gift editor is owner-only');
 r=await request('/api/orders/gift',{method:'POST',auth:false,headers:{Cookie:otherCookie},body:JSON.stringify(giftInput)});check(r.status===404,'another account cannot share gift');
 r=await request('/api/orders/gift',{method:'POST',auth:false,headers:{Cookie:visitorCookie},requestOrigin:'https://evil.example',body:JSON.stringify(giftInput)});check(r.status===403,'cross-origin gift save denied');
 r=await request('/api/orders/gift',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify({...giftInput,theme:'invalid'})});check(r.status===400,'invalid gift theme rejected');
 r=await request('/api/admin/orders',{method:'PATCH',body:JSON.stringify({id:orderId,status:'working',price_kopecks:75000})});check(r.ok,'order working for gift gate test');
 r=await request('/api/orders/gift',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify(giftInput)});check(r.status===409,'gift cannot be shared before result ready');
 r=await request('/api/orders/gift',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify({...giftInput,enabled:false})});check(r.ok,'private gift draft allowed');let gift=(await r.json()).gift;check(/^[a-f0-9]{48}$/.test(gift.token),'gift token unguessable');
 r=await request('/gift/'+gift.token,{auth:false});check(r.status===404,'disabled gift not public');
 r=await request('/api/admin/orders',{method:'PATCH',body:JSON.stringify({id:orderId,status:'ready',price_kopecks:75000})});check(r.ok,'order ready for sharing');
 r=await request('/api/orders/gift',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify(giftInput)});check(r.ok,'owner shares gift');gift=(await r.json()).gift;
 r=await request('/gift/'+gift.token,{auth:false});let giftHtml=await r.text();check(r.ok&&giftHtml.includes(giftInput.message)&&giftHtml.includes(giftInput.recipient),'shared greeting available to recipient');check(!giftHtml.includes(orderBrief.contact)&&!giftHtml.includes(orderBrief.story)&&!giftHtml.includes(email)&&!giftHtml.includes('full_file')&&!giftHtml.includes('<audio'),'gift does not expose private order details or full audio');check(giftHtml.includes('noindex')&&giftHtml.includes('no-referrer'),'gift avoids indexing and referrer disclosure');
 r=await request('/api/orders/gift',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify({...giftInput,message:'Обновлённое поздравление',theme:'sunrise'})});check(r.ok&&(await r.json()).gift.token===gift.token,'gift edit preserves share link');
 r=await request('/api/orders/gift',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify({...giftInput,enabled:false})});check(r.ok,'owner revokes link');r=await request('/gift/'+gift.token,{auth:false});check(r.status===404,'revoked gift stops being accessible');
 // Review from a completed order follows existing moderation and account limits.
 const completedReview={orderId,name:'Слушатель',rating:5,body:'Спасибо за чудесную песню и внимательную работу.'};
 r=await request('/api/reviews',{method:'POST',auth:false,headers:{Cookie:otherCookie},body:JSON.stringify(completedReview)});check(r.status===404,'review cannot be linked to someone else order');
 r=await request('/api/admin/orders',{method:'PATCH',body:JSON.stringify({id:orderId,status:'working',price_kopecks:75000})});check(r.ok,'order working for review gate');
 r=await request('/api/reviews',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify(completedReview)});check(r.status===409,'review from order requires ready result');
 r=await request('/api/admin/orders',{method:'PATCH',body:JSON.stringify({id:orderId,status:'ready',price_kopecks:75000})});check(r.ok,'order ready for review');
 r=await request('/api/admin/reviews');const oldVisitorReview=(await r.json()).find(x=>x.name==='Тестовый слушатель');r=await request('/api/admin/reviews?id='+oldVisitorReview.id,{method:'DELETE'});check(r.ok,'test visitor review removed before completed-order review');
 r=await request('/api/reviews',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify(completedReview)});check(r.status===201,'completed-order review submitted');r=await request('/api/reviews',{auth:false});check((await r.json()).length===0,'completed-order review awaits moderation');
 r=await request('/api/reviews',{method:'POST',auth:false,headers:{Cookie:visitorCookie},body:JSON.stringify(completedReview)});check(r.status===409,'one review per account preserved');
 const verifyDb=new Database(dbPath);check(verifyDb.prepare('SELECT order_id FROM reviews WHERE user_id=?').get('site:'+verifyDb.prepare('SELECT id FROM auth_user WHERE email=?').get(email).id).order_id===orderId,'review linked to completed application');verifyDb.close();
 // Dashboard notifications are admin-only and based on server snapshots.
 r=await request('/api/admin/notifications',{auth:false,headers:{Cookie:visitorCookie}});check(r.status===401,'customer cannot read notifications');
 r=await request('/api/admin/notifications?since=invalid');check(r.status===400,'invalid notification watermark rejected');
 r=await request('/api/admin/notifications?since=0');const events=await r.json();check(r.ok&&events.orders===5&&events.revisions===2&&events.reviews===1&&events.pendingRevisions===1,'notification counters reflect created events');
 r=await request('/api/admin/notifications?since='+events.now);const fresh=await r.json();check(fresh.orders===0&&fresh.revisions===0&&fresh.reviews===0,'viewed events not counted twice');check(fresh.pendingOrders===4&&fresh.pendingRevisions===1&&fresh.pendingReviews===1,'marking viewed does not hide pending work');
 r=await request('/api/admin/session',{method:'DELETE'});check(r.ok,'logout');r=await request('/api/admin/reviews');check(r.status===401,'session revoked');cookie='';
 for(let i=0;i<5;i++)await request('/api/admin/session',{method:'POST',body:JSON.stringify({password:'wrong'})});r=await request('/api/admin/session',{method:'POST',body:JSON.stringify({password})});check(r.status===429,'password brute force throttled');
 console.log('PASS: '+checks+' integration checks; repeatable migration preserves existing review.');
}catch(e){console.error(logs.slice(-2000));throw e;}finally{server.kill('SIGTERM');await new Promise(r=>server.on('exit',r));rmSync(dir,{recursive:true,force:true});}
