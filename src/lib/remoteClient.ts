import { ErrorSolution, SolutionSearchResult, SearchOptions } from "./types.js";

const DEFAULT_TIMEOUT_MS = 10000;
const MIN_NODE_VERSION = "18";

function requireFetch(): typeof fetch {
  if (typeof fetch !== "function") {
    throw new Error(
      `Global fetch is unavailable. Remote mode requires Node.js >= ${MIN_NODE_VERSION}.`
    );
  }
  return fetch;
}

function resolveTimeout(): number {
  const raw = process.env.CONTEXT8_REQUEST_TIMEOUT;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = resolveTimeout()
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Request timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function parseError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export interface RemoteConfig {
  baseUrl: string;
  apiKey?: string;
}

function headers(apiKey?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) h["X-API-Key"] = apiKey;
  return h;
}

export async function remoteSaveSolution(
  config: RemoteConfig,
  solution: Omit<ErrorSolution, "id" | "createdAt">
): Promise<ErrorSolution> {
  const fetchImpl = requireFetch();
  const res = await withTimeout(
    fetchImpl(`${config.baseUrl}/solutions`, {
      method: "POST",
      headers: headers(config.apiKey),
      body: JSON.stringify(solution),
    })
  );
  if (!res.ok) {
    throw new Error(`Remote save failed: ${await parseError(res)}`);
  }
  return (await res.json()) as ErrorSolution;
}

export async function remoteGetSolutionById(
  config: RemoteConfig,
  id: string
): Promise<ErrorSolution | null> {
  const fetchImpl = requireFetch();
  const res = await withTimeout(
    fetchImpl(`${config.baseUrl}/solutions/${id}`, {
      headers: headers(config.apiKey),
    })
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Remote get failed: ${await parseError(res)}`);
  return (await res.json()) as ErrorSolution;
}

export async function remoteGetSolutionsByIds(
  config: RemoteConfig,
  ids: string[]
): Promise<ErrorSolution[]> {
  const results: ErrorSolution[] = [];
  for (const id of ids) {
    const item = await remoteGetSolutionById(config, id);
    if (item) results.push(item);
  }
  return results;
}

export async function remoteSearchSolutions(
  config: RemoteConfig,
  query: string,
  limit = 25,
  options: SearchOptions = {}
): Promise<SolutionSearchResult[]> {
  const fetchImpl = requireFetch();
  const payload: Record<string, unknown> = { query, limit, offset: 0 };
  if (options.mode) {
    payload.mode = options.mode;
  }

  const res = await withTimeout(
    fetchImpl(`${config.baseUrl}/search`, {
      method: "POST",
      headers: headers(config.apiKey),
      body: JSON.stringify(payload),
    })
  );

  // Backward compatibility: some servers may not accept mode; retry without it on 400/422.
  if (!res.ok && options.mode && (res.status === 400 || res.status === 422)) {
    const retry = await withTimeout(
      fetchImpl(`${config.baseUrl}/search`, {
        method: "POST",
        headers: headers(config.apiKey),
        body: JSON.stringify({ query, limit, offset: 0 }),
      })
    );
    if (!retry.ok) throw new Error(`Remote search failed: ${await parseError(retry)}`);
    const retryData = (await retry.json()) as { total: number; results: SolutionSearchResult[] };
    return retryData.results;
  }

  if (!res.ok) throw new Error(`Remote search failed: ${await parseError(res)}`);
  const data = (await res.json()) as { total: number; results: SolutionSearchResult[] };
  return data.results;
}

export async function remoteListSolutions(
  config: RemoteConfig,
  limit = 10,
  offset = 0
): Promise<SolutionSearchResult[]> {
  const fetchImpl = requireFetch();
  const res = await withTimeout(
    fetchImpl(
      `${config.baseUrl}/solutions?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(
        offset
      )}`,
      {
        headers: headers(config.apiKey),
      }
    )
  );

  if (res.ok) {
    const data = (await res.json()) as Array<ErrorSolution | SolutionSearchResult>;
    return data.map((item) => ({
      id: item.id,
      title: item.title,
      errorType: item.errorType,
      tags: item.tags,
      createdAt: item.createdAt,
      score: "score" in item ? item.score : undefined,
      similarity: "similarity" in item ? item.similarity : undefined,
      preview: "preview" in item ? item.preview : undefined,
    }));
  }

  if (res.status !== 404 && res.status !== 405) {
    throw new Error(`Remote list failed: ${await parseError(res)}`);
  }

  try {
    return await remoteSearchSolutions(config, " ", limit, { mode: "sparse" });
  } catch {
    try {
      return await remoteSearchSolutions(config, "recent", limit, { mode: "sparse" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Remote list fallback failed: ${message}`);
      return [];
    }
  }
}

async function legacyCountViaSearch(config: RemoteConfig): Promise<number> {
  const fetchImpl = requireFetch();
  // Approximate count via keyword search; may be off but avoids throwing.
  const res = await withTimeout(
    fetchImpl(`${config.baseUrl}/search`, {
      method: "POST",
      headers: headers(config.apiKey),
      body: JSON.stringify({ query: " ", limit: 0, offset: 0 }),
    })
  );
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { total?: number };
  return typeof data.total === "number" ? data.total : 0;
}

export async function remoteGetSolutionCount(config: RemoteConfig): Promise<number> {
  const fallback = async () => {
    try {
      return await legacyCountViaSearch(config);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Remote count fallback failed: ${message}`);
      throw new Error(message);
    }
  };

  try {
    const fetchImpl = requireFetch();
    const res = await withTimeout(
      fetchImpl(`${config.baseUrl}/solutions/count`, {
        headers: headers(config.apiKey),
      })
    );

    if (res.ok) {
      const data = (await res.json()) as { total?: number };
      if (typeof data.total === "number") return data.total;
      throw new Error("Invalid count payload");
    }

    if (res.status === 404 || res.status === 405) {
      console.warn(
        "Remote count endpoint missing; using search-based approximation (may be inaccurate)."
      );
      return await fallback();
    }

    throw new Error(`Remote count failed: ${await parseError(res)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Remote count request failed; using search-based approximation: ${message}`);
    return await fallback();
  }
}

export async function remoteDeleteSolution(config: RemoteConfig, id: string): Promise<boolean> {
  const fetchImpl = requireFetch();
  const res = await withTimeout(
    fetchImpl(`${config.baseUrl}/solutions/${id}`, {
      method: "DELETE",
      headers: headers(config.apiKey),
    })
  );
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Remote delete failed: ${await parseError(res)}`);
  return true;
}
