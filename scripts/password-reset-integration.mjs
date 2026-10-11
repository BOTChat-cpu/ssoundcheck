// Isolated production API test; local TLS SMTP, disposable accounts and database.
import {createServer} from 'node:tls';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import Database from 'better-sqlite3';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'ssound-reset-')),origin='http://127.0.0.1:3190';
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout',join(dir,'key.pem'),'-out',join(dir,'cert.pem'),'-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore'});
const letters=[],sockets=new Set();
const smtp=createServer({key:readFileSync(join(dir,'key.pem')),cert:readFileSync(join(dir,'cert.pem'))},socket=>{
 sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.setEncoding('utf8');socket.write('220 localhost test SMTP\r\n');let buffer='',data=false,message='';
 socket.on('data',chunk=>{buffer+=chunk;let pos;while((pos=buffer.indexOf('\r\n'))!==-1){const line=buffer.slice(0,pos);buffer=buffer.slice(pos+2);if(data){if(line==='.'){letters.push(message);message='';data=false;socket.write('250 queued\r\n')}else message+=line+'\r\n';continue}if(/^EHLO|^HELO/.test(line))socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');else if(/^AUTH/.test(line))socket.write('235 authenticated\r\n');else if(line==='DATA'){data=true;socket.write('354 send data\r\n')}else if(line==='QUIT'){socket.end('221 bye\r\n')}else socket.write('250 OK\r\n')}});
 socket.on('error',()=>{});
});
await new Promise((resolve,reject)=>{smtp.once('error',reject);smtp.listen(1465,'127.0.0.1',resolve)});
const env={...process.env,DATABASE_PATH:join(dir,'site.sqlite'),BETTER_AUTH_URL:origin,BETTER_AUTH_SECRET:randomBytes(48).toString('hex'),AUTH_SMTP_HOST:'127.0.0.1',AUTH_SMTP_PORT:'1465',AUTH_SMTP_SECURE:'true',AUTH_SMTP_USER:'studio@example.com',AUTH_SMTP_PASSWORD_BASE64:Buffer.from(randomBytes(16).toString('hex')).toString('base64'),AUTH_FROM_EMAIL:'studio@example.com',NODE_EXTRA_CA_CERTS:join(dir,'cert.pem')};
execFileSync(process.execPath,['scripts/beget/migrate.mjs'],{env,stdio:'ignore'});
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3190'],{env,stdio:['ignore','ignore','pipe']});let logs='';server.stderr.on('data',b=>logs+=b);
const db=new Database(env.DATABASE_PATH);let checks=0;
function check(value,label){assert.ok(value,label);checks++}
function post(path,body,headers={}){return fetch(origin+'/api/auth'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','x-real-ip':'192.0.2.1',...headers},body:JSON.stringify(body)})}
async function letter(count){for(let i=0;i<100&&letters.length<count;i++)await new Promise(r=>setTimeout(r,50));check(letters.length===count,'mail delivered through local TLS SMTP');const raw=letters[count-1];return /Content-Transfer-Encoding: base64/i.test(raw)?Buffer.from(raw.split('\r\n\r\n').slice(1).join('\r\n\r\n'),'base64').toString('utf8'):raw.replace(/=\r\n/g,'').replace(/=3D/g,'=')}
function link(mail){const match=mail.match(/http:\/\/127\.0\.0\.1:3190\/api\/auth\/reset-password\/[^\s]+/);check(!!match,'reset link in email');return match[0]}
try{
 for(let i=0;i<80;i++){try{if((await fetch(origin+'/api/account-config')).ok)break}catch{}await new Promise(r=>setTimeout(r,150))}
 let r=await fetch(origin+'/api/account-config');check((await r.json()).passwordReset,'configured SMTP enables recovery');
 r=await fetch(origin+'/forgot-password');check(r.ok&&(await r.text()).includes('noindex'),'recovery page available and noindex');
 const email='listener@example.com',oldPassword=randomBytes(16).toString('hex'),newPassword=randomBytes(16).toString('hex');
 r=await post('/sign-up/email',{email,password:oldPassword,name:'Слушатель'});check(r.ok,'signup');const cookie=r.headers.get('set-cookie').split(';')[0];
 r=await post('/request-password-reset',{email,redirectTo:origin+'/reset-password'},{Origin:'https://evil.example','x-real-ip':'192.0.2.10'});check(!r.ok,'cross-origin request blocked');
 r=await post('/request-password-reset',{email,redirectTo:'https://evil.example/reset'},{'x-real-ip':'192.0.2.11'});check(!r.ok,'external redirect blocked');
 r=await post('/request-password-reset',{email,redirectTo:origin+'/reset-password'});check(r.ok,'known email reset accepted');const known=await r.json(),firstLink=link(await letter(1));
 const token=firstLink.split('/reset-password/')[1].split('?')[0],row=db.prepare('SELECT * FROM auth_verification WHERE identifier=?').get('reset-password:'+token);check(row.expires_at-Date.now()>1700000&&row.expires_at-Date.now()<=1800000,'reset expires in 30 minutes');
 db.prepare('UPDATE auth_verification SET expires_at=? WHERE identifier=?').run(Date.now()-1000,'reset-password:'+token);
 r=await post('/reset-password',{token,newPassword});check(!r.ok,'expired token rejected');
 r=await post('/request-password-reset',{email,redirectTo:origin+'/reset-password'});check(r.ok,'replacement link accepted');const secondLink=link(await letter(2));
 r=await fetch(secondLink,{redirect:'manual'});check(r.status===302,'email link redirects to reset page');const callback=new URL(r.headers.get('location'));check(callback.pathname==='/reset-password'&&!!callback.searchParams.get('token'),'redirect includes token');const validToken=callback.searchParams.get('token');
 r=await post('/reset-password',{token:validToken,newPassword:'short'});check(!r.ok,'short password rejected');
 r=await post('/reset-password',{token:validToken,newPassword});check(r.ok,'password reset succeeds');
 r=await post('/reset-password',{token:validToken,newPassword:oldPassword});check(!r.ok,'token cannot be reused');
 r=await fetch(origin+'/api/orders',{headers:{Cookie:cookie}});check(r.status===401,'old authenticated session revoked');
 r=await post('/sign-in/email',{email,password:oldPassword});check(!r.ok,'old password rejected');
 r=await post('/sign-in/email',{email,password:newPassword});check(r.ok,'new password works');
 r=await post('/request-password-reset',{email:'missing@example.com',redirectTo:origin+'/reset-password'});check(r.ok&&JSON.stringify(await r.json())===JSON.stringify(known),'unknown email response does not disclose existence');
 await new Promise(r=>setTimeout(r,100));check(letters.length===2,'no email for nonexistent account');
 r=await post('/request-password-reset',{email,redirectTo:origin+'/reset-password'});check(r.status===429,'recovery request throttled');
 console.log('PASS: '+checks+' password recovery integration checks (local TLS SMTP).');
}catch(error){console.error(logs.slice(-1000));throw error}finally{db.close();server.kill('SIGTERM');for(const socket of sockets)socket.destroy();await new Promise(r=>smtp.close(r));await new Promise(r=>{if(server.exitCode!==null)r();else server.once('exit',r)});rmSync(dir,{recursive:true,force:true})}
