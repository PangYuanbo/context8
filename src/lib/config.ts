import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface Context8Config {
  remoteUrl?: string;
  apiKey?: string;
}

const CONFIG_DIR = join(homedir(), ".context8");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function loadConfig(): Context8Config {
  try {
    if (!existsSync(CONFIG_PATH)) return {};
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Context8Config;
    return parsed || {};
  } catch (error) {
    console.warn("Failed to read Context8 config, using defaults:", error);
    return {};
  }
}

export function saveConfig(update: Partial<Context8Config>): Context8Config {
  ensureConfigDir();
  const existing = loadConfig();
  const merged: Context8Config = { ...existing, ...update };
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), { mode: 0o600 });
  return merged;
}

export function clearConfig(): void {
  try {
    if (existsSync(CONFIG_PATH)) {
      unlinkSync(CONFIG_PATH);
    }
  } catch (error) {
    console.warn("Failed to clear Context8 config file:", error);
  }
}
