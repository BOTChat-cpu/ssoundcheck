import Database from 'better-sqlite3';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const path = process.env.DATABASE_PATH || './data/site.sqlite';
mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
const db = new Database(path);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.exec('CREATE TABLE IF NOT EXISTS ssoundcheck_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
for (const name of readdirSync(resolve('drizzle')).filter(x => x.endsWith('.sql')).sort()) {
  if (db.prepare('SELECT name FROM ssoundcheck_migrations WHERE name = ?').get(name)) continue;
  db.transaction(() => {
    db.exec(readFileSync(resolve('drizzle', name), 'utf8'));
    db.prepare('INSERT INTO ssoundcheck_migrations VALUES (?, ?)').run(name, Date.now());
  })();
  console.log('Applied migration:', name);
}
db.close();
