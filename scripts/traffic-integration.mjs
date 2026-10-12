import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {randomBytes,scryptSync} from 'node:crypto';
import assert from 'node:assert/strict';
import {stopTestServer} from './test-mail-server.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,''),require=createRequire(root+'/package.json'),Database=require('better-sqlite3');
const dir=mkdtempSync(join(tmpdir(),'ssound-traffic-')),dbPath=join(dir,'site.sqlite'),origin='http://127.0.0.1:3193',password=randomBytes(16).toString('hex'),salt=randomBytes(16).toString('hex');
const env={...process.env,DATABASE_PATH:dbPath,BETTER_AUTH_URL:origin,BETTER_AUTH_SECRET:randomBytes(48).toString('hex'),SSOUNDCHECK_ADMIN_PASSWORD_HASH:'scrypt$'+salt+'$'+scryptSync(password,salt,64).toString('hex'),PORT:'3193',HOSTNAME:'127.0.0.1'};
// Do not inherit production delivery configuration into tests.
for(const key of Object.keys(env))if(key.startsWith('AUTH_SMTP')||key.startsWith('AUTH_EMAIL')||key.startsWith('AUTH_RESEND'))delete env[key];
execFileSync(process.execPath,['scripts/beget/migrate.mjs'],{cwd:root,env,stdio:'ignore'});execFileSync(process.execPath,['scripts/beget/migrate.mjs'],{cwd:root,env,stdio:'ignore'});
const db=new Database(dbPath),server=spawn(process.execPath,['.next/standalone/server.js'],{cwd:root,env,stdio:['ignore','pipe','pipe']});let logs='',checks=0;
server.stderr.on('data',b=>logs+=b);server.stdout.on('data',()=>{});
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const check=(v,m)=>{assert.ok(v,m);checks++};
const cookies=r=>r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
const count=()=>db.prepare('SELECT COUNT(*) n FROM site_visits').get().n;
let cookie='';
async function page(path='/',headers={}){const r=await fetch(origin+path,{headers:{Accept:'text/html','User-Agent':ua,...(cookie?{Cookie:cookie}:{}),...headers}});await r.text();return r}
async function signal(state,headers={}){return fetch(origin+'/api/traffic',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,...headers},body:JSON.stringify({state})})}
try{
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/account-config')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));if(i===99)throw Error('server not ready')}
 check((await fetch(origin+'/api/admin/traffic')).status===401,'anonymous report denied');
 let r=await page('/?utm_source=telegram&utm_campaign=private-person');cookie=cookies(r);check(r.ok&&count()===1,'real standalone proxy records document');
 check(r.headers.getSetCookie().every(s=>s.includes('HttpOnly')&&/SameSite=lax/i.test(s)),'signed analytics cookies are HttpOnly and SameSite');
 check(r.headers.get('cache-control').includes('no-store'),'personalized cookie response is not shared-cacheable');
 let row=db.prepare('SELECT * FROM site_visits').get();check(row.device==='mobile'&&row.source==='telegram'&&row.state===0,'coarse source device and uncertain initial state');
 check(!JSON.stringify(row).includes('private-person')&&!JSON.stringify(row).includes(ua),'query and UA not retained');
 await page();check(count()===1&&db.prepare('SELECT views FROM site_visits').get().views===2,'reload grouped into signed visit');
 await page('/',{'next-router-prefetch':'1'});await page('/',{RSC:'1'});check(db.prepare('SELECT views FROM site_visits').get().views===2,'prefetch and RSC ignored');
 await fetch(origin,{method:'HEAD',headers:{Accept:'text/html',Cookie:cookie}});check(db.prepare('SELECT views FROM site_visits').get().views===2,'HEAD ignored');
 await page('/account');await page('/admin');check(count()===1,'account admin pages excluded');
 check((await signal('active',{Origin:'https://evil.invalid'})).status===403,'cross-origin signals denied');
 check((await signal('bad')).status===400,'invalid state denied');
 db.prepare('UPDATE site_visits SET started_at=?').run(Date.now());
 check((await signal('active')).status===204&&db.prepare('SELECT state FROM site_visits').get().state===0,'too early active signal not classified human');
 check((await signal('browser')).status===204&&db.prepare('SELECT state FROM site_visits').get().state===1,'browser visibility signal separate from human');
 db.prepare('UPDATE site_visits SET started_at=started_at-5000').run();
 await signal('active');check(db.prepare('SELECT state FROM site_visits').get().state===2,'later input signal marks probably human');
 await signal('browser');check(db.prepare('SELECT state FROM site_visits').get().state===2,'visibility does not downgrade active state');
 await signal('automated');await signal('active');check(db.prepare('SELECT state FROM site_visits').get().state===3,'automation cannot promote itself back to human');
 const saved=cookie;cookie='';await signal('active');check(count()===1,'signals cannot create visits');cookie=saved.replace(/ssoundcheck_visit=./,'ssoundcheck_visit=x');await signal('active');check(count()===1,'forged session token ignored');cookie=saved;
 await page('/',{'User-Agent':'Googlebot/2.1'});await page('/',{'User-Agent':'TelegramBot',Accept:'*/*'});check(count()===1&&db.prepare('SELECT SUM(requests) n FROM site_bot_days').get().n===2,'known robots count as requests not visitors');
 cookie='';await page('/',{'User-Agent':'Mozilla/5.0 Desktop','Referer':'https://www.google.com/search?q=private-person'}).then(r=>cookie=cookies(r));check(count()===2&&db.prepare('SELECT source FROM site_visits ORDER BY started_at DESC').get().source==='google','search referrer reduced to category');
 check(!db.prepare('PRAGMA table_info(site_visits)').all().some(c=>/ip|email|agent|referrer|story/.test(c.name)),'no identity or raw request columns');
 db.prepare('UPDATE site_visits SET last_seen=? WHERE state=0').run(Date.now()-1801_000);await page();check(count()===3,'30 minute idle opens a new visit');
 check(db.prepare('SELECT COUNT(DISTINCT visitor) n FROM site_visits').get().n===2,'browser grouped across separate visits');
 r=await fetch(origin+'/api/admin/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({password})});const admin=cookies(r);check(r.ok,'staff login');
 r=await fetch(origin+'/api/admin/traffic?days=7',{headers:{Cookie:admin}});const report=await r.json();check(r.ok&&r.headers.get('cache-control').includes('no-store'),'private admin report');
 check(report.summary.automated===1&&report.summary.unknown===2&&report.summary.robotRequests===2,'report separates uncertain automation and bot units');
 check(report.recent.length===3&&report.sources.every(s=>s.source!=='private-person'),'recent and source summary');
 check((await fetch(origin+'/api/admin/traffic?days=2',{headers:{Cookie:admin}})).status===400,'invalid report window rejected');
 await page('/',{Cookie:admin});check(count()===3,'authenticated staff visit excluded');
 cookie=admin+'; '+saved;await signal('browser');check(db.prepare('SELECT state FROM site_visits WHERE state=3').get().state===3,'staff signals excluded');
 check((await fetch(origin+'/api/admin/traffic?days=1',{headers:{Cookie:admin}})).ok,'today report supported');
 check(readFileSync(root+'/components/site-traffic.tsx','utf8').includes('e.isTrusted'),'collector ignores synthetic input');
 console.log('PASS: '+checks+' traffic integration checks');
}catch(e){console.error(logs.slice(-2500));throw e}finally{await stopTestServer(server);db.close();rmSync(dir,{recursive:true,force:true})}
