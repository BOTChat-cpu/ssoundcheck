import {verifyBot,saveBotToken} from './beget/setup-telegram.mjs';
import {mkdtempSync,writeFileSync,readFileSync,statSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const token='123456789:'+'x'.repeat(35),name='SSoundChekK_bot';
let calls=0;const ok=async(url,opts)=>{calls++;assert.ok(url.endsWith('/getMe'));assert.equal(opts.method,'POST');return {ok:true,json:async()=>({ok:true,result:{is_bot:true,username:name}})}};
assert.equal(await verifyBot(token,name,ok),name);
await assert.rejects(verifyBot('bad',name,ok));assert.equal(calls,1);
await assert.rejects(verifyBot(token,'Different_bot',ok),/другому/);
await assert.rejects(verifyBot(token,name,async()=>({ok:false})),/не принял/);
await assert.rejects(verifyBot(token,name,async()=>{throw Error(token)}),e=>!e.message.includes(token));
await assert.rejects(verifyBot(token,name,async()=>({ok:true,json:async()=>{throw Error(token)}})),e=>!e.message.includes(token));
const dir=mkdtempSync(join(tmpdir(),'ssound-telegram-setup-'));
try{
 const path=join(dir,'site.env');writeFileSync(path,'EXISTING_SETTING=value\nTELEGRAM_BOT_TOKEN=old\nexport TELEGRAM_BOT_USERNAME=old_bot\n',{mode:0o600});
 saveBotToken(path,token,name);const text=readFileSync(path,'utf8');assert.ok(text.includes('EXISTING_SETTING=value'));assert.ok(text.includes('TELEGRAM_BOT_TOKEN='+token));assert.equal(text.match(/TELEGRAM_BOT_TOKEN=/g).length,1);assert.ok(text.includes('TELEGRAM_BOT_USERNAME='+name));assert.equal(statSync(path).mode&0o777,0o600);
 saveBotToken(path,token,name);assert.equal(readFileSync(path,'utf8'),text);
 const link=join(dir,'setup-link.mjs');symlinkSync(fileURLToPath(new URL('./beget/setup-telegram.mjs',import.meta.url)),link);
 const cli=spawnSync(process.execPath,[link,name],{input:'invalid-test-value',encoding:'utf8'});assert.equal(cli.status,1);assert.ok(cli.stderr.length>0);assert.ok(!cli.stderr.includes('invalid-test-value'));
 console.log('PASS: Telegram verification, secret error redaction, settings preservation, private permissions and repeatable save and CLI execution through release symlinks');
}finally{rmSync(dir,{recursive:true,force:true})}
