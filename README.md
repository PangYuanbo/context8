![Cover](public/cover.png)

# Context8 MCP – Local Error Solution Vault

[![NPM Version](https://img.shields.io/npm/v/context8-mcp?color=red)](https://www.npmjs.com/package/context8-mcp) [![MIT licensed](https://img.shields.io/npm/l/context8-mcp)](./LICENSE)

Context8 是本地优先的错误解决方案仓库：保存错误、根因、修复和环境版本，提供语义 + 关键词混合搜索。存储在 `~/.context8/solutions.db`，无外部依赖。

- SQLite（better-sqlite3）+ WAL，支持多进程写入且不互相覆盖
- 混合搜索：MiniLM 384d + BM25 样式倒排索引
- 自动迁移守护：`context8-mcp update` 确保 schema/WAL/索引

## 要求

- Node.js ≥ 18
- MCP 客户端（Claude Code、Codex 等）

## 安装（只列 Codex / Claude Code）

### Codex（本地 stdio）

在 Codex 配置中添加：

```toml
[mcp_servers.context8]
command = "npx"
args = ["-y", "context8-mcp"]
startup_timeout_ms = 20000
```

可选环境变量：
```
CONTEXT7_API_KEY=...   # 如需调用 context7-cached-docs
CONTEXT8_REMOTE_URL=... # 如需远端模式
CONTEXT8_REMOTE_API_KEY=...
```

### Claude Code（本地 stdio）

```bash
claude mcp add context8 -- npx -y context8-mcp
```

## 可用工具

- `save-error-solution`
- `search-solutions`
- `get-solution-detail`
- `batch-get-solutions`
- `delete-solution`
- `context7-cached-docs`（需版本化库 ID，如 `/vercel/next.js/v15.1.8`）

## 数据与存储

- DB：`~/.context8/solutions.db`（better-sqlite3，WAL）
- 删除会同步清理倒排索引与统计
- `update` 会先运行迁移/健康检查后再检查 npm 更新

## 开发

```bash
npm install
npm run build
npx context8-mcp --help
```

许可证：MIT
