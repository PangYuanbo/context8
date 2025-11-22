import { ErrorSolution, SolutionSearchResult, ErrorType, SearchOptions } from "./types.js";

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
  const res = await fetch(`${config.baseUrl}/solutions`, {
    method: "POST",
    headers: headers(config.apiKey),
    body: JSON.stringify(solution),
  });
  if (!res.ok) {
    throw new Error(`Remote save failed: ${res.status}`);
  }
  const data = (await res.json()) as ErrorSolution;
  return data;
}

export async function remoteGetSolutionById(
  config: RemoteConfig,
  id: string
): Promise<ErrorSolution | null> {
  const res = await fetch(`${config.baseUrl}/solutions/${id}`, {
    headers: headers(config.apiKey),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Remote get failed: ${res.status}`);
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
  _options: SearchOptions = {}
): Promise<SolutionSearchResult[]> {
  const res = await fetch(`${config.baseUrl}/search`, {
    method: "POST",
    headers: headers(config.apiKey),
    body: JSON.stringify({ query, limit, offset: 0 }),
  });
  if (!res.ok) throw new Error(`Remote search failed: ${res.status}`);
  const data = (await res.json()) as { total: number; results: SolutionSearchResult[] };
  return data.results;
}

export async function remoteGetSolutionCount(config: RemoteConfig): Promise<number> {
  // crude count via search empty query
  const res = await fetch(`${config.baseUrl}/search`, {
    method: "POST",
    headers: headers(config.apiKey),
    body: JSON.stringify({ query: "", limit: 1, offset: 0 }),
  });
  if (!res.ok) throw new Error(`Remote count failed: ${res.status}`);
  const data = (await res.json()) as { total: number };
  return data.total ?? 0;
}

export async function remoteDeleteSolution(config: RemoteConfig, id: string): Promise<boolean> {
  const res = await fetch(`${config.baseUrl}/solutions/${id}`, {
    method: "DELETE",
    headers: headers(config.apiKey),
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Remote delete failed: ${res.status}`);
  return true;
}
