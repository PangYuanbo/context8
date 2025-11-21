import initSqlJs, { SqlJsStatic, Database as SqlJsDatabase } from "sql.js";
import { homedir } from "os";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const CACHE_DIR = join(homedir(), ".context8");
const CACHE_DB_PATH = join(CACHE_DIR, "context7-cache.db");

let sqlPromise: Promise<SqlJsStatic> | null = null;
let cacheDb: SqlJsDatabase | null = null;

async function loadSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    const wasmPath = join(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm");
    sqlPromise = initSqlJs({
      locateFile: () => wasmPath,
    });
  }
  return sqlPromise;
}

function persist(database: SqlJsDatabase): void {
  const data = database.export();
  writeFileSync(CACHE_DB_PATH, Buffer.from(data));
}

function ensureSchema(database: SqlJsDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS context7_cache (
      cache_key TEXT PRIMARY KEY,
      library_id TEXT NOT NULL,
      topic TEXT,
      page INTEGER NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

export async function initContext7CacheDb(): Promise<SqlJsDatabase> {
  if (cacheDb) return cacheDb;

  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }

  const SQL = await loadSql();
  if (existsSync(CACHE_DB_PATH)) {
    const buffer = readFileSync(CACHE_DB_PATH);
    cacheDb = new SQL.Database(new Uint8Array(buffer));
  } else {
    cacheDb = new SQL.Database();
  }

  ensureSchema(cacheDb);
  persist(cacheDb);
  return cacheDb;
}

function buildCacheKey(libraryId: string, topic?: string, page: number = 1): string {
  const normalizedTopic = topic || "";
  return `${libraryId}::${normalizedTopic}::${page}`;
}

export async function getCachedContext7Doc(
  libraryId: string,
  topic: string | undefined,
  page: number
): Promise<string | null> {
  const db = await initContext7CacheDb();
  const stmt = db.prepare("SELECT payload FROM context7_cache WHERE cache_key = ? LIMIT 1");
  const key = buildCacheKey(libraryId, topic, page);
  stmt.bind([key]);
  const row = stmt.step() ? (stmt.getAsObject() as any) : null;
  stmt.free();
  return row?.payload ?? null;
}

export async function setCachedContext7Doc(
  libraryId: string,
  topic: string | undefined,
  page: number,
  payload: string
): Promise<void> {
  const db = await initContext7CacheDb();
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO context7_cache (cache_key, library_id, topic, page, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const key = buildCacheKey(libraryId, topic, page);
  stmt.run([key, libraryId, topic || null, page, payload, new Date().toISOString()]);
  stmt.free();
  persist(db);
}

export function getContext7CachePath(): string {
  return CACHE_DB_PATH;
}
