#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { Command } from "commander";
import { ErrorType } from "./lib/types.js";
import {
  saveSolution,
  searchSolutions,
  getSolutionById,
  getSolutionsByIds,
  getSolutionCount,
  getDatabasePath,
  listSolutions,
  deleteSolution,
  checkDatabaseHealth,
} from "./lib/database.js";
import {
  getCachedContext7Doc,
  setCachedContext7Doc,
  getContext7CachePath,
} from "./lib/context7Cache.js";
import {
  remoteSaveSolution,
  remoteSearchSolutions,
  remoteGetSolutionCount,
  remoteGetSolutionById,
  remoteGetSolutionsByIds,
  remoteDeleteSolution,
  RemoteConfig,
} from "./lib/remoteClient.js";

const pkgJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

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

function hasVersionInfo(env: Record<string, unknown> | undefined): boolean {
  if (!env) return false;
  const deps = env.dependencies as Record<string, string> | undefined;
  const devDeps = env.devDependencies as Record<string, string> | undefined;
  const values = [...(deps ? Object.values(deps) : []), ...(devDeps ? Object.values(devDeps) : [])];
  return values.some((v) => typeof v === "string" && /\d/.test(v));
}

// Function to create a new server instance with all ErrorSolver tools registered
function createServerInstance() {
  const remoteConfig: RemoteConfig | null =
    process.env.CONTEXT8_REMOTE_URL && process.env.CONTEXT8_REMOTE_API_KEY
      ? {
          baseUrl: process.env.CONTEXT8_REMOTE_URL,
          apiKey: process.env.CONTEXT8_REMOTE_API_KEY,
        }
      : process.env.CONTEXT8_REMOTE_URL
        ? { baseUrl: process.env.CONTEXT8_REMOTE_URL }
        : null;

  const server = new McpServer(
    {
      name: "Context8",
      version: pkgJson.version,
    },
    {
      instructions:
        "Use this server to save and retrieve error solutions from your local knowledge base. All solutions are stored locally with privacy-first design and semantic search capabilities. When using Context7 passthrough (context7-cached-docs), ALWAYS include a versioned library id (format: /org/project/version)."
    }
  );

  // Register ErrorSolver tool: save-error-solution
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

The goal is to create reusable knowledge that helps solve similar technical problems without exposing any project details.`,
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
            "Optional: Context7 library id (must include version, e.g., /vercel/next.js/v15.1.8) for CLI-related errors; auto-fetches help into the record."
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

        if (!hasVersionInfo(mergedEnvironment)) {
          throw new Error(
            "Save aborted: missing library version info. Please include dependency versions (e.g., react, react-dom, typescript) and retry."
          );
        }

        let cliNotes: string | undefined;
        if (cliLibraryId) {
          try {
            cliNotes = await callContext7Tool(
              "get-library-docs",
              {
                context7CompatibleLibraryID: cliLibraryId,
                topic: "cli",
                page: 1,
              },
              process.env.CONTEXT7_API_KEY
            );
          } catch (err) {
            cliNotes = `Context7 CLI help fetch failed: ${
              err instanceof Error ? err.message : "unknown error"
            }`;
          }
        }

        const savedSolution = remoteConfig
          ? await remoteSaveSolution(remoteConfig, {
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
              cliNotes,
              projectPath,
              environment: mergedEnvironment,
            })
          : await saveSolution({
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
              cliNotes,
              projectPath,
              environment: mergedEnvironment,
            });

        const totalCount = remoteConfig
          ? await remoteGetSolutionCount(remoteConfig)
          : await getSolutionCount();

        return {
          content: [
            {
              type: "text",
              text: `Successfully saved solution #${savedSolution.id}

Title: ${savedSolution.title}
Type: ${savedSolution.errorType}
Tags: ${savedSolution.tags.join(", ")}

Database now contains ${totalCount} solution(s).
Location: ${getDatabasePath()}

You can search for this solution later using 'search-solutions' with keywords like:
- "${tags[0] || "error"}"
- "${title.split(" ").slice(0, 3).join(" ")}"`,
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

  // Register ErrorSolver tool: search-solutions
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

        const results = remoteConfig
          ? await remoteSearchSolutions(remoteConfig, query, effectiveLimit, {
              mode: mode || "hybrid",
            })
          : await searchSolutions(query, effectiveLimit, {
              mode: mode || "hybrid",
            });
        const totalCount = remoteConfig
          ? await remoteGetSolutionCount(remoteConfig)
          : await getSolutionCount();

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

  // Register ErrorSolver tool: get-solution-detail
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
          : await getSolutionById(solutionId);

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

  // Register ErrorSolver tool: batch-get-solutions
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
          : await getSolutionsByIds(solutionIds);

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

  // Register ErrorSolver tool: delete-solution
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
          : await deleteSolution(id);

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
          : await getSolutionCount();

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

  // Register Context7 cached docs fetcher
  server.registerTool(
    "context7-cached-docs",
    {
      title: "Context7 Cached Docs",
      description: `Fetch Context7 library docs with local caching. Checks the local cache first; on miss, calls Context7 and stores the result for reuse.

Requirements:
- Always provide a VERSIONED library id: format '/org/project/version' (avoid bare '/org/project').
- Recommended: Context7 API key via env CONTEXT7_API_KEY or input.

Examples:
- /vercel/next.js/v15.1.8 with topic='routing', page=1
- /facebook/react/v19.0.0 with topic='hooks', page=1
- /supabase/supabase-js/v2.45.4 with topic='auth', page=2`,
      inputSchema: {
        context7ApiKey: z.string().optional().describe("Context7 API key (optional if set in env)"),
        libraryId: z.string().describe("Context7-compatible library ID (e.g., /vercel/next.js)"),
        topic: z.string().optional().describe("Docs topic (optional)"),
        page: z.number().int().min(1).max(10).optional().describe("Page number (default 1)"),
        forceRefresh: z.boolean().optional().describe("If true, bypass cache and refresh"),
      },
    },
    async ({ context7ApiKey, libraryId, topic, page = 1, forceRefresh = false }) => {
      const apiKey = context7ApiKey || process.env.CONTEXT7_API_KEY;

      try {
        if (!forceRefresh) {
          const cached = await getCachedContext7Doc(libraryId, topic, page);
          if (cached) {
            return {
              content: [
                { type: "text", text: cached },
                {
                  type: "text",
                  text: `(served from cache at ${getContext7CachePath()})`,
                },
              ],
            };
          }
        }

        const fetched = await callContext7Tool(
          "get-library-docs",
          {
            context7CompatibleLibraryID: libraryId,
            topic,
            page,
          },
          apiKey
        );

        await setCachedContext7Doc(libraryId, topic, page, fetched);

        return {
          content: [
            { type: "text", text: fetched },
            {
              type: "text",
              text: `(cached at ${getContext7CachePath()})`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Context7 fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
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
    await runCli(process.argv);
    return;
  }

  const server = createServerInstance();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Context8 MCP Server running on stdio");
  console.error(`Database location: ${getDatabasePath()}`);
  console.error(`Total solutions: ${await getSolutionCount()}`);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

async function runCli(argv: string[]) {
  const program = new Command();
  program.name("context8-mcp").description("CLI utilities for Context8 MCP");

  program
    .command("list")
    .description("List recent solutions")
    .option("-l, --limit <number>", "Number of items", (v) => parseInt(v, 10), 20)
    .option("-o, --offset <number>", "Offset for pagination", (v) => parseInt(v, 10), 0)
    .action(async (opts) => {
      const items = await listSolutions(opts.limit, opts.offset);
      if (items.length === 0) {
        console.log("No solutions found.");
        return;
      }
      for (const item of items) {
        console.log(
          `${item.id} | ${item.createdAt} | ${item.errorType} | ${item.tags.join(", ")} | ${item.title}`
        );
      }
    });

  program
    .command("delete")
    .description("Delete a solution by ID")
    .argument("<id>", "Solution ID")
    .action(async (id) => {
      const ok = await deleteSolution(id);
      if (ok) {
        console.log(`Deleted solution ${id}`);
      } else {
        console.error(`Solution not found: ${id}`);
        process.exitCode = 1;
      }
    });

  program
    .command("update")
    .description("Check for a newer published version and install it (npm -g)")
    .option("-p, --package <name>", "Package name", pkgJson.name)
    .action(async (opts) => {
      try {
        const health = await checkDatabaseHealth();
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

async function callContext7Tool(
  name: "get-library-docs",
  args: Record<string, unknown>,
  apiKey: string | undefined,
  endpoint = "https://mcp.context7.com/mcp"
): Promise<string> {
  const resolvedEndpoint = process.env.CONTEXT7_ENDPOINT || endpoint;

  const body = {
    jsonrpc: "2.0",
    id: "1",
    method: "tools/call",
    params: {
      name,
      arguments: args,
    },
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const res = await fetch(resolvedEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Context7 request failed with status ${res.status}`);
  }

  const json = (await res.json()) as any;
  if (json.error) {
    throw new Error(json.error?.message || "Context7 returned an error");
  }

  const text =
    json.result?.content?.find((c: any) => c.type === "text")?.text ??
    json.result?.content?.[0]?.text;

  if (!text) {
    throw new Error("Context7 response did not include text content");
  }

  return text as string;
}
