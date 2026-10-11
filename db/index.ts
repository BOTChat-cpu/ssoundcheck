import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
let database: BetterSQLite3Database<typeof schema> | undefined;
export function getDb() {
  if (!database) {
    const path = process.env.DATABASE_PATH || './data/site.sqlite';
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const client = new Database(path);
    client.pragma('journal_mode = WAL');
    client.pragma('foreign_keys = ON');
    database = drizzle(client, { schema });
  }
  return database;
}
