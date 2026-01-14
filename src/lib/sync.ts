import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import crypto from "crypto";
import { RemoteConfig } from "./remoteClient.js";
import { loadConfig } from "./config.js";

const SYNC_MAP_PATH = join(homedir(), ".context8", "remote-sync.json");
const CONFIG_DIR = join(homedir(), ".context8");

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadSyncMap(): Record<string, string> {
  try {
    if (!existsSync(SYNC_MAP_PATH)) return {};
    const raw = readFileSync(SYNC_MAP_PATH, "utf-8");
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveSyncMap(map: Record<string, string>): void {
  ensureConfigDir();
  writeFileSync(SYNC_MAP_PATH, JSON.stringify(map, null, 2), { mode: 0o600 });
}

export function hashSolution(payload: {
  title: string;
  errorMessage: string;
  rootCause: string;
  solution: string;
  tags: string[];
}): string {
  const h = crypto.createHash("sha256");
  h.update(payload.title);
  h.update(payload.errorMessage);
  h.update(payload.rootCause);
  h.update(payload.solution);
  h.update(payload.tags.join(","));
  return h.digest("hex");
}

export function maskApiKey(apiKey?: string): string {
  if (!apiKey) return "(not set)";
  if (apiKey.length <= 4) return "*".repeat(apiKey.length);
  const maskedCore = "*".repeat(Math.max(apiKey.length - 4, 2));
  return `${apiKey.slice(0, 2)}${maskedCore}${apiKey.slice(-2)}`;
}

export function describeRemoteSource(url?: string, apiKey?: string): string {
  const urlSrc = url ? "resolved from flag/env/config" : "not set";
  const keySrc = apiKey ? "resolved from flag/env/config" : "not set";
  return `Remote URL: ${url ?? "(missing)"} | API key: ${maskApiKey(apiKey)} | Sources: ${urlSrc} / ${keySrc}`;
}

export function resolveRemoteConfig(
  overrideUrl?: string,
  overrideApiKey?: string
): RemoteConfig | null {
  const savedConfig = loadConfig();
  const DEFAULT_REMOTE_URL = "https://api.context8.org";
  const baseUrl = overrideUrl || process.env.CONTEXT8_REMOTE_URL || savedConfig.remoteUrl || DEFAULT_REMOTE_URL;
  const apiKey =
    overrideApiKey || process.env.CONTEXT8_REMOTE_API_KEY || savedConfig.apiKey || undefined;

  // If using default URL but no API key, fall back to local mode
  if (baseUrl === DEFAULT_REMOTE_URL && !apiKey) {
    return null;
  }

  return apiKey ? { baseUrl, apiKey } : { baseUrl };
}

export function getSyncMapPath(): string {
  return SYNC_MAP_PATH;
}
