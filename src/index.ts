#!/usr/bin/env node

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { existsSync, readFileSync, realpathSync } from "fs";
import { join, resolve, sep } from "path";
import { execSync, spawnSync } from "child_process";
import { Command } from "commander";
import { ErrorType } from "./lib/types.js";
import {
  remoteSaveSolution,
  remoteSearchSolutions,
  remoteGetSolutionCount,
  remoteGetSolutionById,
  remoteGetSolutionsByIds,
  remoteDeleteSolution,
  remoteListSolutions,
} from "./lib/remoteClient.js";
import { clearConfig, getConfigPath, loadConfig, saveConfig } from "./lib/config.js";
import {
  describeRemoteSource,
  hashSolution,
  loadSyncMap,
  maskApiKey,
  resolveRemoteConfig,
  saveSyncMap,
} from "./lib/sync.js";

const pkgJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

type LocalDbModule = typeof import("./lib/database.js");

let localDbModulePromise: Promise<LocalDbModule> | null = null;
let recentSearchCache: SolutionSearchResult[] = [];
let recentSearchUpdatedAt: string | null = null;

async function loadLocalDbModule(): Promise<LocalDbModule> {
  if (!localDbModulePromise) {
    localDbModulePromise = import("./lib/database.js");
  }

  try {
    return await localDbModulePromise;
  } catch (error) {
    localDbModulePromise = null;
    const hint =
      "Local mode requires optional deps better-sqlite3 and @xenova/transformers. Install them with `npm i better-sqlite3 @xenova/transformers` or switch to remote mode.";
    const suffix = error instanceof Error ? ` (${error.message})` : "";
    throw new Error(`${hint}${suffix}`);
  }
}

function isMissingLocalDeps(error: unknown): error is Error {
  return error instanceof Error && error.message.includes("Local mode requires optional deps");
}

function printLocalDepHelp(): void {
  console.error(
    [
      "Local mode requires optional deps better-sqlite3 and @xenova/transformers.",
      "Fix options:",
      "- Run: context8-mcp setup-local",
      "- Or switch to remote mode: context8-mcp remote-config --remote-url https://api.context8.org --api-key <key> (or set env CONTEXT8_REMOTE_URL/CONTEXT8_REMOTE_API_KEY)",
    ].join("\n")
  );
}

function getInstallationPaths(): {
  currentExecutable: string;
  globalInstall: string | null;
  npmGlobalRoot: string | null;
} {
  // Get current executable path
  const currentExecutable = process.argv[1];

  // Try to find global installation
  let globalInstall: string | null = null;
  let npmGlobalRoot: string | null = null;

  try {
    // Try to get npm global root
    const npmRoot = execSync("npm root -g", { encoding: "utf-8" }).trim();
    if (npmRoot) {
      npmGlobalRoot = join(npmRoot, "context8-mcp");
    }
  } catch {
    // Ignore errors
  }

  try {
    // Try to find via which/where command
    const whichCmd = process.platform === "win32" ? "where" : "which";
    const result = execSync(`${whichCmd} context8-mcp`, { encoding: "utf-8" }).trim();
    if (result) {
      globalInstall = result.split("\n")[0]; // Take first result
    }
  } catch {
    // Ignore errors - command might not be in PATH
  }

  return { currentExecutable, globalInstall, npmGlobalRoot };
}

function resolveCliPath(bin: string): string | null {
  try {
    const whichCmd = process.platform === "win32" ? "where" : "which";
    const result = execSync(`${whichCmd} ${bin}`, { encoding: "utf-8" }).trim();
    if (!result) return null;
    return result.split("\n")[0];
  } catch {
    return null;
  }
}

function formatCommand(bin: string, args: string[]): string {
  const quote = (value: string) => (/\s|["'$]/.test(value) ? JSON.stringify(value) : value);
  return [bin, ...args].map(quote).join(" ");
}

function runCommand(
  bin: string,
  args: string[],
  dryRun: boolean,
  env?: Record<string, string>
): boolean {
  const display = formatCommand(bin, args);
  console.log(display);
  if (dryRun) return true;
  const result = spawnSync(bin, args, {
    stdio: "inherit",
    env: env ? { ...process.env, ...env } : process.env,
  });
  return result.status === 0;
}

function isGlobalCliInstall(paths: {
  currentExecutable: string;
  globalInstall: string | null;
  npmGlobalRoot: string | null;
}): boolean {
  if (!paths.npmGlobalRoot) return false;
  const normalizedRoot = resolve(paths.npmGlobalRoot);
  const rootWithSep = normalizedRoot.endsWith(sep) ? normalizedRoot : `${normalizedRoot}${sep}`;
  const candidates = [paths.currentExecutable, paths.globalInstall].filter(
    (value): value is string => Boolean(value)
  );

  for (const candidate of candidates) {
    const resolved = resolve(candidate);
    if (resolved === normalizedRoot || resolved.startsWith(rootWithSep)) {
      return true;
    }
    try {
      const real = realpathSync(candidate);
      const normalizedReal = resolve(real);
      if (normalizedReal === normalizedRoot || normalizedReal.startsWith(rootWithSep)) {
        return true;
      }
    } catch {
      // Ignore missing path or lack of permissions.
    }
  }

  return false;
}

function buildInstallCommand(pm: string, pkgs: string[], globalInstall: boolean): string {
  if (pm === "pnpm")
    return globalInstall ? `pnpm add -g ${pkgs.join(" ")}` : `pnpm add ${pkgs.join(" ")}`;
  if (pm === "yarn")
    return globalInstall ? `yarn global add ${pkgs.join(" ")}` : `yarn add ${pkgs.join(" ")}`;
  if (pm === "bun")
    return globalInstall ? `bun add -g ${pkgs.join(" ")}` : `bun add ${pkgs.join(" ")}`;
  return globalInstall ? `npm install -g ${pkgs.join(" ")}` : `npm install ${pkgs.join(" ")}`;
}

/**
 * Context8 MCP Server
 * A local knowledge base for storing and retrieving error solutions with semantic search
 */

function pickDeps(
  deps?: Record<string, string>,
  limit: number = 30
): Record<string, string> | undefined {
  if (!deps) return undefined;
  return Object.fromEntries(Object.entries(deps).slice(0, limit));
}

function collectEnvironmentSnapshot(): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };

  try {
    const pkgJsonPath = join(process.cwd(), "package.json");
    if (existsSync(pkgJsonPath)) {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
      snapshot.package = {
        name: pkg.name,
        version: pkg.version,
      };
      snapshot.dependencies = pickDeps(pkg.dependencies);
      snapshot.devDependencies = pickDeps(pkg.devDependencies);
    }
  } catch (error) {
    console.error("Failed to collect package metadata:", error);
  }

  return snapshot;
}

function versionIssues(env: Record<string, unknown> | undefined): { warnings: string[] } {
  const warnings: string[] = [];
  if (!env) {
    return {
      warnings: [
        "Environment snapshot missing; provide dependencies with versions to track applicability.",
      ],
    };
  }

  const deps = (env.dependencies as Record<string, string> | undefined) || {};
  const devDeps = (env.devDependencies as Record<string, string> | undefined) || {};
  const entries = Object.entries({ ...deps, ...devDeps });

  if (entries.length === 0) {
    warnings.push(
      "No dependency versions supplied (dependencies/devDependencies empty); add versioned entries if known."
    );
    return { warnings };
  }

  const badKeys: string[] = [];
  let hasVersion = false;

  for (const [name, version] of entries) {
    if (typeof version === "string" && /\d/.test(version)) {
      hasVersion = true;
    } else {
      badKeys.push(name);
    }
  }

  if (!hasVersion) {
    warnings.push(
      "Dependency versions not detected (expected values like '19.0.0' or '^2.3.1'); add version strings to improve matching."
    );
  }
  if (badKeys.length) {
    warnings.push(`Dependencies lacking numeric version: ${badKeys.join(", ")}`);
  }

  return { warnings };
}

function buildAboutText(): string {
  return [
    "Context8 is a cloud-first error solution vault for Vibe Coding agents.",
    "Store fixes with context, search fast, and share solutions with the community.",
    "Local storage is optional; remote mode is the recommended default.",
  ].join("\n");
}

function buildInstructionsText(): string {
  return [
    "Resources are read-only and safe to consume without side effects.",
    "Use tools to save, search, or delete solutions.",
    "Avoid sharing secrets: redact API keys, tokens, passwords, and personal data.",
    "Prefer concise, versioned context so solutions stay reusable.",
  ].join("\n");
}

function buildConfigSnapshot(): Record<string, unknown> {
  const saved = loadConfig();
  const envUrl = process.env.CONTEXT8_REMOTE_URL;
  const envKey = process.env.CONTEXT8_REMOTE_API_KEY;
  const resolved = resolveRemoteConfig();

  return {
    mode: resolved ? "remote" : "local",
    configPath: getConfigPath(),
    resolved: resolved ? { baseUrl: resolved.baseUrl, apiKey: maskApiKey(resolved.apiKey) } : null,
    saved: {
      remoteUrl: saved.remoteUrl ?? null,
      apiKey: maskApiKey(saved.apiKey),
    },
    env: {
      remoteUrl: envUrl ?? null,
      apiKey: maskApiKey(envKey),
    },
    recentSearch: {
      cached: recentSearchCache.length > 0,
      updatedAt: recentSearchUpdatedAt,
      count: recentSearchCache.length,
    },
  };
}

function formatRecentLines(items: SolutionSearchResult[]): string {
  return items
    .map(
      (item, index) =>
        `${index + 1}. ${item.title} | ${item.errorType} | ${item.tags.join(", ")} | ${item.createdAt} | ${item.id}`
    )
    .join("\n");
}

function buildRecentCacheSummary(limit: number): string | null {
  if (recentSearchCache.length === 0) return null;
  const slice = recentSearchCache.slice(0, limit);
  const header = recentSearchUpdatedAt
    ? `Recent search cache (${recentSearchUpdatedAt}):`
    : "Recent search cache:";
  return [header, formatRecentLines(slice)].join("\n");
}

async function buildRecentSummary(
  limit: number,
  remoteConfig: ReturnType<typeof resolveRemoteConfig>
): Promise<string> {
  const cached = buildRecentCacheSummary(limit);
  if (cached) {
    return cached;
  }

  if (remoteConfig) {
    try {
      const items = await remoteListSolutions(remoteConfig, limit, 0);
      if (items.length === 0) {
        return "No remote solutions found or remote list not supported.";
      }
      return formatRecentLines(items);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Failed to read remote solutions: ${message}`;
    }
  }

  try {
    const db = await loadLocalDbModule();
    const items = await db.listSolutions(limit, 0);
    if (items.length === 0) {
      return "No local solutions found.";
    }
    return formatRecentLines(items);
  } catch (error) {
    if (isMissingLocalDeps(error)) {
      return [
        "Local mode dependencies are missing.",
        "Run `context8-mcp setup-local` or use remote mode with CONTEXT8_REMOTE_API_KEY.",
      ].join("\n");
    }
    const message = error instanceof Error ? error.message : String(error);
    return `Failed to read local solutions: ${message}`;
  }
}

// Function to create a new server instance with all Context8 tools registered
function createServerInstance() {
  const remoteConfig = resolveRemoteConfig();

  const server = new McpServer(
    {
      name: "Context8",
      version: pkgJson.version,
    },
    {
      instructions:
        "Use this server to save and retrieve error solutions with a cloud-first workflow and optional local storage. Remote mode syncs with the community vault; local mode keeps data on-device.",
    }
  );

  server.registerResource(
    "context8-about",
    "context8://about",
    {
      title: "Context8 Overview",
      description: "Cloud-first error solution vault overview",
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: buildAboutText(),
        },
      ],
    })
  );

  server.registerResource(
    "context8-instructions",
    "context8://instructions",
    {
      title: "Context8 Instructions",
      description: "Usage, privacy, and safety guidelines",
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: buildInstructionsText(),
        },
      ],
    })
  );

  server.registerResource(
    "context8-config",
    "context8://config",
    {
      title: "Context8 Configuration",
      description: "Resolved mode and configuration snapshot (redacted)",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(buildConfigSnapshot(), null, 2),
        },
      ],
    })
  );

  server.registerResource(
    "context8-recent",
    "context8://recent",
    {
      title: "Recent Solutions",
      description: "Recent solutions (remote if configured, otherwise local)",
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: await buildRecentSummary(10, remoteConfig),
        },
      ],
    })
  );

  server.registerResource(
    "context8-recent-limit",
    new ResourceTemplate("context8://recent/{limit}", { list: undefined }),
    {
      title: "Recent Solutions (Custom Limit)",
      description: "Recent solutions with a custom limit (remote if configured)",
      mimeType: "text/plain",
    },
    async (uri, { limit }) => {
      const parsed = typeof limit === "string" ? parseInt(limit, 10) : Number(limit);
      const safeLimit =
        Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.max(parsed, 1), 50) : 10;
      return {
        contents: [
          {
            uri: uri.href,
            text: await buildRecentSummary(safeLimit, remoteConfig),
          },
        ],
      };
    }
  );

  // Register Context8 tool: save-error-solution
  server.registerTool(
    "save-error-solution",
    {
      title: "Save Error Solution",
      description: `Saves an error and its solution to the local knowledge base after resolving an issue through conversation.

Use this tool when:
- You have successfully helped the user resolve an error or bug
- The user explicitly asks to save the solution
- The conversation contains valuable debugging insights worth preserving

CRITICAL - Privacy & Abstraction Guidelines:
When recording solutions, you MUST follow these rules strictly:

1. ABSTRACT everything - Focus purely on the technical pattern, not the specific implementation
2. NO project-specific details:
   - Replace actual file paths with generic ones (e.g., 'src/components/MyComponent.tsx' → 'src/components/Component.tsx')
   - Replace actual variable/function names with generic ones (e.g., 'getUserProfile' → 'fetchData')
   - Replace actual API endpoints with placeholders (e.g., 'api.company.com/users' → 'api.example.com/resource')
   - Remove any business logic descriptions
3. NO sensitive information:
   - No API keys, tokens, passwords, or credentials
   - No internal URLs, IP addresses, or domain names
   - No database names, table names, or schema details
   - No usernames, email addresses, or personal data
   - No company names, product names, or proprietary terms
4. Use GENERIC examples:
   - If context is needed, use unrelated hypothetical scenarios
   - Example: Instead of "User authentication for banking app", use "Authentication flow for web application"
5. Focus on the TECHNICAL PATTERN:
   - What type of error occurred (technically)
   - Why it happened (root cause in technical terms)
   - How to fix it (generic solution pattern)

The goal is to create reusable knowledge that helps solve similar technical problems without exposing any project details.

Examples from your current vault (keep future entries equally abstract):
- Title: "ScenegraphLayer fails with getVertexCount and Elevation fetch blocked" | Type: runtime | Tags: deck.gl, three.js, loaders.gl, gltf, obj, elevation api, cors | Context: Vite+TS map app loading photorealistic tiles and user-uploaded 3D models | Root cause: uploaded OBJ/GLB lacked triangulated POSITION data so loaders.gl couldn't compute vertices | Solution: normalize models to non-indexed triangles with POSITION, export GLB, use object URLs (revoke old ones) and fix CORS/elevation fetch.
- Title: "Vite build fails: Loader type errors and instanceof union in deck.gl scenegraph" | Type: compile | Tags: typescript, vite, deck.gl, three.js, google-maps, build | Context: Vite TS build for deck.gl + Three app after adding search/elevation loaders | Root cause: union string|Blob|File was checked via instanceof without a guard | Solution: add a type guard for Blob/File, accept strings directly, avoid Loader.load when absent, simplify ScenegraphLayer source handling.
- Title: "Modal deploy fails from missing dependencies and image mount misuse" | Type: configuration | Tags: modal, fastapi, deployment, python, sqlalchemy | Context: Deploying FastAPI service to Modal | Root cause: legacy Mount usage and env on function plus missing deps | Solution: use Image.add_local_dir(copy=true), set env on Image, keep add_local_dir last, add psycopg2-binary/evdev deps.`,
      inputSchema: {
        title: z
          .string()
          .describe(
            "A concise, GENERIC technical title. NO project-specific names. Example: 'React Hook called outside functional component causes TypeError' (NOT 'UserProfile component useState error')"
          ),
        errorMessage: z
          .string()
          .describe(
            "The error message with sensitive paths/names REDACTED. Replace specific paths with generic ones like '/src/component.tsx'. Remove any API keys, tokens, or credentials that may appear in the error."
          ),
        errorType: z
          .enum([
            "compile",
            "runtime",
            "configuration",
            "dependency",
            "network",
            "logic",
            "performance",
            "security",
            "other",
          ])
          .describe("Category of the error"),
        context: z
          .string()
          .describe(
            "GENERIC technical context only. Use hypothetical unrelated scenarios if needed. Example: 'During build process of a React application' (NOT 'Building the checkout feature for e-commerce site')"
          ),
        rootCause: z
          .string()
          .describe(
            "Technical root cause analysis focusing on the programming concept, NOT the business logic. Explain WHY this type of error occurs in general terms."
          ),
        solution: z
          .string()
          .describe(
            "GENERIC step-by-step solution pattern. Use placeholder names like 'Component', 'fetchData', 'handleSubmit'. The solution should be applicable to any similar technical situation."
          ),
        labels: z.array(z.string()).optional().describe("Optional labels/classifications"),
        cliLibraryId: z
          .string()
          .optional()
          .describe(
            "Optional: Library id (must include version, e.g., /vercel/next.js/v15.1.8) for CLI-related errors."
          ),
        codeChanges: z
          .string()
          .optional()
          .describe(
            "ABSTRACTED code changes with generic names. Replace all specific identifiers with generic ones (MyComponent → Component, getUserData → fetchData, /api/users → /api/resource). Remove any hardcoded values, URLs, or credentials."
          ),
        tags: z
          .array(z.string())
          .describe("Tags for categorization (e.g., ['react', 'typescript', 'hooks', 'nextjs'])"),
        environment: z
          .record(z.string(), z.any())
          .optional()
          .describe(
            "Optional environment snapshot (e.g., runtime, dependencies). If omitted, the server captures basic runtime and package metadata."
          ),
        projectPath: z
          .string()
          .optional()
          .describe(
            "Optional: Generic project type only (e.g., 'react-app', 'node-api', 'nextjs-site'). Do NOT include actual file system paths or project names."
          ),
      },
    },
    async (params: {
      title: string;
      errorMessage: string;
      errorType: ErrorType;
      context: string;
      rootCause: string;
      solution: string;
      codeChanges?: string;
      tags: string[];
      labels?: string[];
      cliLibraryId?: string;
      projectPath?: string;
      environment?: Record<string, unknown>;
    }) => {
      try {
        const {
          title,
          errorMessage,
          errorType,
          context,
          rootCause,
          solution,
          codeChanges,
          tags,
          labels,
          cliLibraryId,
          projectPath,
          environment,
        } = params;

        const autoEnvironment = collectEnvironmentSnapshot();
        const mergedEnvironment = environment
          ? { ...autoEnvironment, ...environment }
          : autoEnvironment;

        const versionCheck = versionIssues(mergedEnvironment);
        if (versionCheck.warnings.length > 0) {
          console.warn(`Environment/version warnings: ${versionCheck.warnings.join(" | ")}`);
        }

        let savedSolution;
        let totalCount;
        let locationText: string;

        if (remoteConfig) {
          savedSolution = await remoteSaveSolution(remoteConfig, {
            title,
            errorMessage,
            errorType,
            context,
            rootCause,
            solution,
            codeChanges,
            tags,
            labels,
            cliLibraryId,
            projectPath,
            environment: mergedEnvironment,
          });
          totalCount = await remoteGetSolutionCount(remoteConfig);
          locationText = `Remote: ${remoteConfig.baseUrl}`;
        } else {
          const db = await loadLocalDbModule();
          savedSolution = await db.saveSolution({
            title,
            errorMessage,
            errorType,
            context,
            rootCause,
            solution,
            codeChanges,
            tags,
            labels,
            cliLibraryId,
            projectPath,
            environment: mergedEnvironment,
          });
          totalCount = await db.getSolutionCount();
          locationText = `Local DB: ${db.getDatabasePath()}`;
        }

        const warningText =
          versionCheck.warnings.length > 0
            ? `\nWarnings:\n- ${versionCheck.warnings.join("\n- ")}`
            : "";

        return {
          content: [
            {
              type: "text",
              text: `Successfully saved solution #${savedSolution.id}

Title: ${savedSolution.title}
Type: ${savedSolution.errorType}
Tags: ${savedSolution.tags.join(", ")}

Database now contains ${totalCount} solution(s).
Location: ${locationText}

You can search for this solution later using 'search-solutions' with keywords like:
- "${tags[0] || "error"}"
- "${title.split(" ").slice(0, 3).join(" ")}"${warningText}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to save solution: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
        };
      }
    }
  );

  // Register Context8 tool: search-solutions
  server.registerTool(
    "search-solutions",
    {
      title: "Search Error Solutions",
      description: `Searches the local knowledge base for previously resolved errors using semantic similarity.

Use this tool when:
- The user encounters an error that might have been solved before
- Looking for solutions related to specific technologies or error types
- Browsing the knowledge base for relevant past solutions

The search uses:
- Semantic similarity (vector embeddings) for intelligent matching
- Full-text search as fallback

Returns up to 25 matching solutions ranked by relevance with previews.
After reviewing the results, use 'batch-get-solutions' to retrieve full details for the most relevant 3-5 solutions.`,
      inputSchema: {
        query: z
          .string()
          .describe(
            "Search query - can be error message, keywords, technology names, or error types"
          ),
        limit: z
          .number()
          .optional()
          .default(25)
          .describe("Maximum number of results to return (default: 25)"),
        mode: z
          .enum(["semantic", "hybrid", "sparse"])
          .optional()
          .describe("Search mode: semantic only, sparse (keywords), or hybrid (default)"),
      },
    },
    async ({ query, limit = 25, mode }) => {
      try {
        const defaultLimitEnv = process.env.CONTEXT8_DEFAULT_LIMIT
          ? parseInt(process.env.CONTEXT8_DEFAULT_LIMIT, 10)
          : undefined;
        const effectiveLimit = limit || defaultLimitEnv || 25;

        let results;
        let totalCount;
        if (remoteConfig) {
          results = await remoteSearchSolutions(remoteConfig, query, effectiveLimit, {
            mode: mode || "hybrid",
          });
          totalCount = await remoteGetSolutionCount(remoteConfig);
        } else {
          const db = await loadLocalDbModule();
          results = await db.searchSolutions(query, effectiveLimit, {
            mode: mode || "hybrid",
          });
          totalCount = await db.getSolutionCount();
        }
        recentSearchCache = results;
        recentSearchUpdatedAt = new Date().toISOString();

        if (results.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No solutions found for "${query}".

Knowledge base contains ${totalCount} total solution(s).

Tips:
- Try different keywords
- Search by error type (compile, runtime, configuration, etc.)
- Search by technology tags (react, typescript, etc.)
- Leave query empty to see recent solutions`,
              },
            ],
          };
        }

        const formattedResults = results
          .map((r, i) => {
            const similarityStr = r.similarity
              ? ` (${(r.similarity * 100).toFixed(1)}% match)`
              : "";
            return `${i + 1}. [${r.id}] ${r.title}${similarityStr}
   Type: ${r.errorType} | Tags: ${r.tags.join(", ")}
   Preview: ${r.preview || "N/A"}`;
          })
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${results.length} solution(s) for "${query}":

${formattedResults}

Select the most relevant solutions and use 'batch-get-solutions' with their IDs to see full details.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
        };
      }
    }
  );

  // Register Context8 tool: get-solution-detail
  server.registerTool(
    "get-solution-detail",
    {
      title: "Get Solution Detail",
      description: `Retrieves the full details of a specific error solution from the knowledge base.

Use this tool after searching with 'search-solutions' to get:
- Complete error context
- Full root cause analysis
- Detailed solution steps
- Code changes made

The solution ID is returned by the search-solutions tool.`,
      inputSchema: {
        solutionId: z.string().describe("The solution ID (e.g., 'lxyz123-abc456')"),
      },
    },
    async ({ solutionId }) => {
      try {
        const solution = remoteConfig
          ? await remoteGetSolutionById(remoteConfig, solutionId)
          : await (await loadLocalDbModule()).getSolutionById(solutionId);

        if (!solution) {
          return {
            content: [
              {
                type: "text",
                text: `Solution not found with ID: ${solutionId}

Use 'search-solutions' to find available solutions.`,
              },
            ],
          };
        }

        let detailText = `# ${solution.title}

## Error Information
- **Type:** ${solution.errorType}
- **Date:** ${new Date(solution.createdAt).toLocaleString()}
- **Tags:** ${solution.tags.join(", ")}
${solution.projectPath ? `- **Project:** ${solution.projectPath}` : ""}
${solution.labels?.length ? `- **Labels:** ${solution.labels.join(", ")}` : ""}
${solution.cliLibraryId ? `- **CLI Library:** ${solution.cliLibraryId}` : ""}

## Error Message
\`\`\`
${solution.errorMessage}
\`\`\`

## Context
${solution.context}

## Root Cause
${solution.rootCause}

## Solution
${solution.solution}`;

        if (solution.codeChanges) {
          detailText += `

## Code Changes
\`\`\`
${solution.codeChanges}
\`\`\``;
        }

        return {
          content: [
            {
              type: "text",
              text: detailText,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve solution: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
        };
      }
    }
  );

  // Register Context8 tool: batch-get-solutions
  server.registerTool(
    "batch-get-solutions",
    {
      title: "Batch Get Solutions",
      description: `Retrieves full details for multiple error solutions at once.

Use this tool after 'search-solutions' to get complete information for the most relevant solutions.
Select 3-5 solution IDs from the search results based on:
- Highest similarity scores
- Most relevant titles and tags
- Best matching error types

This is more efficient than calling 'get-solution-detail' multiple times.`,
      inputSchema: {
        solutionIds: z
          .array(z.string())
          .min(1)
          .max(10)
          .describe("Array of solution IDs to retrieve (e.g., ['abc123', 'def456'])"),
      },
    },
    async ({ solutionIds }) => {
      try {
        const solutions = remoteConfig
          ? await remoteGetSolutionsByIds(remoteConfig, solutionIds)
          : await (await loadLocalDbModule()).getSolutionsByIds(solutionIds);

        if (solutions.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No solutions found for the provided IDs: ${solutionIds.join(", ")}

Use 'search-solutions' to find valid solution IDs.`,
              },
            ],
          };
        }

        const formattedSolutions = solutions
          .map((solution) => {
            let text = `# ${solution.title}

## Error Information
- **ID:** ${solution.id}
- **Type:** ${solution.errorType}
- **Date:** ${new Date(solution.createdAt).toLocaleString()}
- **Tags:** ${solution.tags.join(", ")}
${solution.projectPath ? `- **Project:** ${solution.projectPath}` : ""}
${solution.labels?.length ? `- **Labels:** ${solution.labels.join(", ")}` : ""}
${solution.cliLibraryId ? `- **CLI Library:** ${solution.cliLibraryId}` : ""}

## Error Message
\`\`\`
${solution.errorMessage}
\`\`\`

## Context
${solution.context}

## Root Cause
${solution.rootCause}

## Solution
${solution.solution}`;

            if (solution.codeChanges) {
              text += `

## Code Changes
\`\`\`
${solution.codeChanges}
\`\`\``;
            }

            return text;
          })
          .join("\n\n---\n\n");

        const notFound = solutionIds.filter((id) => !solutions.find((s) => s.id === id));
        const notFoundMsg =
          notFound.length > 0 ? `\n\nNote: Solutions not found: ${notFound.join(", ")}` : "";

        return {
          content: [
            {
              type: "text",
              text: `Retrieved ${solutions.length} solution(s):

${formattedSolutions}${notFoundMsg}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve solutions: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
        };
      }
    }
  );

  // Register Context8 tool: delete-solution
  server.registerTool(
    "delete-solution",
    {
      title: "Delete Solution",
      description: `Deletes a solution from the knowledge base by ID.

Use this tool when:
- A record is obsolete or duplicated
- You need to remove an entry for privacy reasons

The deletion also removes the sparse index and stats so the DB stays consistent.`,
      inputSchema: {
        id: z.string().describe("Solution ID to delete (e.g., 'abc123-xyz')"),
      },
    },
    async ({ id }) => {
      try {
        const deleted = remoteConfig
          ? await remoteDeleteSolution(remoteConfig, id)
          : await (await loadLocalDbModule()).deleteSolution(id);

        if (!deleted) {
          return {
            content: [
              {
                type: "text",
                text: `Solution not found: ${id}`,
              },
            ],
          };
        }

        const remaining = remoteConfig
          ? await remoteGetSolutionCount(remoteConfig)
          : await (await loadLocalDbModule()).getSolutionCount();

        return {
          content: [
            {
              type: "text",
              text: `Deleted solution ${id}. Remaining solutions: ${remaining}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to delete solution: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
        };
      }
    }
  );

  return server;
}

async function main() {
  if (process.argv.length > 2) {
    try {
      await runCli(process.argv);
    } catch (error) {
      if (isMissingLocalDeps(error)) {
        printLocalDepHelp();
        process.exit(1);
        return;
      }
      throw error;
    }
    return;
  }

  const resolved = resolveRemoteConfig();
  const server = createServerInstance();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Context8 MCP Server running on stdio");
  if (resolved) {
    console.error(`Mode: remote (${resolved.baseUrl})`);
    try {
      console.error(`Total solutions: ${await remoteGetSolutionCount(resolved)}`);
    } catch (error) {
      console.error(
        `Failed to query remote count: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } else {
    try {
      const db = await loadLocalDbModule();
      console.error(`Database location: ${db.getDatabasePath()}`);
      console.error(`Total solutions: ${await db.getSolutionCount()}`);
    } catch (error) {
      console.error(
        `Local DB unavailable: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

main().catch((error) => {
  if (isMissingLocalDeps(error)) {
    printLocalDepHelp();
    process.exit(1);
    return;
  }
  console.error("Fatal error in main():", error);
  process.exit(1);
});

async function runCli(argv: string[]) {
  const program = new Command();
  program
    .name("context8-mcp")
    .description("CLI utilities for Context8 MCP")
    .version(pkgJson.version, "-v, --version", "Display version number");

  program
    .command("list")
    .description("List recent solutions")
    .option("-l, --limit <number>", "Number of items", (v) => parseInt(v, 10), 20)
    .option("-o, --offset <number>", "Offset for pagination", (v) => parseInt(v, 10), 0)
    .action(async (opts) => {
      try {
        const db = await loadLocalDbModule();
        const items = await db.listSolutions(opts.limit, opts.offset);
        if (items.length === 0) {
          console.log("No solutions found.");
          return;
        }
        for (const item of items) {
          console.log(
            `${item.id} | ${item.createdAt} | ${item.errorType} | ${item.tags.join(", ")} | ${item.title}`
          );
        }
      } catch (error) {
        if (isMissingLocalDeps(error)) {
          printLocalDepHelp();
        } else {
          console.error(error instanceof Error ? error.message : String(error));
        }
        process.exit(1);
      }
    });

  program
    .command("search")
    .description("Search solutions (local or remote if configured)")
    .argument("<query>", "Search query (non-empty)")
    .option("-l, --limit <number>", "Number of items", (v) => parseInt(v, 10), 5)
    .option("--mode <mode>", "semantic | hybrid | sparse", "hybrid")
    .action(async (query, opts) => {
      try {
        const resolvedRemote = resolveRemoteConfig();
        const results = resolvedRemote
          ? await remoteSearchSolutions(resolvedRemote, query, opts.limit, { mode: opts.mode })
          : await (
              await loadLocalDbModule()
            ).searchSolutions(query, opts.limit, { mode: opts.mode });
        if (results.length === 0) {
          console.log("No results.");
          return;
        }
        for (const r of results) {
          const sim = r.similarity !== undefined ? ` sim=${(r.similarity * 100).toFixed(1)}%` : "";
          const score = r.score !== undefined ? ` score=${r.score.toFixed(3)}` : "";
          console.log(
            `[${r.id}] ${r.title} | type=${r.errorType} | tags=${r.tags.join(", ")}${sim}${score}`
          );
          if (r.preview) {
            console.log(`  preview: ${r.preview}`);
          }
        }
      } catch (err) {
        const resolvedRemote = resolveRemoteConfig();
        if (resolvedRemote) {
          console.error(
            `Remote search failed: ${err instanceof Error ? err.message : String(err)}. ` +
              "Check network/connectivity/API key, or clear remote config with `context8-mcp remote-config --clear` to use local mode."
          );
        } else if (isMissingLocalDeps(err)) {
          printLocalDepHelp();
        } else {
          console.error(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        process.exit(1);
      }
    });

  program
    .command("delete")
    .description("Delete a solution by ID")
    .argument("<id>", "Solution ID")
    .action(async (id) => {
      try {
        const db = await loadLocalDbModule();
        const ok = await db.deleteSolution(id);
        if (ok) {
          console.log(`Deleted solution ${id}`);
        } else {
          console.error(`Solution not found: ${id}`);
          process.exitCode = 1;
        }
      } catch (error) {
        if (isMissingLocalDeps(error)) {
          printLocalDepHelp();
        } else {
          console.error(error instanceof Error ? error.message : String(error));
        }
        process.exit(1);
      }
    });

  program
    .command("remote-config")
    .description(
      "Set or view remote Context8 server configuration (URL/API key). Use https://api.context8.org (no trailing slash). API keys must be created via /apikeys on context8.org with an email-verified user."
    )
    .option("--remote-url <url>", "Remote Context8 server base URL to save")
    .option("--api-key <key>", "API key for the remote server")
    .option("--show", "Show saved configuration")
    .option("--clear", "Clear saved remote configuration file")
    .action((opts) => {
      if (opts.clear) {
        clearConfig();
        console.log(`Cleared saved remote configuration at ${getConfigPath()}`);
        return;
      }

      if (opts.remoteUrl || opts.apiKey) {
        const update: Partial<{ remoteUrl: string; apiKey: string }> = {};
        if (typeof opts.remoteUrl === "string") update.remoteUrl = opts.remoteUrl;
        if (typeof opts.apiKey === "string") update.apiKey = opts.apiKey;

        const updated = saveConfig(update);
        console.log(`Saved remote configuration to ${getConfigPath()}`);
        console.log(`Remote URL: ${updated.remoteUrl ?? "(not set)"}`);
        console.log(`API key: ${updated.apiKey ? maskApiKey(updated.apiKey) : "(not set)"}`);
        console.log("Note: Environment variables override the saved config if set.");
        return;
      }

      const current = loadConfig();
      const envUrl = process.env.CONTEXT8_REMOTE_URL;
      const envKey = process.env.CONTEXT8_REMOTE_API_KEY;
      const resolved = resolveRemoteConfig();
      console.log(`Config file: ${getConfigPath()}`);
      console.log(
        `Saved URL: ${current.remoteUrl ?? "(not set)"} | Saved key: ${current.apiKey ? maskApiKey(current.apiKey) : "(not set)"}`
      );
      console.log(
        `Env URL: ${envUrl ?? "(not set)"} | Env key: ${envKey ? maskApiKey(envKey) : "(not set)"}`
      );
      console.log(
        `Resolved (flag/env/config): ${describeRemoteSource(resolved?.baseUrl, resolved?.apiKey)}`
      );
      console.log(
        "Precedence: flag > env > saved config. Set values with --remote-url/--api-key or clear with --clear."
      );
    });

  program
    .command("diagnose")
    .description(
      "Check whether Context8 is running in remote or local mode and validate connectivity"
    )
    .option("--remote-url <url>", "Remote server base URL (overrides env/config)")
    .option("--api-key <key>", "API key for remote server (overrides env/config)")
    .action(async (opts) => {
      // Display installation paths
      const paths = getInstallationPaths();
      console.log("=== Installation Paths ===");
      console.log(`Version: ${pkgJson.version}`);
      console.log(`Current executable: ${paths.currentExecutable}`);
      console.log();

      // Show ready-to-use config snippets
      if (paths.globalInstall) {
        console.log("--- For MCP Clients (Recommended) ---");
        console.log("JSON format (Cursor, VS Code, etc.):");
        console.log('  "command": "context8-mcp",');
        console.log('  "args": []');
        console.log();
        console.log("TOML format (OpenAI Codex):");
        console.log('  command = "context8-mcp"');
        console.log("  args = []");
        console.log();
      }

      if (paths.npmGlobalRoot && existsSync(paths.npmGlobalRoot)) {
        const distIndex = join(paths.npmGlobalRoot, "dist", "index.js");
        if (existsSync(distIndex)) {
          console.log("--- Alternative: Direct Node Path ---");
          console.log("JSON format:");
          console.log('  "command": "node",');
          console.log(`  "args": ["${distIndex}"]`);
          console.log();
          console.log("TOML format:");
          console.log('  command = "node"');
          console.log(`  args = ["${distIndex}"]`);
          console.log();
        }
      }

      console.log("=== Mode & Connectivity ===");

      const remote = resolveRemoteConfig(opts.remoteUrl, opts.apiKey);
      if (remote) {
        try {
          console.log(describeRemoteSource(remote.baseUrl, remote.apiKey));
          const total = await remoteGetSolutionCount(remote);
          console.log(`Mode: remote (reachable) | Solutions: ${total}`);
          process.exit(0);
        } catch (error) {
          console.error(
            `Mode: remote (unreachable) | Error: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          process.exit(1);
        }
        return; // unreachable but explicit
      }

      try {
        const db = await loadLocalDbModule();
        const total = await db.getSolutionCount();
        console.log(`Mode: local | DB: ${db.getDatabasePath()} | Solutions: ${total}`);
        process.exit(0);
      } catch (error) {
        console.error(
          `Mode: local (error reading DB) | Error: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        process.exit(1);
      }
    });

  program
    .command("setup-local")
    .description("Install optional local dependencies (better-sqlite3, @xenova/transformers)")
    .option("--package-manager <pm>", "Package manager to use (npm|pnpm|yarn|bun)", "npm")
    .action(async (opts) => {
      const pm = typeof opts.packageManager === "string" ? opts.packageManager : "npm";
      const pkgs = ["better-sqlite3", "@xenova/transformers"];
      const paths = getInstallationPaths();
      const globalInstall = isGlobalCliInstall(paths);
      const cmd = buildInstallCommand(pm, pkgs, globalInstall);

      console.log(`Installing local deps with: ${cmd}`);
      if (globalInstall) {
        console.log("Detected global CLI install; installing dependencies globally.");
      }
      try {
        execSync(cmd, { stdio: "inherit" });
        console.log("Local dependencies installed. You can now run in local mode.");
      } catch (error) {
        console.error(
          `Installation failed. Try manual install: ${cmd}\n${
            error instanceof Error ? error.message : String(error)
          }`
        );
        process.exitCode = 1;
      }
    });

  program
    .command("setup-clients")
    .description("Install Context8 MCP into supported clients via their CLI commands")
    .option("--mode <mode>", "remote | local (default: remote)", "remote")
    .option(
      "--api-key <key>",
      "API key for remote mode (defaults to CONTEXT8_REMOTE_API_KEY or saved config)"
    )
    .option("--scope <scope>", "Claude scope: local | user | project", "local")
    .option("--clients <names>", "Comma-separated client list (codex,claude)")
    .option("--dry-run", "Print commands without executing")
    .action(async (opts) => {
      const mode = opts.mode === "local" ? "local" : "remote";
      const resolvedRemote = resolveRemoteConfig();
      const apiKey =
        opts.apiKey || process.env.CONTEXT8_REMOTE_API_KEY || resolvedRemote?.apiKey || undefined;
      if (mode === "remote" && !apiKey) {
        console.error(
          "Remote mode requires an API key. Set --api-key, CONTEXT8_REMOTE_API_KEY, or save one via `context8-mcp remote-config`."
        );
        process.exitCode = 1;
        return;
      }

      const requested =
        typeof opts.clients === "string" && opts.clients.length > 0
          ? opts.clients
              .split(",")
              .map((c: string) => c.trim().toLowerCase())
              .filter(Boolean)
          : null;

      const targets = [
        {
          name: "codex",
          bin: "codex",
          build: () => {
            if (mode === "remote") {
              return {
                args: [
                  "mcp",
                  "add",
                  "context8",
                  "--env",
                  `CONTEXT8_REMOTE_API_KEY=${apiKey}`,
                  "--",
                  "npx",
                  "-y",
                  "context8-mcp",
                ],
              };
            }
            return {
              args: ["mcp", "add", "context8", "--", "context8-mcp"],
            };
          },
        },
        {
          name: "claude",
          bin: "claude",
          build: () => {
            const scope = typeof opts.scope === "string" ? opts.scope : "local";
            if (mode === "remote") {
              return {
                args: [
                  "mcp",
                  "add",
                  "--scope",
                  scope,
                  "-e",
                  `CONTEXT8_REMOTE_API_KEY=${apiKey}`,
                  "context8",
                  "--",
                  "npx",
                  "-y",
                  "context8-mcp",
                ],
              };
            }
            return {
              args: ["mcp", "add", "--scope", scope, "context8", "--", "context8-mcp"],
            };
          },
        },
        {
          name: "goose",
          bin: "goose",
          build: () => {
            if (mode === "remote") {
              return {
                args: ["mcp", "add", "context8", "npx", "-y", "context8-mcp"],
                env: apiKey ? { CONTEXT8_REMOTE_API_KEY: apiKey } : undefined,
                note: "Goose does not expose an MCP env flag; ensure CONTEXT8_REMOTE_API_KEY is set in your shell if remote mode does not persist.",
              };
            }
            return {
              args: ["mcp", "add", "context8", "npx", "-y", "context8-mcp"],
            };
          },
        },
        {
          name: "amp",
          bin: "amp",
          build: () => {
            if (mode === "remote") {
              return {
                args: ["mcp", "add", "context8", "npx", "-y", "context8-mcp"],
                env: apiKey ? { CONTEXT8_REMOTE_API_KEY: apiKey } : undefined,
                note: "Amp does not expose an MCP env flag; ensure CONTEXT8_REMOTE_API_KEY is set in your shell if remote mode does not persist.",
              };
            }
            return {
              args: ["mcp", "add", "context8", "npx", "-y", "context8-mcp"],
            };
          },
        },
      ];

      const results = {
        installed: 0,
        skipped: 0,
        failed: 0,
      };

      for (const target of targets) {
        if (requested && !requested.includes(target.name)) {
          continue;
        }
        const resolved = resolveCliPath(target.bin);
        if (!resolved) {
          console.log(`Skipping ${target.name}: command not found.`);
          results.skipped += 1;
          continue;
        }
        console.log(`Installing into ${target.name}:`);
        const { args, env, note } = target.build();
        if (note) {
          console.log(note);
        }
        const ok = runCommand(resolved, args, Boolean(opts.dryRun), env);
        if (ok) {
          results.installed += 1;
        } else {
          results.failed += 1;
        }
      }

      console.log(
        `Done. installed=${results.installed}, skipped=${results.skipped}, failed=${results.failed}.`
      );
      if (results.failed > 0) {
        process.exitCode = 1;
      }
    });

  program
    .command("push-remote")
    .description("Upload all local solutions to a remote Context8 server")
    .option("--remote-url <url>", "Remote server base URL (overrides env/config)")
    .option("--api-key <key>", "API key for remote server (overrides env/config)")
    .option("--dry-run", "List what would be uploaded without sending")
    .option("--yes", "Skip confirmation prompt")
    .option("--continue-on-error", "Do not abort on first failure")
    .option(
      "--concurrency <number>",
      "Max concurrent uploads (default 4)",
      (v) => parseInt(v, 10),
      4
    )
    .option("--force", "Ignore dedupe map and push duplicates")
    .option("--timeout <ms>", "Per-request timeout in milliseconds", (v) => parseInt(v, 10), 10000)
    .action(async (opts) => {
      const remote = resolveRemoteConfig(opts.remoteUrl, opts.apiKey);
      if (!remote) {
        console.error(
          "Remote URL is required. Set via --remote-url, CONTEXT8_REMOTE_URL, or `context8-mcp remote-config`."
        );
        process.exitCode = 1;
        return;
      }
      const timeoutMs = Number.isFinite(opts.timeout) && opts.timeout > 0 ? opts.timeout : 10000;
      process.env.CONTEXT8_REQUEST_TIMEOUT = String(timeoutMs);

      const db = await loadLocalDbModule();
      const items = await db.getAllSolutions();
      if (items.length === 0) {
        console.log("No local solutions found to push.");
        return;
      }

      console.log(describeRemoteSource(remote.baseUrl, remote.apiKey));

      const syncMap = loadSyncMap();
      const toSend = items.map((item) => {
        const { id: _id, createdAt: _createdAt, ...payload } = item;
        const hash = hashSolution({
          title: payload.title,
          errorMessage: payload.errorMessage,
          rootCause: payload.rootCause,
          solution: payload.solution,
          tags: payload.tags,
        });
        return { payload, hash, localId: item.id, createdAt: item.createdAt };
      });

      if (opts.dryRun) {
        toSend.forEach((item) => {
          const status = !opts.force && syncMap[item.hash] ? "[skip-duplicate]" : "[push]";
          console.log(`${status} ${item.localId} | ${item.createdAt} | ${item.payload.title}`);
        });
        console.log(
          `Would push ${toSend.length} solution(s) to ${remote.baseUrl}${opts.force ? "" : " (skipping known duplicates)"}`
        );
        return;
      }

      if (!opts.yes) {
        console.log(
          `Found ${toSend.length} solution(s). Use --yes to push, or --dry-run to preview. Aborting.`
        );
        return;
      }

      const concurrency =
        Number.isFinite(opts.concurrency) && opts.concurrency > 0 ? opts.concurrency : 4;
      let success = 0;
      let skipped = 0;
      let failed = 0;
      let index = 0;
      const updatedMap: Record<string, string> = { ...syncMap };
      let abort = false;

      const worker = async () => {
        while (true) {
          if (abort) return;
          const current = index;
          if (current >= toSend.length) return;
          index += 1;
          const item = toSend[current];
          if (!opts.force && updatedMap[item.hash]) {
            skipped += 1;
            continue;
          }
          try {
            const remoteResp = await remoteSaveSolution(remote, item.payload);
            updatedMap[item.hash] = remoteResp.id;
            success += 1;
            console.log(
              `[${success + skipped + failed}/${toSend.length}] pushed ${item.localId} -> ${remoteResp.id}`
            );
          } catch (error) {
            failed += 1;
            console.error(
              `[${success + skipped + failed}/${toSend.length}] failed ${item.localId}: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            if (!opts.continueOnError) {
              abort = true;
              return;
            }
          }
        }
      };

      const workers = Array.from({ length: concurrency }, () => worker());
      await Promise.all(workers);

      if (success > 0) {
        saveSyncMap(updatedMap);
      }

      console.log(
        `Done. pushed=${success}, skipped=${skipped}, failed=${failed}, target=${remote.baseUrl}${
          remote.apiKey ? " (API key provided)" : ""
        }.`
      );
      if (failed > 0) {
        process.exitCode = 1;
      }
    });

  program
    .command("update")
    .description("Check for a newer published version and install it (npm -g)")
    .option("-p, --package <name>", "Package name", pkgJson.name)
    .action(async (opts) => {
      try {
        const db = await loadLocalDbModule();
        try {
          db.migrateDatabase();
          console.log("DB migration check: schema/index ensured.");
        } catch (err) {
          console.warn(
            `DB migration step failed: ${err instanceof Error ? err.message : "unknown error"}`
          );
        }

        try {
          const health = await db.checkDatabaseHealth();
          if (health.ok) {
            console.log(
              `DB OK at ${health.path} (${health.count ?? 0} record${(health.count ?? 0) === 1 ? "" : "s"})`
            );
          } else {
            console.warn(
              `DB check reported issues at ${health.path}: ${health.message}${
                health.issues ? ` [${health.issues.join(", ")}]` : ""
              }`
            );
          }
        } catch (err) {
          console.warn(`DB check failed: ${err instanceof Error ? err.message : "unknown error"}`);
        }
      } catch (err) {
        console.warn(
          `Local DB unavailable (optional deps missing or not installed): ${
            err instanceof Error ? err.message : "unknown error"
          }`
        );
      }

      const pkgName = opts.package as string;
      try {
        const latest = execSync(`npm view ${pkgName} version`, {
          stdio: ["ignore", "pipe", "ignore"],
        })
          .toString()
          .trim();
        if (!latest) {
          console.log("Unable to determine latest version.");
          return;
        }
        if (latest === pkgJson.version) {
          console.log(`Already at latest version (${latest}).`);
          return;
        }
        console.log(`Updating ${pkgName} from ${pkgJson.version} to ${latest}...`);
        execSync(`npm install -g ${pkgName}@${latest}`, { stdio: "inherit" });
        console.log("Update complete.");
      } catch (error) {
        console.error("Update failed:", error instanceof Error ? error.message : error);
        process.exitCode = 1;
      }
    });

  await program.parseAsync(argv);
}
