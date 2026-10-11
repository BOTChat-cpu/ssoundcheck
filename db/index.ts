import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
let database: BetterSQLite3Database<typeof schema> | undefined;
let sqlite: Database.Database | undefined;
export function getSqlite() {
  if (!sqlite) {
    const path = process.env.DATABASE_PATH || './data/site.sqlite';
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    sqlite = new Database(path);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('busy_timeout = 5000');
  }
  return sqlite;
}
export function getDb() {
  if (!database) {
    database = drizzle(getSqlite(), { schema });
  }
  return database;
}
