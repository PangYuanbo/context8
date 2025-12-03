# Changelog

All notable changes to the Context8 MCP Server will be documented in this file.

## [1.0.3-beta.5] - 2025-12-03

### Added

- CLI `diagnose` command to report resolved mode (remote/local) and test connectivity/count via `/solutions/count`.

### Fixed

- `save-error-solution` response now reports actual target (`Remote: <url>` vs `Local DB: <path>`) instead of always showing the local path when remote mode is active.

## [1.0.3-beta.4] - 2025-12-01

### Added

- CLI `search` command (local or remote based on configuration) with mode selection.

### Changed

- Remote count calls use non-empty placeholder to avoid backend 422.
- Remote request timeout now reads `CONTEXT8_REQUEST_TIMEOUT` (CLI `--timeout` effective).
- Context7 cached docs tool only registers in local mode; remote mode disables cache.
- README updated with API key acquisition (context8.org), remote config, and warnings about non-empty search queries.

### Security

- Reminder to set strong `JWT_SECRET`/related envs in cloud deployments (defaults are insecure).

## [1.0.3-beta.3] - 2025-11-30

### Changed

- Remote client requests now include timeouts and return parsed error bodies for clearer failures.
- Sync/dedupe helpers extracted from `src/index.ts` into `src/lib/sync.ts` to simplify the entry point.

### Fixed

- Remote solution counts now use a dedicated `/solutions/count` endpoint (with a fallback for legacy servers) instead of the broken `"*"` search hack.

## [1.0.3-beta.2] - 2025-11-30

### Added

- CLI `remote-config` to persist remote URL/API key in `~/.context8/config.json` (flags > env > saved file)
- CLI `push-remote` to upload all local solutions to a remote Context8 server with dry-run/force/concurrency options and dedupe map in `~/.context8/remote-sync.json`

### Changed

- Architecture docs now reflect the sparse inverted index + hybrid search (no FTS5 virtual table)

### Fixed

- Removed duplicated remote sync helpers in `src/index.ts` so TypeScript build passes again

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
