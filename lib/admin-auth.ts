import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { getSqlite } from '../db';
const COOKIE = 'ssoundcheck_admin';
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export function adminConfigured() { return /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(process.env.SSOUNDCHECK_ADMIN_PASSWORD_HASH || ''); }
function passwordVersion() { return digest(process.env.SSOUNDCHECK_ADMIN_PASSWORD_HASH || ''); }
export function sameOrigin(req: Request) {
  try { return req.headers.get('origin') === new URL(process.env.BETTER_AUTH_URL || req.url).origin; } catch { return false; }
}
function tokenFrom(req: Request) { return req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1) || ''; }
export function isAdmin(req: Request) {
  if (!adminConfigured()) return false;
  const token = tokenFrom(req);
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const row = getSqlite().prepare('SELECT expires_at, password_version FROM admin_sessions WHERE token_hash = ?').get(digest(token)) as {expires_at: number; password_version: string} | undefined;
  return !!row && row.expires_at > Date.now() && row.password_version === passwordVersion();
}
export function adminGuard(req: Request) {
  if (req.method !== 'GET' && !sameOrigin(req)) return Response.json({error:'Недопустимый запрос.'},{status:403});
  if (!isAdmin(req)) return Response.json({error:'Войдите в панель администратора.'},{status:401});
  return null;
}
export function adminCookie(token: string, age=43200) {
  const secure = process.env.BETTER_AUTH_URL?.startsWith('https://') ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure}`;
}
export async function adminLogin(password: unknown) {
  if (!adminConfigured()) return {status:503,error:'Панель готова. Сначала задайте пароль администратора на сервере.'};
  if (typeof password !== 'string' || password.length < 1 || password.length > 128) return {status:400,error:'Введите пароль.'};
  const db=getSqlite(), now=Date.now();
  const allowed=db.transaction(()=>{
    const row=db.prepare('SELECT failures, window_start FROM admin_login_state WHERE id=1').get() as {failures:number;window_start:number}|undefined;
    if (!row || now-row.window_start >= 15*60*1000) {db.prepare('INSERT INTO admin_login_state VALUES (1,1,?) ON CONFLICT(id) DO UPDATE SET failures=1,window_start=excluded.window_start').run(now);return true;}
    if(row.failures >= 5)return false;
    db.prepare('UPDATE admin_login_state SET failures=failures+1 WHERE id=1').run();return true;
  })();
  if(!allowed)return {status:429,error:'Слишком много попыток. Повторите через 15 минут.'};
  const [,salt,hash]=process.env.SSOUNDCHECK_ADMIN_PASSWORD_HASH!.split('$');
  const actual=await new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,(err,key)=>err?reject(err):resolve(key)));
  if(!timingSafeEqual(actual,Buffer.from(hash,'hex')))return {status:401,error:'Неверный пароль.'};
  db.prepare('DELETE FROM admin_login_state').run();
  db.prepare('DELETE FROM admin_sessions WHERE expires_at < ? OR password_version != ?').run(now,passwordVersion());
  const token=randomBytes(32).toString('hex');
  db.prepare('INSERT INTO admin_sessions VALUES (?,?,?)').run(digest(token),now+43200*1000,passwordVersion());
  return {status:200,token};
}
export function adminLogout(req:Request) {const token=tokenFrom(req);if(token)getSqlite().prepare('DELETE FROM admin_sessions WHERE token_hash=?').run(digest(token));}
