// Local-only TLS SMTP fixture; never contacts real recipients.
import {createServer} from 'node:tls';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
export async function testMailServer(dir,port){
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout',join(dir,'key.pem'),'-out',join(dir,'cert.pem'),'-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore'});
 const letters=[],recipients=[],sockets=new Set();let rejected=0;
 const smtp=createServer({key:readFileSync(join(dir,'key.pem')),cert:readFileSync(join(dir,'cert.pem'))},socket=>{
  sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.setEncoding('utf8');socket.write('220 localhost test SMTP\r\n');let buffer='',data=false,message='',recipient='';
  socket.on('data',chunk=>{buffer+=chunk;let pos;while((pos=buffer.indexOf('\r\n'))!==-1){const line=buffer.slice(0,pos);buffer=buffer.slice(pos+2);if(data){if(line==='.'){letters.push(message);recipients.push(recipient);message='';data=false;socket.write('250 queued\r\n')}else message+=line+'\r\n';continue}if(/^EHLO|^HELO/.test(line))socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');else if(/^AUTH/.test(line))socket.write('235 authenticated\r\n');else if(/^RCPT TO:/i.test(line)){recipient=line.match(/<([^>]+)>/)?.[1]||'';socket.write('250 OK\r\n')}else if(line==='DATA'){if(rejected>0){rejected--;socket.write('451 temporary failure\r\n')}else{data=true;socket.write('354 send data\r\n')}}else if(line==='QUIT')socket.end('221 bye\r\n');else socket.write('250 OK\r\n')}});socket.on('error',()=>{});
 });
 await new Promise((resolve,reject)=>{smtp.once('error',reject);smtp.listen(port,'127.0.0.1',resolve)});
 return {letters,recipients,rejectNext:()=>{rejected++},cert:join(dir,'cert.pem'),close:async()=>{for(const socket of sockets)socket.destroy();await new Promise(r=>smtp.close(r))}};
}
export function mailParts(raw){
 const boundary=raw.match(/boundary="([^"]+)"/i)?.[1];
 return (boundary?raw.split('--'+boundary).slice(1,-1):[raw]).map(part=>{
  const split=part.indexOf('\r\n\r\n'),headers=part.slice(0,split),body=part.slice(split+4);
  const type=headers.match(/Content-Type:\s*([^;\r\n]+)/i)?.[1]||'text/plain';
  const text=/Content-Transfer-Encoding: base64/i.test(headers)?Buffer.from(body,'base64').toString('utf8'):body.replace(/=\r\n/g,'').replace(/=([a-f0-9]{2})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16)));
  return {type,text};
 });
}
export async function stopTestServer(server){if(server.exitCode!==null)return;const exit=new Promise(r=>server.once('exit',r));server.kill('SIGTERM');const timeout=setTimeout(()=>server.kill('SIGKILL'),3000);await exit;clearTimeout(timeout);}
