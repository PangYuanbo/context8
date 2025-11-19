import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";
import { mkdirSync, existsSync } from "fs";
import { ErrorSolution, SolutionSearchResult, ErrorType } from "./types.js";
import {
  generateSolutionEmbedding,
  generateEmbedding,
  serializeEmbedding,
  deserializeEmbedding,
  cosineSimilarity,
} from "./embeddings.js";

// Database configuration
const DB_DIR = join(homedir(), ".errorsolver");
const DB_PATH = join(DB_DIR, "solutions.db");

let db: Database.Database | null = null;

/**
 * Initialize the database and create tables if they don't exist
 */
export function initDatabase(): Database.Database {
  if (db) return db;

  // Ensure directory exists
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);

  // Enable WAL mode for better performance
  db.pragma("journal_mode = WAL");

  // Create main solutions table with embedding column
  db.exec(`
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
      embedding BLOB
    )
  `);

  // Add embedding column if it doesn't exist (for migration)
  try {
    db.exec(`ALTER TABLE solutions ADD COLUMN embedding BLOB`);
  } catch {
    // Column already exists
  }

  // Create FTS5 virtual table for full-text search (fallback)
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS solutions_fts USING fts5(
      id,
      title,
      error_message,
      error_type,
      context,
      root_cause,
      solution,
      tags,
      content=solutions,
      content_rowid=rowid
    )
  `);

  // Create triggers to keep FTS index in sync
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS solutions_ai AFTER INSERT ON solutions BEGIN
      INSERT INTO solutions_fts(rowid, id, title, error_message, error_type, context, root_cause, solution, tags)
      VALUES (new.rowid, new.id, new.title, new.error_message, new.error_type, new.context, new.root_cause, new.solution, new.tags);
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS solutions_ad AFTER DELETE ON solutions BEGIN
      INSERT INTO solutions_fts(solutions_fts, rowid, id, title, error_message, error_type, context, root_cause, solution, tags)
      VALUES('delete', old.rowid, old.id, old.title, old.error_message, old.error_type, old.context, old.root_cause, old.solution, old.tags);
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS solutions_au AFTER UPDATE ON solutions BEGIN
      INSERT INTO solutions_fts(solutions_fts, rowid, id, title, error_message, error_type, context, root_cause, solution, tags)
      VALUES('delete', old.rowid, old.id, old.title, old.error_message, old.error_type, old.context, old.root_cause, old.solution, old.tags);
      INSERT INTO solutions_fts(rowid, id, title, error_message, error_type, context, root_cause, solution, tags)
      VALUES (new.rowid, new.id, new.title, new.error_message, new.error_type, new.context, new.root_cause, new.solution, new.tags);
    END
  `);

  return db;
}

/**
 * Generate a unique ID for a solution
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * Save a new error solution to the database with embedding
 */
export async function saveSolution(
  solution: Omit<ErrorSolution, "id" | "createdAt">
): Promise<ErrorSolution> {
  const database = initDatabase();

  const id = generateId();
  const createdAt = new Date().toISOString();

  // Generate embedding for semantic search
  const embedding = await generateSolutionEmbedding({
    title: solution.title,
    errorMessage: solution.errorMessage,
    context: solution.context,
    rootCause: solution.rootCause,
    solution: solution.solution,
    tags: solution.tags,
  });

  const embeddingBuffer = serializeEmbedding(embedding);

  const stmt = database.prepare(`
    INSERT INTO solutions (id, title, error_message, error_type, context, root_cause, solution, code_changes, tags, created_at, project_path, embedding)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    solution.title,
    solution.errorMessage,
    solution.errorType,
    solution.context,
    solution.rootCause,
    solution.solution,
    solution.codeChanges || null,
    JSON.stringify(solution.tags),
    createdAt,
    solution.projectPath || null,
    embeddingBuffer
  );

  return {
    id,
    ...solution,
    createdAt,
  };
}

/**
 * Semantic search using embeddings
 */
export async function searchSolutionsSemantic(
  query: string,
  limit: number = 25
): Promise<SolutionSearchResult[]> {
  const database = initDatabase();

  // Get all solutions with embeddings
  const stmt = database.prepare(`
    SELECT id, title, error_type, error_message, context, tags, created_at, embedding
    FROM solutions
    WHERE embedding IS NOT NULL
  `);

  const rows = stmt.all() as Array<{
    id: string;
    title: string;
    error_type: string;
    error_message: string;
    context: string;
    tags: string;
    created_at: string;
    embedding: Buffer;
  }>;

  if (rows.length === 0) {
    // Fallback to FTS if no embeddings
    return searchSolutionsFTS(query, limit);
  }

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Calculate similarities
  const results = rows
    .map((row) => {
      const solutionEmbedding = deserializeEmbedding(row.embedding);
      const similarity = cosineSimilarity(queryEmbedding, solutionEmbedding);

      // Generate preview from error message and context
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
 * Fallback FTS search
 */
export function searchSolutionsFTS(query: string, limit: number = 10): SolutionSearchResult[] {
  const database = initDatabase();

  // Escape special FTS5 characters and prepare search query
  const searchQuery = query
    .replace(/['"]/g, "")
    .split(/\s+/)
    .filter((term) => term.length > 0)
    .map((term) => `"${term}"*`)
    .join(" OR ");

  if (!searchQuery) {
    // Return recent solutions if no query
    const stmt = database.prepare(`
      SELECT id, title, error_type, error_message, context, tags, created_at
      FROM solutions
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as Array<{
      id: string;
      title: string;
      error_type: string;
      error_message: string;
      context: string;
      tags: string;
      created_at: string;
    }>;

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

  const stmt = database.prepare(`
    SELECT s.id, s.title, s.error_type, s.error_message, s.context, s.tags, s.created_at,
           bm25(solutions_fts) as score
    FROM solutions_fts
    JOIN solutions s ON solutions_fts.id = s.id
    WHERE solutions_fts MATCH ?
    ORDER BY score
    LIMIT ?
  `);

  const rows = stmt.all(searchQuery, limit) as Array<{
    id: string;
    title: string;
    error_type: string;
    error_message: string;
    context: string;
    tags: string;
    created_at: string;
    score: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    errorType: row.error_type,
    tags: JSON.parse(row.tags),
    createdAt: row.created_at,
    score: row.score,
    preview:
      row.error_message.slice(0, 80) +
      (row.error_message.length > 80 ? "..." : "") +
      " | " +
      row.context.slice(0, 50),
  }));
}

/**
 * Main search function - uses semantic search with FTS fallback
 */
export async function searchSolutions(
  query: string,
  limit: number = 25
): Promise<SolutionSearchResult[]> {
  try {
    return await searchSolutionsSemantic(query, limit);
  } catch (error) {
    console.error("Semantic search failed, falling back to FTS:", error);
    return searchSolutionsFTS(query, limit);
  }
}

/**
 * Get a solution by ID
 */
export function getSolutionById(id: string): ErrorSolution | null {
  const database = initDatabase();

  const stmt = database.prepare(`
    SELECT id, title, error_message, error_type, context, root_cause, solution, code_changes, tags, created_at, project_path
    FROM solutions WHERE id = ?
  `);

  const row = stmt.get(id) as
    | {
        id: string;
        title: string;
        error_message: string;
        error_type: string;
        context: string;
        root_cause: string;
        solution: string;
        code_changes: string | null;
        tags: string;
        created_at: string;
        project_path: string | null;
      }
    | undefined;

  if (!row) return null;

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
  };
}

/**
 * Get multiple solutions by IDs
 */
export function getSolutionsByIds(ids: string[]): ErrorSolution[] {
  const database = initDatabase();

  if (ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(",");
  const stmt = database.prepare(`
    SELECT id, title, error_message, error_type, context, root_cause, solution, code_changes, tags, created_at, project_path
    FROM solutions WHERE id IN (${placeholders})
  `);

  const rows = stmt.all(...ids) as Array<{
    id: string;
    title: string;
    error_message: string;
    error_type: string;
    context: string;
    root_cause: string;
    solution: string;
    code_changes: string | null;
    tags: string;
    created_at: string;
    project_path: string | null;
  }>;

  return rows.map((row) => ({
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
  }));
}

/**
 * Get total count of solutions
 */
export function getSolutionCount(): number {
  const database = initDatabase();
  const stmt = database.prepare("SELECT COUNT(*) as count FROM solutions");
  const result = stmt.get() as { count: number };
  return result.count;
}

/**
 * Delete a solution by ID
 */
export function deleteSolution(id: string): boolean {
  const database = initDatabase();
  const stmt = database.prepare("DELETE FROM solutions WHERE id = ?");
  const result = stmt.run(id);
  return result.changes > 0;
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
