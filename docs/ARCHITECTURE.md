# Context8 Architecture

This document describes the architecture and design decisions of the Context8 MCP server.

## Overview

Context8 is a Model Context Protocol (MCP) server that provides a local, privacy-first knowledge base for storing and retrieving error solutions with semantic search capabilities.

## System Architecture

```
┌─────────────────────────────────────────────────┐
│           Claude Desktop / MCP Client            │
└─────────────────┬───────────────────────────────┘
                  │ MCP Protocol (stdio)
                  │
┌─────────────────▼───────────────────────────────┐
│              MCP Server (index.ts)               │
│  ┌─────────────────────────────────────────┐   │
│  │         Tool Registration Layer          │   │
│  │  - save-error-solution                   │   │
│  │  - search-solutions                      │   │
│  │  - get-solution-detail                   │   │
│  │  - batch-get-solutions                   │   │
│  └─────────────────┬───────────────────────┘   │
└────────────────────┼─────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼──────────┐    ┌────────▼─────────┐
│  database.ts     │    │  embeddings.ts   │
│                  │    │                  │
│ - SQLite Ops     │    │ - Vector Gen     │
│ - Sparse Search  │    │ - Similarity     │
│ - CRUD           │    │ - Transformers   │
└───────┬──────────┘    └──────────────────┘
        │
┌───────▼──────────────────────────┐
│  ~/.context8/solutions.db        │
│                                   │
│  Tables:                          │
│  - solutions (main)               │
│  - inverted_index (sparse)        │
│  - solution_stats (length cache)  │
│                                   │
│  Fields:                          │
│  - id, title, error_message       │
│  - error_type, context            │
│  - root_cause, solution           │
│  - code_changes, tags, labels     │
│  - cli_library_id                 │
│  - created_at, project_path       │
│  - embedding (BLOB), environment  │
└───────────────────────────────────┘
```

## Core Components

### 1. MCP Server (`src/index.ts`)

**Purpose**: Main entry point and MCP protocol handler

**Responsibilities**:

- Initialize MCP server with stdio transport
- Register all four MCP tools
- Handle tool invocations
- Manage server lifecycle

**Key Functions**:

- `createServerInstance()`: Creates and configures the MCP server
- `main()`: Initializes transport and starts the server

### 2. Database Layer (`src/lib/database.ts`)

**Purpose**: SQLite database operations and search functionality

**Responsibilities**:

- Database initialization and schema management
- CRUD operations for error solutions
- Semantic search using vector embeddings
- Sparse keyword search (BM25-style) with inverted index
- LIKE fallback when embeddings are unavailable
- Database migration and maintenance

**Key Functions**:

- `initDatabase()`: Creates database and tables
- `saveSolution()`: Inserts new solution with embedding and updates sparse index
- `searchSolutions()`: Hybrid dense/sparse search with keyword fallback
- `searchSolutionsSemantic()`: Vector-based similarity search
- `searchSolutionsByVector()`: Direct cosine similarity search
- `getSolutionById()`: Retrieve single solution
- `getSolutionsByIds()`: Batch retrieve solutions

**Database Schema**:

```sql
CREATE TABLE solutions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_type TEXT NOT NULL,
  context TEXT NOT NULL,
  root_cause TEXT NOT NULL,
  solution TEXT NOT NULL,
  code_changes TEXT,
  tags TEXT NOT NULL,
  created_at TEXT NOT NULL,
  project_path TEXT,
  embedding BLOB,
  environment TEXT,
  labels TEXT,
  cli_library_id TEXT
);

CREATE TABLE inverted_index (
  term TEXT NOT NULL,
  solution_id TEXT NOT NULL,
  term_freq INTEGER NOT NULL,
  PRIMARY KEY (term, solution_id)
);

CREATE TABLE solution_stats (
  solution_id TEXT PRIMARY KEY,
  doc_length INTEGER NOT NULL
);
```

### 3. Embeddings Layer (`src/lib/embeddings.ts`)

**Purpose**: Local machine learning for semantic search

**Responsibilities**:

- Load and manage transformer model
- Generate 384-dimensional embeddings
- Calculate cosine similarity
- Serialize/deserialize embeddings for storage

**Key Functions**:

- `initPipeline()`: Lazy-load the transformer model
- `generateEmbedding(text)`: Convert text to vector
- `generateSolutionEmbedding(solution)`: Combine solution fields
- `cosineSimilarity(a, b)`: Calculate vector similarity
- `serializeEmbedding()`: Convert to Buffer for SQLite
- `deserializeEmbedding()`: Convert from Buffer

**Model Details**:

- **Model**: `Xenova/all-MiniLM-L6-v2`
- **Dimensions**: 384
- **Type**: Sentence transformer (feature extraction)
- **Quantized**: Yes (for faster inference)

### 4. Types Layer (`src/lib/types.ts`)

**Purpose**: TypeScript type definitions

**Types**:

- `ErrorSolution`: Full solution with all fields
- `SolutionSearchResult`: Search result preview
- `ErrorType`: Enum of error categories

### 5. Remote Sync Helpers (`src/lib/remoteClient.ts`, `src/lib/config.ts`)

**Purpose**: Optional push-to-remote support

- Resolve remote base URL/API key from flags → env → `~/.context8/config.json`
- Persist remote target locally via `remote-config` CLI
- Deduplicate uploads in `push-remote` using content hash map stored at `~/.context8/remote-sync.json`
- Remote calls use simple JSON HTTP endpoints (`/solutions`, `/search`, `/solutions/{id}`, `/solutions/count` for accurate totals; legacy servers fall back to a best-effort search count)

## Data Flow

### Saving a Solution

```
1. User → Claude: "Save this error solution..."
2. Claude → MCP Server: save-error-solution(params)
3. MCP Server → Embeddings: generateSolutionEmbedding()
4. Embeddings → Model: all-MiniLM-L6-v2 inference
5. Model → Embeddings: [384-dim vector]
6. Embeddings → Database: saveSolution(solution + embedding)
7. Database: INSERT into solutions + update inverted_index + solution_stats
8. SQLite → Database: Success
9. Database → MCP Server: savedSolution
10. MCP Server → Claude: Success message
11. Claude → User: "Successfully saved solution #123"
```

### Searching Solutions

```
1. User → Claude: "Search for 'react hook error'"
2. Claude → MCP Server: search-solutions("react hook error")
3. MCP Server → Embeddings: generateEmbedding("react hook error")
4. Embeddings → Model: all-MiniLM-L6-v2 inference → [384-dim query vector]
5. Database: Sparse phase builds BM25-style candidates from inverted_index/solution_stats
6. Database: Dense phase scores candidates with cosine similarity
7. Database: Hybrid rank combines dense + sparse weights (fallback to LIKE if needed)
8. Database → MCP Server: [SolutionSearchResult[]]
9. MCP Server → Claude: Formatted results with similarity %
10. Claude → User: "Found 5 solutions: ..."
```

## Design Decisions

### Why SQLite?

- ✅ Lightweight and embedded (no server required)
- ✅ Zero configuration
- ✅ ACID compliance
- ✅ Binary blob support for embeddings
- ✅ Cross-platform
- ✅ Simple to extend with custom inverted index tables

### Why Local Embeddings?

- ✅ Privacy: No data sent to external APIs
- ✅ Offline: Works without internet
- ✅ Cost: No API fees
- ✅ Speed: Local inference is fast
- ✅ Control: Model version is fixed

**Trade-offs**:

- ⚠️ Cold start: ~2-5s to load model first time
- ⚠️ Accuracy: Smaller model vs. OpenAI/Cohere
- ⚠️ Memory: ~50MB for model

### Why Hybrid Search?

**Semantic Search** (Primary):

- Better for finding conceptually similar solutions
- Handles paraphrasing and synonyms
- Works across languages (to some extent)

**Sparse Keyword Search** (Fallback/Blend):

- BM25-style scoring over inverted_index/solution_stats
- Fast exact/near-exact matching for error strings
- Avoids model load for cold-start; still works when embeddings missing

### Why Stdio Transport?

- ✅ Standard for MCP clients like Claude Desktop
- ✅ Simpler than HTTP (no port management)
- ✅ Better for desktop applications
- ✅ Process isolation

## Security Considerations

### Data Privacy

1. **Local Storage Only**: All data in `~/.context8/solutions.db`
2. **Offline by Default**: No external calls unless a remote URL is configured explicitly
3. **No Telemetry**: No tracking or analytics
4. **User Control**: User owns and controls their data (including whether to push remotely)

### Privacy Guidelines in Prompts

The `save-error-solution` tool includes extensive privacy guidelines:

- Abstract file paths, variable names, API endpoints
- Remove all sensitive information
- Use generic examples and placeholders
- Focus on technical patterns, not business logic

### Input Validation

- **Zod Schemas**: All tool inputs validated
- **SQL Injection**: Prepared statements only
- **Type Safety**: TypeScript strict mode
- **Error Handling**: Try-catch blocks around DB operations

## Performance Characteristics

### Time Complexity

| Operation       | Complexity | Notes                            |
| --------------- | ---------- | -------------------------------- |
| Save Solution   | O(n)       | n = embedding dimension (384)    |
| Semantic Search | O(n\*m)    | n = solutions, m = embedding dim |
| Sparse keyword  | O(k)       | Inverted index postings (BM25)   |
| Get by ID       | O(1)       | Primary key lookup               |

### Space Complexity

| Component | Size     | Notes                      |
| --------- | -------- | -------------------------- |
| Model     | ~50MB    | Quantized all-MiniLM-L6-v2 |
| Embedding | 1.5KB    | 384 floats × 4 bytes       |
| Solution  | ~2-5KB   | Text fields                |
| Database  | Variable | ~2-5KB per solution        |

### Optimization Opportunities

1. **Lazy Loading**: Model loads only when needed
2. **Connection Pooling**: Single DB connection reused
3. **Batch Operations**: `getSolutionsByIds` is more efficient
4. **Sparse Index Rebuild**: `ensureSparseIndex` backfills inverted_index/solution_stats when empty
5. **WAL Mode**: Write-ahead logging for concurrency

## Scalability

### Current Limits

- **Solutions**: Tested up to 10,000 solutions
- **Search**: Sub-second for <1,000 solutions
- **Memory**: ~100MB with model loaded
- **Disk**: ~2-5MB per 1,000 solutions

### Future Improvements

- [ ] Embedding cache for repeated searches
- [ ] Approximate nearest neighbor (ANN) for large datasets
- [ ] Solution pruning/archiving
- [ ] Database vacuum/optimization commands

## Error Handling

### Error Propagation

```
SQLite Error → Database Layer → MCP Tool → Claude → User
```

### Error Types

1. **Database Errors**: SQLite connection, constraint violations
2. **Embedding Errors**: Model loading, inference failures
3. **Validation Errors**: Zod schema validation
4. **Search Errors**: No results, malformed queries

### Error Messages

- User-friendly messages (no stack traces to user)
- Technical details logged to stderr
- Graceful degradation (LIKE keyword fallback)

## Testing Strategy

### Unit Tests (Planned)

- Database CRUD operations
- Embedding generation and similarity
- Type validation with Zod schemas

### Integration Tests (Planned)

- End-to-end tool invocations
- Database + embeddings integration
- Search accuracy benchmarks

### Manual Testing

- Tool invocations via Claude Desktop
- Database inspection with SQLite CLI
- Performance profiling

## Future Architecture Considerations

### Potential Enhancements

1. **Multi-user Support**: User-specific databases
2. **Cloud Sync**: Optional encrypted backup
3. **Web UI**: Electron app or web interface
4. **API Server**: HTTP endpoint for other clients
5. **Plugin System**: Custom processors and filters

### Migration Path

- Database schema versioning
- Backward compatibility for old solutions
- Migration scripts for schema changes

## References

- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js)
- [all-MiniLM-L6-v2 Model Card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on contributing to the architecture.
