import Database from "better-sqlite3";
import type { Database as BetterSqlite3Database } from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

const CACHE_DIR = join(homedir(), ".context8");
const CACHE_DB_PATH = join(CACHE_DIR, "context7-cache.db");

let cacheDb: BetterSqlite3Database | null = null;

function openCacheDb(): BetterSqlite3Database {
  if (cacheDb) return cacheDb;

  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }

  cacheDb = new Database(CACHE_DB_PATH, { timeout: 2000 }) as BetterSqlite3Database;
  cacheDb.pragma("journal_mode = WAL");
  cacheDb.pragma("busy_timeout = 2000");
  cacheDb.pragma("synchronous = NORMAL");

  cacheDb.exec(`
    CREATE TABLE IF NOT EXISTS context7_cache (
      cache_key TEXT PRIMARY KEY,
      library_id TEXT NOT NULL,
      topic TEXT,
      page INTEGER NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  return cacheDb;
}

function buildCacheKey(libraryId: string, topic: string | undefined, page: number = 1): string {
  const normalizedTopic = topic || "";
  return `${libraryId}::${normalizedTopic}::${page}`;
}

export async function getCachedContext7Doc(
  libraryId: string,
  topic: string | undefined,
  page: number
): Promise<string | null> {
  const db = openCacheDb();
  const key = buildCacheKey(libraryId, topic, page);
  const row = db
    .prepare("SELECT payload FROM context7_cache WHERE cache_key = ? LIMIT 1")
    .get(key) as { payload: string } | undefined;
  return row?.payload ?? null;
}

export async function setCachedContext7Doc(
  libraryId: string,
  topic: string | undefined,
  page: number,
  payload: string
): Promise<void> {
  const db = openCacheDb();
  const key = buildCacheKey(libraryId, topic, page);
  db.prepare(
    "INSERT OR REPLACE INTO context7_cache (cache_key, library_id, topic, page, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(key, libraryId, topic || null, page, payload, new Date().toISOString());
}

export function getContext7CachePath(): string {
  return CACHE_DB_PATH;
}
