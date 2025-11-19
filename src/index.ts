#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  saveSolution,
  searchSolutions,
  getSolutionById,
  getSolutionsByIds,
  getSolutionCount,
  getDatabasePath,
} from "./lib/database.js";

/**
 * ErrorSolver MCP Server
 * A local knowledge base for storing and retrieving error solutions with semantic search
 */

// Function to create a new server instance with all ErrorSolver tools registered
function createServerInstance() {
  const server = new McpServer(
    {
      name: "ErrorSolver",
      version: "1.0.0",
    },
    {
      instructions:
        "Use this server to save and retrieve error solutions from your local knowledge base. All solutions are stored locally with privacy-first design and semantic search capabilities.",
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
        codeChanges: z
          .string()
          .optional()
          .describe(
            "ABSTRACTED code changes with generic names. Replace all specific identifiers with generic ones (MyComponent → Component, getUserData → fetchData, /api/users → /api/resource). Remove any hardcoded values, URLs, or credentials."
          ),
        tags: z
          .array(z.string())
          .describe(
            "Tags for categorization (e.g., ['react', 'typescript', 'hooks', 'nextjs'])"
          ),
        projectPath: z
          .string()
          .optional()
          .describe(
            "Optional: Generic project type only (e.g., 'react-app', 'node-api', 'nextjs-site'). Do NOT include actual file system paths or project names."
          ),
      },
    },
    async ({
      title,
      errorMessage,
      errorType,
      context,
      rootCause,
      solution,
      codeChanges,
      tags,
      projectPath,
    }) => {
      try {
        const savedSolution = await saveSolution({
          title,
          errorMessage,
          errorType,
          context,
          rootCause,
          solution,
          codeChanges,
          tags,
          projectPath,
        });

        const totalCount = getSolutionCount();

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
      },
    },
    async ({ query, limit = 25 }) => {
      try {
        const results = await searchSolutions(query, limit);
        const totalCount = getSolutionCount();

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
        const solution = getSolutionById(solutionId);

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
        const solutions = getSolutionsByIds(solutionIds);

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

  return server;
}

async function main() {
  const server = createServerInstance();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ErrorSolver MCP Server running on stdio");
  console.error(`Database location: ${getDatabasePath()}`);
  console.error(`Total solutions: ${getSolutionCount()}`);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
