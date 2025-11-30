# Changelog

All notable changes to the Context8 MCP Server will be documented in this file.

## [1.0.0] - 2025-01-19

### Added

- Initial release of Context8 MCP Server
- Local SQLite database for error solution storage
- Semantic search using all-MiniLM-L6-v2 embeddings
- Full-text search fallback with FTS5
- Four MCP tools:
  - `save-error-solution`: Save error solutions with privacy guidelines
  - `search-solutions`: Semantic and full-text search
  - `get-solution-detail`: Retrieve individual solution details
  - `batch-get-solutions`: Efficiently retrieve multiple solutions
- Privacy-first design with data abstraction guidelines
- Local embedding generation (no external API calls)
- Support for error categorization (compile, runtime, configuration, etc.)
- Tagging system for technology categorization

### Features

- 🔒 100% local storage in `~/.context8/`
- 🧠 AI-powered semantic similarity matching
- 📦 Lightweight SQLite database
- 🏷️ Flexible tagging system
- 🔍 Dual search: semantic + full-text
- 📝 Rich metadata support

### Technical

- Built on @modelcontextprotocol/sdk v1.17.5
- Uses @xenova/transformers for local embeddings
- TypeScript with strict type checking
- ESM module format
