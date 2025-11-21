# Context8 MCP – Local Error Solution Vault

[![NPM Version](https://img.shields.io/npm/v/context8-mcp?color=red)](https://www.npmjs.com/package/context8-mcp) [![MIT licensed](https://img.shields.io/npm/l/context8-mcp)](./LICENSE) [![Repo](https://img.shields.io/badge/GitHub-PangYuanbo%2Fcontext8-blue)](https://github.com/PangYuanbo/context8)

Context8 is a local-first MCP server for saving, searching, and reusing debugging solutions. It stores errors, root causes, fixes, and environment versions on your machine with hybrid (semantic + keyword) search—no external APIs.

- 100% local storage: `~/.context8/solutions.db`
- Dense + sparse hybrid search (MiniLM embeddings + BM25-style keywords)
- Environment snapshot required (Node/OS/dependency versions) to save
- CLI included for listing and deleting records

## Installation

### Mode 1: Context8 CLI (global install)
```bash
npm install -g context8-mcp
```

### Mode 2: npx (no global install)
```bash
npx context8-mcp --help
```
Data persists at `~/.context8/solutions.db` (auto-created on first run).

### Vibe / Claude Code–style MCP config

Global install path:
```json
{
  "mcpServers": {
    "context8": {
      "command": "node",
      "args": ["$(npm root -g)/context8-mcp/dist/index.js"]
    }
  }
}
```
If installed locally, replace the args path with your project’s absolute `dist/index.js`.

npx mode (no global install):
```json
{
  "mcpServers": {
    "context8": {
      "command": "npx",
      "args": ["context8-mcp"]
    }
  }
}
```
Both modes share the same DB at `~/.context8/solutions.db`.

Context7 passthrough (for `context7-cached-docs`):
- Set `CONTEXT7_API_KEY` in the MCP env (recommended for remote endpoint).
- Optional: override endpoint with `CONTEXT7_ENDPOINT` (e.g., `http://localhost:3100/mcp` if you run Context7 locally).

## Available tools
- `save-error-solution`: Save error/root cause/solution/tags/environment (fails if versions are missing).
- `search-solutions`: Hybrid search (`mode`: hybrid/semantic/sparse), returns scores and previews.
- `get-solution-detail`: Fetch full detail by ID.
- `batch-get-solutions`: Fetch multiple solutions (1–10 IDs).

## CLI (no MCP client needed)
- List: `context8-mcp list --limit 20 --offset 0`
- Delete: `context8-mcp delete <id>`
- Update check: `context8-mcp update`

## Data & storage
- DB: `~/.context8/solutions.db` (sql.js)
- Embeddings: MiniLM 384d; default hybrid weights 0.7 (dense) / 0.3 (sparse)
- Writes persist to disk; delete cleans inverted index + stats

## Quick start
1) `npm install -g context8-mcp`
2) Configure MCP with `command: node`, `args: ["$(npm root -g)/context8-mcp/dist/index.js"]`
3) Save an error with `save-error-solution` (include dependency versions)
4) Search with `search-solutions` (hybrid mode)

## Contributing
PRs welcome: https://github.com/PangYuanbo/context8  
License: MIT
