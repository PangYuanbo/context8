# Context7 vs Context8 (ErrorSolver) Comparison

## Overview

**Context7**: Original MCP server for querying online library documentation from Context7 API
**Context8**: Modified version focusing solely on local error solution knowledge base management

## Architecture Similarities

Both projects share the same foundational architecture:
- Built on Model Context Protocol (MCP) SDK
- TypeScript with strict typing
- Support for stdio transport
- Modular code structure (`src/index.ts` + `src/lib/*`)
- Similar build and development tooling

## Key Differences

### 1. Core Functionality

| Feature | Context7 | Context8 (ErrorSolver) |
|---------|----------|------------------------|
| **Primary Purpose** | Query online documentation | Manage local error solutions |
| **Data Source** | External API (context7.com) | Local SQLite database |
| **Network Required** | Yes (API calls) | No (100% offline) |
| **Privacy** | Sends queries to external API | 100% local, no external calls |

### 2. MCP Tools

#### Context7 Tools:
1. `resolve-library-id` - Search for libraries and get Context7 IDs
2. `get-library-docs` - Fetch documentation for a specific library

#### Context8 (ErrorSolver) Tools:
1. `save-error-solution` - Save error solutions to local database
2. `search-solutions` - Search local solutions with semantic similarity
3. `get-solution-detail` - Get full details of a single solution
4. `batch-get-solutions` - Get multiple solutions efficiently

### 3. Technology Stack

| Component | Context7 | Context8 |
|-----------|----------|----------|
| **Database** | None | SQLite (better-sqlite3) |
| **AI/ML** | None | Local transformers (all-MiniLM-L6-v2) |
| **Network Client** | undici | None |
| **Search** | API-based | Semantic (embeddings) + FTS5 |
| **Encryption** | Yes (for API keys) | No (no keys needed) |

### 4. File Structure

#### Removed from Context8:
- `src/lib/api.ts` - Context7 API client
- `src/lib/encryption.ts` - API key encryption
- `src/lib/utils.ts` - API response formatting

#### Added to Context8:
- `src/lib/database.ts` - SQLite operations & search
- `src/lib/embeddings.ts` - Local transformer embeddings
- `src/lib/types.ts` - Simplified (ErrorSolution types only)

### 5. Configuration

#### Context7:
```json
{
  "mcpServers": {
    "context7": {
      "command": "node",
      "args": ["/path/to/context7/dist/index.js"],
      "env": {
        "CONTEXT7_API_KEY": "optional-api-key"
      }
    }
  }
}
```

#### Context8:
```json
{
  "mcpServers": {
    "errorsolver": {
      "command": "node",
      "args": ["/path/to/context8/dist/index.js"]
    }
  }
}
```
*No API key required!*

### 6. Dependencies

#### Shared:
- `@modelcontextprotocol/sdk`
- `zod`
- `commander`

#### Context7 Only:
- `undici` - HTTP client for API calls

#### Context8 Only:
- `better-sqlite3` - SQLite database
- `@xenova/transformers` - Local ML embeddings

### 7. Use Cases

#### Context7:
- Looking up documentation for libraries/frameworks
- Finding code examples from official docs
- Exploring API references
- Staying updated with library changes

#### Context8 (ErrorSolver):
- Building personal debugging knowledge base
- Storing solutions to recurring errors
- Sharing knowledge within teams
- Learning from debugging history
- Privacy-sensitive environments (no data leaves machine)

## Migration from Context7 to Context8

If you want both functionalities:

1. **Use both servers**: Run Context7 and Context8 simultaneously
   ```json
   {
     "mcpServers": {
       "context7": { "command": "node", "args": ["..."] },
       "errorsolver": { "command": "node", "args": ["..."] }
     }
   }
   ```

2. **When to use each**:
   - Use **Context7** when you need official documentation
   - Use **Context8** when you want to save/retrieve your own solutions

## Design Philosophy

### Context7:
- **Connected**: Relies on external API for up-to-date information
- **Comprehensive**: Access to vast library documentation
- **Dependency**: Requires internet and Context7 service availability

### Context8 (ErrorSolver):
- **Private**: All data stays on your machine
- **Personal**: Build your own knowledge base
- **Independent**: No external dependencies or API keys

## Performance

| Metric | Context7 | Context8 |
|--------|----------|----------|
| **Cold Start** | Fast (~100ms) | Slower (~2-5s, loads ML model) |
| **Query Speed** | Network dependent | Fast (~50-200ms) |
| **Offline** | ❌ No | ✅ Yes |
| **Scalability** | API limited | Local disk space |

## Conclusion

**Context7** is ideal for developers who need quick access to official library documentation and don't mind making API calls.

**Context8 (ErrorSolver)** is perfect for developers who want to build a personal, private, searchable knowledge base of their debugging experiences without any external dependencies.

Both can coexist and serve complementary purposes in your development workflow!
