import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {randomBytes,scryptSync} from 'node:crypto';
import assert from 'node:assert/strict';
import {stopTestServer} from './test-mail-server.mjs';
import {activate} from '../lib/telegram-channel-core.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,''),require=createRequire(import.meta.url),Database=require('better-sqlite3');
const dir=mkdtempSync(join(tmpdir(),'ssound-channel-')),origin='http://127.0.0.1:3194',password=randomBytes(16).toString('hex'),salt=randomBytes(16).toString('hex');
const env={...process.env,DATABASE_PATH:join(dir,'site.sqlite'),BETTER_AUTH_URL:origin,BETTER_AUTH_SECRET:randomBytes(48).toString('hex'),SSOUNDCHECK_ADMIN_PASSWORD_HASH:'scrypt$'+salt+'$'+scryptSync(password,salt,64).toString('hex'),PORT:'3194',HOSTNAME:'127.0.0.1'};
for(const k of Object.keys(env))if(k.startsWith('TELEGRAM_')||k.startsWith('AUTH_SMTP')||k.startsWith('AUTH_EMAIL')||k.startsWith('AUTH_RESEND'))delete env[k];
execFileSync(process.execPath,['scripts/beget/migrate.mjs'],{cwd:root,env,stdio:'ignore'});execFileSync(process.execPath,['scripts/beget/migrate.mjs'],{cwd:root,env,stdio:'ignore'});
const db=new Database(env.DATABASE_PATH),server=spawn(process.execPath,['.next/standalone/server.js'],{cwd:root,env,stdio:['ignore','pipe','pipe']});let logs='',cookie='',checks=0;server.stderr.on('data',b=>logs+=b);server.stdout.on('data',()=>{});
const check=(v,m)=>{assert.ok(v,m);checks++};
async function post(body,headers={}){return fetch(origin+'/api/admin/channel',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json',...headers},body:JSON.stringify(body)})}
try{
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/account-config')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));if(i===99)throw Error('server not ready')}
 check((await fetch(origin+'/api/admin/channel')).status===401,'anonymous channel report denied');
 check((await post({action:'pause'})).status===401,'anonymous mutation denied');
 let r=await fetch(origin+'/api/admin/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({password})});cookie=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');check(r.ok,'admin login');
 r=await fetch(origin+'/api/admin/channel',{headers:{Cookie:cookie}});let data=await r.json();check(r.ok&&r.headers.get('cache-control').includes('no-store')&&!data.configured&&data.channel===null,'safe unconfigured state');
 check((await post({action:'connect'})).status===503,'missing token fails without publishing');
 check(db.prepare('SELECT COUNT(*) n FROM telegram_channel_posts').get().n===0,'failed connection creates no posts');
 activate(db,{id:'-100123456',username:'SSoundChekKK',title:'SSoundCheck'},Date.now());
 r=await fetch(origin+'/api/admin/channel',{headers:{Cookie:cookie}});data=await r.json();check(data.posts.length===9&&!JSON.stringify(data).includes('TELEGRAM_BOT_TOKEN'),'queued captions visible without credentials');
 check((await post({action:'pause'},{Origin:'https://evil.invalid'})).status===403,'CSRF pause denied');
 check((await post({action:'pause'})).ok&&db.prepare('SELECT enabled FROM telegram_channel_settings').get().enabled===0,'pause saves');
 check((await post({action:'resume'})).ok&&db.prepare('SELECT enabled FROM telegram_channel_settings').get().enabled===1,'resume saves without test bot sends');
 check((await post({action:'invalid'})).status===400,'unknown operation denied');
 const custom={action:'add',topic:'Тестовый пост',body:'Локальная проверка — не публиковать.',at:Date.now()+3600_000,image:'story'};
 check((await post({...custom,image:'../../secret'})).status===400,'image path injection rejected');
 check((await post({...custom,body:'x'.repeat(951)})).status===400,'long caption rejected');
 check((await post({...custom,at:Date.now()-1000})).status===400,'past custom schedule rejected');
 check((await post(custom)).ok,'custom post queued');
 let row=db.prepare("SELECT * FROM telegram_channel_posts WHERE dedupe_key LIKE 'custom:%'").get();check(row.body===custom.body&&row.state==='queued','custom content preserved');
 check((await post({action:'cancel',id:row.id})).ok,'queued post cancelled');
 check((await post({action:'retry',id:row.id})).status===409,'cancelled post cannot be retried');
 db.prepare("UPDATE telegram_channel_posts SET state='uncertain' WHERE id=?").run(row.id);check((await post({action:'published',id:row.id})).ok&&db.prepare('SELECT state FROM telegram_channel_posts WHERE id=?').get(row.id).state==='sent','uncertain post can be marked seen in channel');
 check((await post({action:'cancel',id:row.id})).status===409,'sent post cannot be cancelled');
 db.prepare("UPDATE telegram_channel_posts SET state='failed',attempts=5 WHERE id=?").run(row.id);check((await post({action:'retry',id:row.id})).ok&&db.prepare('SELECT attempts FROM telegram_channel_posts WHERE id=?').get(row.id).attempts===0,'explicit retry resets failed attempts');
 check((await post({action:'cancel',id:crypto.randomUUID()})).status===404,'foreign post denied');
 r=await fetch(origin+'/api/auth/sign-up/email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'channel-check@example.invalid',name:'Customer',password:'StrongLocalPass-123'})});const customer=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 check((await fetch(origin+'/api/admin/channel',{headers:{Cookie:customer}})).status===401,'ordinary customer report denied');
 check((await post({action:'pause'},{Cookie:customer})).status===401,'ordinary customer mutation denied');
 console.log('PASS: '+checks+' channel API checks; no Telegram credentials or real sends');
}catch(e){console.error(logs.slice(-2000));throw e}finally{await stopTestServer(server);db.close();rmSync(dir,{recursive:true,force:true})}
