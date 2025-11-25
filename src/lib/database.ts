import Database from "better-sqlite3";
import type { Database as BetterSqlite3Database } from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { ErrorSolution, SolutionSearchResult, ErrorType, SearchOptions } from "./types.js";
import {
  generateSolutionEmbedding,
  generateEmbedding,
  serializeEmbedding,
  deserializeEmbedding,
  cosineSimilarity,
  getEmbeddingDimension,
} from "./embeddings.js";

// Database configuration
const DB_DIR = join(homedir(), ".context8");
const DB_PATH = join(DB_DIR, "solutions.db");

let db: BetterSqlite3Database | null = null;

export interface DatabaseHealth {
  ok: boolean;
  message: string;
  path: string;
  count?: number;
  issues?: string[];
}

function openDatabase(): BetterSqlite3Database {
  if (db) return db;

  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH, { timeout: 5000 }) as BetterSqlite3Database;
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
  ensureSchema(db);

  return db;
}

function ensureSchema(database: BetterSqlite3Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS solutions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      error_message TEXT NOT NULL,
      error_type TEXT NOT NULL,
      context TEXT NOT NULL,
      root_cause TEXT NOT NULL,
      solution TEXT NOT NULL,
      code_changes TEXT,
      tags TEXT NOT NULL,
      created_at TEXT NOT NULL,
      project_path TEXT,
      embedding BLOB,
      environment TEXT
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS solution_stats (
      solution_id TEXT PRIMARY KEY,
      doc_length INTEGER NOT NULL
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS inverted_index (
      term TEXT NOT NULL,
      solution_id TEXT NOT NULL,
      term_freq INTEGER NOT NULL,
      PRIMARY KEY (term, solution_id)
    );
  `);

  database.exec(`CREATE INDEX IF NOT EXISTS idx_inverted_term ON inverted_index(term);`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_inverted_solution ON inverted_index(solution_id);`);
}

/**
 * Initialize the database and create tables if they don't exist.
 */
export async function initDatabase(): Promise<BetterSqlite3Database> {
  return openDatabase();
}

/**
 * Generate a unique ID for a solution
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "of",
  "in",
  "on",
  "for",
  "to",
  "with",
  "is",
  "it",
  "this",
  "that",
  "by",
  "as",
  "at",
  "be",
  "or",
  "from",
  "are",
  "was",
  "were",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function indexableTextFromSolution(solution: ErrorSolution): string {
  const environmentText = solution.environment ? JSON.stringify(solution.environment) : "";
  return [
    solution.title,
    solution.errorMessage,
    solution.context,
    solution.rootCause,
    solution.solution,
    solution.tags.join(" "),
    environmentText,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildPreview(errorMessage?: string, context?: string): string | undefined {
  if (!errorMessage && !context) return undefined;
  const msg = errorMessage
    ? `${errorMessage.slice(0, 80)}${errorMessage.length > 80 ? "..." : ""}`
    : "";
  const ctx = context ? ` | ${context.slice(0, 50)}` : "";
  const combined = `${msg}${ctx}`.trim();
  return combined.length ? combined : undefined;
}

function mapRowToSolution(row: any): ErrorSolution {
  return {
    id: row.id,
    title: row.title,
    errorMessage: row.error_message,
    errorType: row.error_type as ErrorType,
    context: row.context,
    rootCause: row.root_cause,
    solution: row.solution,
    codeChanges: row.code_changes || undefined,
    tags: JSON.parse(row.tags),
    createdAt: row.created_at,
    projectPath: row.project_path || undefined,
    environment: row.environment ? JSON.parse(row.environment) : undefined,
  };
}

function updateSparseIndexForSolution(database: BetterSqlite3Database, solution: ErrorSolution): void {
  const tokens = tokenize(indexableTextFromSolution(solution));
  const docLength = Math.max(tokens.length, 1);

  const termCounts = new Map<string, number>();
  tokens.forEach((token) => {
    termCounts.set(token, (termCounts.get(token) || 0) + 1);
  });

  const deleteIndexStmt = database.prepare("DELETE FROM inverted_index WHERE solution_id = ?");
  const deleteStatsStmt = database.prepare("DELETE FROM solution_stats WHERE solution_id = ?");
  const insertTermStmt = database.prepare(
    "INSERT INTO inverted_index (term, solution_id, term_freq) VALUES (?, ?, ?)"
  );
  const insertStatsStmt = database.prepare(
    "INSERT INTO solution_stats (solution_id, doc_length) VALUES (?, ?)"
  );

  const tx = database.transaction(() => {
    deleteIndexStmt.run(solution.id);
    deleteStatsStmt.run(solution.id);
    for (const [term, count] of termCounts.entries()) {
      insertTermStmt.run(term, solution.id, count);
    }
    insertStatsStmt.run(solution.id, docLength);
  });

  tx();
}

function ensureSparseIndex(database: BetterSqlite3Database): void {
  const row = database.prepare("SELECT COUNT(*) as count FROM inverted_index").get() as {
    count: number;
  };
  if (row && row.count > 0) return;

  const solutions = database
    .prepare(
      `SELECT id, title, error_message, error_type, context, root_cause, solution, code_changes, tags, created_at, project_path, environment FROM solutions`
    )
    .all();

  for (const row of solutions) {
    updateSparseIndexForSolution(database, mapRowToSolution(row));
  }
}

function searchSolutionsSparseInternal(
  query: string,
  limit: number
): Array<{ id: string; score: number }> {
  const database = openDatabase();
  ensureSparseIndex(database);

  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const docLengths = new Map<string, number>();
  database
    .prepare("SELECT solution_id, doc_length FROM solution_stats")
    .all()
    .forEach((row: any) => {
      docLengths.set(row.solution_id, row.doc_length || 1);
    });

  const totalDocs = docLengths.size || 1;
  const avgDocLength =
    totalDocs === 0
      ? 1
      : Array.from(docLengths.values()).reduce((acc, len) => acc + len, 0) / totalDocs;

  const termPostingStmt = database.prepare(
    "SELECT solution_id, term_freq FROM inverted_index WHERE term = ?"
  );
  const dfStmt = database.prepare("SELECT COUNT(*) as df FROM inverted_index WHERE term = ?");

  const scores = new Map<string, number>();

  const k1 = 1.5;
  const b = 0.75;

  for (const term of terms) {
    const dfRow = dfStmt.get(term) as { df: number } | undefined;
    const df = dfRow?.df || 0;
    if (df === 0) continue;

    const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));

    const postings = termPostingStmt.all(term) as Array<{ solution_id: string; term_freq: number }>;
    for (const row of postings) {
      const docId = row.solution_id;
      const termFreq = row.term_freq;
      const docLen = docLengths.get(docId) || 1;

      const norm = termFreq * (k1 + 1);
      const denom = termFreq + k1 * (1 - b + (b * docLen) / avgDocLength);
      const score = idf * (norm / denom);
      scores.set(docId, (scores.get(docId) || 0) + score);
    }
  }

  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Save a new error solution to the database with embedding
 */
export async function saveSolution(
  solution: Omit<ErrorSolution, "id" | "createdAt">
): Promise<ErrorSolution> {
  const database = openDatabase();

  const id = generateId();
  const createdAt = new Date().toISOString();

  const environmentText = solution.environment ? JSON.stringify(solution.environment) : "";

  const embedding = await generateSolutionEmbedding({
    title: solution.title,
    errorMessage: solution.errorMessage,
    context: solution.context,
    rootCause: solution.rootCause,
    solution: solution.solution,
    tags: solution.tags,
    environmentText,
  });

  const embeddingBuffer = Buffer.from(new Uint8Array(serializeEmbedding(embedding)));

  const insertSolution = database.prepare(
    `
    INSERT INTO solutions (id, title, error_message, error_type, context, root_cause, solution, code_changes, tags, created_at, project_path, embedding, environment)
    VALUES (@id, @title, @error_message, @error_type, @context, @root_cause, @solution, @code_changes, @tags, @created_at, @project_path, @embedding, @environment)
  `
  );

  const tx = database.transaction(() => {
    insertSolution.run({
      id,
      title: solution.title,
      error_message: solution.errorMessage,
      error_type: solution.errorType,
      context: solution.context,
      root_cause: solution.rootCause,
      solution: solution.solution,
      code_changes: solution.codeChanges || null,
      tags: JSON.stringify(solution.tags),
      created_at: createdAt,
      project_path: solution.projectPath || null,
      embedding: embeddingBuffer,
      environment: solution.environment ? JSON.stringify(solution.environment) : null,
    });

    updateSparseIndexForSolution(database, {
      id,
      ...solution,
      createdAt,
    });
  });

  tx();

  return {
    id,
    ...solution,
    createdAt,
    environment: solution.environment,
  };
}

/**
 * Semantic search using embeddings
 */
export async function searchSolutionsSemantic(
  query: string,
  limit: number = 25,
  candidateIds?: string[]
): Promise<SolutionSearchResult[]> {
  const database = openDatabase();

  let rows: Array<{
    id: string;
    title: string;
    error_type: string;
    error_message: string;
    context: string;
    tags: string;
    created_at: string;
    embedding: Buffer | null;
  }> = [];

  if (candidateIds && candidateIds.length === 0) {
    return [];
  }

  if (candidateIds && candidateIds.length > 0) {
    const placeholders = candidateIds.map(() => "?").join(",");
    rows = database
      .prepare(
        `
        SELECT id, title, error_type, error_message, context, tags, created_at, embedding
        FROM solutions
        WHERE embedding IS NOT NULL AND id IN (${placeholders})
      `
      )
      .all(...candidateIds) as any;
  } else {
    rows = database
      .prepare(
        `
        SELECT id, title, error_type, error_message, context, tags, created_at, embedding
        FROM solutions
        WHERE embedding IS NOT NULL
      `
      )
      .all() as any;
  }

  if (rows.length === 0) {
    return searchSolutionsFTS(query, limit);
  }

  const queryEmbedding = await generateEmbedding(query);

  const results = rows
    .map((row) => {
      const solutionEmbedding = deserializeEmbedding(row.embedding as Buffer);
      const similarity = cosineSimilarity(queryEmbedding, solutionEmbedding);

      const preview =
        row.error_message.slice(0, 80) +
        (row.error_message.length > 80 ? "..." : "") +
        " | " +
        row.context.slice(0, 50);

      return {
        id: row.id,
        title: row.title,
        errorType: row.error_type,
        tags: JSON.parse(row.tags) as string[],
        createdAt: row.created_at,
        similarity,
        preview,
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}

/**
 * Fallback LIKE search
 */
export async function searchSolutionsFTS(
  query: string,
  limit: number = 10
): Promise<SolutionSearchResult[]> {
  const database = openDatabase();

  const terms = query
    .replace(/['"]/g, "")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 0);

  if (terms.length === 0) {
    const rows = database
      .prepare(
        `
        SELECT id, title, error_type, error_message, context, tags, created_at
        FROM solutions
        ORDER BY created_at DESC
        LIMIT ?
      `
      )
      .all(limit) as any[];

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      errorType: row.error_type,
      tags: JSON.parse(row.tags),
      createdAt: row.created_at,
      preview:
        row.error_message.slice(0, 80) +
        (row.error_message.length > 80 ? "..." : "") +
        " | " +
        row.context.slice(0, 50),
    }));
  }

  const likeClauses = terms
    .map(
      () =>
        `(title LIKE ? OR error_message LIKE ? OR error_type LIKE ? OR context LIKE ? OR root_cause LIKE ? OR solution LIKE ? OR tags LIKE ?)`
    )
    .join(" AND ");

  const params: (string | number)[] = [];
  terms.forEach((term) => {
    const likeTerm = `%${term}%`;
    params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
  });
  params.push(limit);

  const rows = database
    .prepare(
      `
      SELECT id, title, error_type, error_message, context, tags, created_at
      FROM solutions
      WHERE ${likeClauses}
      ORDER BY created_at DESC
      LIMIT ?
    `
    )
    .all(...params) as any[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    errorType: row.error_type,
    tags: JSON.parse(row.tags),
    createdAt: row.created_at,
    preview:
      row.error_message.slice(0, 80) +
      (row.error_message.length > 80 ? "..." : "") +
      " | " +
      row.context.slice(0, 50),
  }));
}

async function searchSolutionsSparse(
  query: string,
  limit: number = 25
): Promise<SolutionSearchResult[]> {
  const sparseResults = searchSolutionsSparseInternal(query, Math.max(limit, 100));
  if (sparseResults.length === 0) return [];

  const solutionIds = sparseResults.map((r) => r.id);
  const solutions = await getSolutionsByIds(solutionIds);
  const solutionMap = new Map(solutions.map((s) => [s.id, s]));
  const maxSparse = Math.max(...sparseResults.map((r) => r.score), 0) || 1;

  return sparseResults.slice(0, limit).map((r) => {
    const solution = solutionMap.get(r.id);
    const preview = buildPreview(solution?.errorMessage, solution?.context);

    return {
      id: r.id,
      title: solution?.title || r.id,
      errorType: solution?.errorType || "other",
      tags: solution?.tags || [],
      createdAt: solution?.createdAt || "",
      score: r.score / maxSparse,
      preview: preview || undefined,
    };
  });
}

async function searchSolutionsHybrid(
  query: string,
  limit: number,
  options: SearchOptions
): Promise<SolutionSearchResult[]> {
  const denseWeight = options.denseWeight ?? 0.7;
  const sparseWeight = options.sparseWeight ?? 0.3;
  const coarseLimit = options.coarseLimit ?? Math.max(limit * 5, 200);

  const sparseCandidates = searchSolutionsSparseInternal(query, coarseLimit);
  const candidateIds = sparseCandidates.map((r) => r.id);

  const denseCandidates = candidateIds.length
    ? await searchSolutionsSemantic(query, candidateIds.length, candidateIds)
    : await searchSolutionsSemantic(query, limit);

  if (candidateIds.length === 0) {
    return denseCandidates.slice(0, limit);
  }

  const denseMap = new Map(denseCandidates.map((d) => [d.id, d]));
  const sparseMap = new Map(sparseCandidates.map((s) => [s.id, s.score]));
  const maxSparse = Math.max(...sparseCandidates.map((s) => s.score), 0) || 1;

  const unionIds = Array.from(new Set([...candidateIds, ...denseCandidates.map((d) => d.id)]));

  const missingMetaIds = unionIds.filter((id) => !denseMap.has(id));
  const missingMeta = missingMetaIds.length ? await getSolutionsByIds(missingMetaIds) : [];
  const metaMap = new Map(missingMeta.map((m) => [m.id, m]));

  const combined = unionIds
    .map((id) => {
      const dense = denseMap.get(id);
      const sparseScoreRaw = sparseMap.get(id) || 0;
      const sparseNorm = sparseScoreRaw / maxSparse;
      const denseSim = dense?.similarity ?? 0;
      const finalScore = denseWeight * denseSim + sparseWeight * sparseNorm;

      const meta = dense ? null : metaMap.get(id);

      const preview = dense?.preview ?? buildPreview(meta?.errorMessage, meta?.context);

      return {
        id,
        title: dense?.title || meta?.title || id,
        errorType: dense?.errorType || meta?.errorType || "other",
        tags: dense?.tags || meta?.tags || [],
        createdAt: dense?.createdAt || meta?.createdAt || "",
        similarity: finalScore,
        score: sparseNorm,
        preview,
      } as SolutionSearchResult;
    })
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, limit);

  return combined;
}

/**
 * Search directly with a provided embedding vector (cosine similarity)
 */
export async function searchSolutionsByVector(
  embedding: number[],
  limit: number = 25
): Promise<SolutionSearchResult[]> {
  const dimension = getEmbeddingDimension();
  if (embedding.length !== dimension) {
    throw new Error(
      `Embedding length ${embedding.length} does not match model dimension ${dimension}`
    );
  }

  const database = openDatabase();
  const rows = database
    .prepare(
      `
      SELECT id, title, error_type, error_message, context, tags, created_at, embedding
      FROM solutions
      WHERE embedding IS NOT NULL
    `
    )
    .all() as Array<{
      id: string;
      title: string;
      error_type: string;
      error_message: string;
      context: string;
      tags: string;
      created_at: string;
      embedding: Buffer;
    }>;

  return rows
    .map((row) => {
      const solutionEmbedding = deserializeEmbedding(row.embedding);
      const similarity = cosineSimilarity(embedding, solutionEmbedding);
      const preview = buildPreview(row.error_message, row.context);

      return {
        id: row.id,
        title: row.title,
        errorType: row.error_type,
        tags: JSON.parse(row.tags) as string[],
        createdAt: row.created_at,
        similarity,
        preview,
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Main search function - uses semantic search with FTS fallback
 */
export async function searchSolutions(
  query: string,
  limit: number = 25,
  options: SearchOptions = {}
): Promise<SolutionSearchResult[]> {
  const mode = options.mode || "hybrid";
  try {
    if (mode === "semantic") {
      return await searchSolutionsSemantic(query, limit);
    }
    if (mode === "sparse") {
      return await searchSolutionsSparse(query, limit);
    }
    return await searchSolutionsHybrid(query, limit, options);
  } catch (error) {
    console.error("Search failed, falling back to LIKE-based search:", error);
    return searchSolutionsFTS(query, limit);
  }
}

/**
 * Get a solution by ID
 */
export async function getSolutionById(id: string): Promise<ErrorSolution | null> {
  const database = openDatabase();

  const row = database
    .prepare(
      `
    SELECT id, title, error_message, error_type, context, root_cause, solution, code_changes, tags, created_at, project_path, environment
    FROM solutions WHERE id = ?
  `
    )
    .get(id);

  if (!row) return null;

  return mapRowToSolution(row);
}

/**
 * Get multiple solutions by IDs
 */
export async function getSolutionsByIds(ids: string[]): Promise<ErrorSolution[]> {
  const database = openDatabase();

  if (ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(",");
  const rows = database
    .prepare(
      `
      SELECT id, title, error_message, error_type, context, root_cause, solution, code_changes, tags, created_at, project_path, environment
      FROM solutions WHERE id IN (${placeholders})
    `
    )
    .all(...ids);

  return rows.map(mapRowToSolution);
}

/**
 * Get total count of solutions
 */
export async function getSolutionCount(): Promise<number> {
  const database = openDatabase();
  const row = database.prepare("SELECT COUNT(*) as count FROM solutions").get() as { count: number };
  return row?.count || 0;
}

/**
 * Delete a solution by ID
 */
export async function deleteSolution(id: string): Promise<boolean> {
  const database = openDatabase();

  const delSolution = database.prepare("DELETE FROM solutions WHERE id = ?");
  const delIndex = database.prepare("DELETE FROM inverted_index WHERE solution_id = ?");
  const delStats = database.prepare("DELETE FROM solution_stats WHERE solution_id = ?");

  const tx = database.transaction((solutionId: string) => {
    const res = delSolution.run(solutionId);
    delIndex.run(solutionId);
    delStats.run(solutionId);
    return res.changes;
  });

  const changes = tx(id);

  return (changes || 0) > 0;
}

/**
 * Get database file path
 */
export function getDatabasePath(): string {
  return DB_PATH;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Migration helper: ensure schema, WAL, and sparse index.
 * Safe to run multiple times; idempotent.
 */
export function migrateDatabase(): void {
  const database = openDatabase();
  ensureSchema(database);
  ensureSparseIndex(database);
}

/**
 * List solutions (recent first) for CLI utilities
 */
export async function listSolutions(
  limit: number = 50,
  offset: number = 0
): Promise<ErrorSolution[]> {
  const database = openDatabase();
  const rows = database
    .prepare(
      `
      SELECT id, title, error_message, error_type, context, root_cause, solution, code_changes, tags, created_at, project_path, environment
      FROM solutions
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(limit, offset);

  return rows.map(mapRowToSolution);
}

/**
 * Health check: schema columns and row count
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  try {
    const database = openDatabase();
    const tableInfo = database.prepare("PRAGMA table_info(solutions);").all();
    const columns = tableInfo.map((row: any) => row.name as string);
    const requiredColumns = [
      "id",
      "title",
      "error_message",
      "error_type",
      "context",
      "root_cause",
      "solution",
      "tags",
      "created_at",
    ];
    const issues: string[] = [];
    for (const col of requiredColumns) {
      if (!columns.includes(col)) issues.push(`missing column: ${col}`);
    }

    const row = database.prepare("SELECT COUNT(*) as count FROM solutions").get() as { count: number };

    return {
      ok: issues.length === 0,
      message: issues.length === 0 ? "Database is healthy" : "Schema issues detected",
      path: DB_PATH,
      count: row?.count || 0,
      issues: issues.length ? issues : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "unknown database error",
      path: DB_PATH,
    };
  }
}
