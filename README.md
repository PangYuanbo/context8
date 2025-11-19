# ErrorSolver MCP Server

A Model Context Protocol (MCP) server for building and managing a local knowledge base of error solutions with semantic search capabilities.

## Overview

ErrorSolver helps developers maintain a personal knowledge base of debugging solutions. When you encounter and solve errors, save them to your local database for future reference. The semantic search feature intelligently matches your queries to previously solved problems, even when the wording differs.

## Features

- **🔒 Privacy-First Design**: All data stored locally on your machine
- **🧠 Semantic Search**: AI-powered similarity matching using local embeddings
- **📦 SQLite Database**: Lightweight, fast, and reliable storage
- **🏷️ Tagging System**: Organize solutions by technology, error type, and custom tags
- **🔍 Full-Text Search**: Fallback search when semantic search isn't available
- **📝 Rich Metadata**: Store error messages, context, root causes, solutions, and code changes

## Installation

```bash
cd context8
npm install
npm run build
```

## Usage with Claude Code

Add to your MCP settings file:

### Windows
`%APPDATA%\Claude\claude_desktop_config.json`

### macOS/Linux
`~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "errorsolver": {
      "command": "node",
      "args": ["/absolute/path/to/context8/dist/index.js"]
    }
  }
}
```

## Available MCP Tools

### 1. `save-error-solution`

Save an error and its solution to your local knowledge base.

**Parameters:**
- `title` (string): Generic technical title
- `errorMessage` (string): The error message (redacted)
- `errorType` (enum): Type of error (compile, runtime, configuration, etc.)
- `context` (string): Generic technical context
- `rootCause` (string): Technical root cause analysis
- `solution` (string): Generic step-by-step solution
- `codeChanges` (string, optional): Abstracted code changes
- `tags` (string[]): Technology tags
- `projectPath` (string, optional): Generic project type

**Privacy Guidelines:**
- ❌ No project-specific file paths, variable names, or API endpoints
- ❌ No sensitive information (keys, tokens, passwords, URLs)
- ❌ No business logic or proprietary details
- ✅ Focus on generic technical patterns
- ✅ Use placeholder names and hypothetical scenarios

**Example:**
```typescript
{
  title: "React Hook called outside functional component causes TypeError",
  errorMessage: "TypeError: Cannot read property 'useState' of null",
  errorType: "runtime",
  context: "During rendering of a React component in a Next.js application",
  rootCause: "React hooks can only be called inside functional components or custom hooks. The error occurs when trying to use a hook in a class component or outside the component tree.",
  solution: "1. Ensure the hook is called inside a functional component\n2. Check that the component file exports a functional component\n3. Verify React version supports hooks (16.8+)",
  codeChanges: "// Before\nclass Component extends React.Component {\n  const [state] = useState(0);\n}\n\n// After\nfunction Component() {\n  const [state, setState] = useState(0);\n}",
  tags: ["react", "hooks", "typescript", "nextjs"],
  projectPath: "nextjs-app"
}
```

### 2. `search-solutions`

Search your knowledge base using semantic similarity or full-text search.

**Parameters:**
- `query` (string): Search query (error message, keywords, or technology names)
- `limit` (number, optional): Maximum results (default: 25)

**Returns:**
- List of matching solutions with similarity scores
- Preview of error message and context
- Solution IDs for detailed retrieval

**Example:**
```typescript
{
  query: "react hook error useState",
  limit: 10
}
```

### 3. `get-solution-detail`

Retrieve full details of a specific solution by ID.

**Parameters:**
- `solutionId` (string): Solution ID from search results

**Returns:**
- Complete solution with all fields
- Error message, context, root cause, solution steps
- Code changes if available

### 4. `batch-get-solutions`

Retrieve multiple solutions at once (more efficient than individual requests).

**Parameters:**
- `solutionIds` (string[]): Array of solution IDs (1-10)

**Returns:**
- Full details for all requested solutions
- Missing solution notifications

**Example:**
```typescript
{
  solutionIds: ["abc123-def456", "xyz789-uvw012", "pqr345-stu678"]
}
```

## Database Location

Solutions are stored in: `~/.errorsolver/solutions.db`

## How It Works

### Semantic Search

1. **Embedding Generation**: When you save a solution, the server generates a 384-dimensional vector embedding using the `all-MiniLM-L6-v2` model locally
2. **Vector Storage**: Embeddings are stored as binary blobs in SQLite
3. **Query Matching**: When you search, your query is converted to an embedding and compared using cosine similarity
4. **Ranking**: Results are ranked by similarity score (0-100%)

### Full-Text Search (Fallback)

If semantic search fails or no embeddings exist, the server falls back to SQLite FTS5 full-text search using BM25 ranking.

## Architecture

```
context8/
├── src/
│   ├── index.ts          # MCP server & tool registration
│   └── lib/
│       ├── database.ts   # SQLite operations & search
│       ├── embeddings.ts # Local transformer model for vectors
│       └── types.ts      # TypeScript type definitions
├── dist/                 # Compiled JavaScript output
├── package.json          # Dependencies & scripts
└── tsconfig.json         # TypeScript configuration
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Format code
npm run format

# Lint
npm run lint

# Run
npm start
```

## Dependencies

- **@modelcontextprotocol/sdk**: MCP protocol implementation
- **@xenova/transformers**: Local transformer models for embeddings
- **better-sqlite3**: Fast SQLite database with FTS5 support
- **zod**: Schema validation for tool inputs

## Use Cases

- 📚 Build a personal debugging knowledge base
- 🔄 Share common solutions across your team
- 🚀 Speed up problem-solving by referencing past solutions
- 🎓 Learn from your debugging history
- 📊 Track recurring issues and patterns

## Privacy & Security

- ✅ **100% Local**: All data stored on your machine
- ✅ **No Cloud Sync**: No external API calls for storage
- ✅ **Local AI**: Embeddings generated locally with transformers.js
- ✅ **Privacy Guidelines**: Built-in prompts enforce data abstraction

## License

MIT

## Contributing

Contributions welcome! This is a custom-modified MCP server based on Context7 architecture.

## Credits

- Built on MCP (Model Context Protocol) by Anthropic
- Architecture inspired by Context7
- Embeddings powered by Xenova/transformers.js
