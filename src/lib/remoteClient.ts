import { ErrorSolution, SolutionSearchResult, SearchOptions } from "./types.js";

const DEFAULT_TIMEOUT_MS = 10000;

function resolveTimeout(): number {
  const raw = process.env.CONTEXT8_REQUEST_TIMEOUT;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = resolveTimeout()): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);
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
  const res = await withTimeout(
    fetch(`${config.baseUrl}/solutions`, {
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
  const res = await withTimeout(
    fetch(`${config.baseUrl}/solutions/${id}`, {
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
  const payload: Record<string, unknown> = { query, limit, offset: 0 };
  if (options.mode) {
    payload.mode = options.mode;
  }

  const res = await withTimeout(
    fetch(`${config.baseUrl}/search`, {
      method: "POST",
      headers: headers(config.apiKey),
      body: JSON.stringify(payload),
    })
  );

  // Backward compatibility: some servers may not accept mode; retry without it on 400/422.
  if (!res.ok && options.mode && (res.status === 400 || res.status === 422)) {
    const retry = await withTimeout(
      fetch(`${config.baseUrl}/search`, {
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

export async function remoteGetSolutionCount(config: RemoteConfig): Promise<number> {
  // crude count via search empty query
  const res = await withTimeout(
    fetch(`${config.baseUrl}/search`, {
      method: "POST",
      headers: headers(config.apiKey),
      // use non-empty placeholder to satisfy backend validation
      body: JSON.stringify({ query: "*", limit: 1, offset: 0 }),
    })
  );
  if (!res.ok) throw new Error(`Remote count failed: ${await parseError(res)}`);
  const data = (await res.json()) as { total: number };
  return data.total ?? 0;
}

export async function remoteDeleteSolution(config: RemoteConfig, id: string): Promise<boolean> {
  const res = await withTimeout(
    fetch(`${config.baseUrl}/solutions/${id}`, {
      method: "DELETE",
      headers: headers(config.apiKey),
    })
  );
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Remote delete failed: ${await parseError(res)}`);
  return true;
}
