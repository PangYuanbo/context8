# ErrorSolver MCP 伺服器

一個基於模型上下文協定（MCP）的本地錯誤解決方案知識庫伺服器，支援語義搜尋功能。

[English](../README.md) | [简体中文](./README.zh-CN.md) | **繁體中文**

## 概覽

ErrorSolver 幫助開發者維護一個個人的偵錯知識庫。當你遇到並解決錯誤時，將它們儲存到本地資料庫以供將來參考。語義搜尋功能可以智慧地將你的查詢匹配到之前解決的問題，即使措辭不同也能找到相關結果。

## 特性

- **🔒 隱私優先設計**：所有資料儲存在你的本地機器上
- **🧠 語義搜尋**：使用本地嵌入模型的 AI 驅動相似度匹配
- **📦 SQLite 資料庫**：輕量級、快速且可靠的儲存
- **🏷️ 標籤系統**：按技術、錯誤類型和自訂標籤組織解決方案
- **🔍 全文搜尋**：當語義搜尋不可用時的備用搜尋
- **📝 豐富中繼資料**：儲存錯誤訊息、上下文、根本原因、解決方案和程式碼變更

## 安裝

```bash
cd context8
npm install
npm run build
```

## 在 Claude Code 中使用

將以下設定新增到你的 MCP 設定檔案：

### Windows
`%APPDATA%\Claude\claude_desktop_config.json`

### macOS/Linux
`~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "errorsolver": {
      "command": "node",
      "args": ["/你的絕對路徑/context8/dist/index.js"]
    }
  }
}
```

## 可用的 MCP 工具

### 1. `save-error-solution` - 儲存錯誤解決方案

將錯誤及其解決方案儲存到本地知識庫。

**參數：**
- `title` (字串)：通用技術標題
- `errorMessage` (字串)：錯誤訊息（已脫敏）
- `errorType` (列舉)：錯誤類型（編譯、執行時、設定等）
- `context` (字串)：通用技術上下文
- `rootCause` (字串)：技術根本原因分析
- `solution` (字串)：通用的分步解決方案
- `codeChanges` (字串，可選)：抽象的程式碼變更
- `tags` (字串陣列)：技術標籤
- `projectPath` (字串，可選)：通用專案類型

### 2. `search-solutions` - 搜尋錯誤解決方案

使用語義相似度或全文搜尋在知識庫中搜尋。

### 3. `get-solution-detail` - 取得解決方案詳情

透過 ID 檢索特定解決方案的完整詳情。

### 4. `batch-get-solutions` - 批次取得解決方案

一次檢索多個解決方案（比單獨請求更高效）。

## 資料庫位置

解決方案儲存在：`~/.errorsolver/solutions.db`

## 工作原理

### 語義搜尋

1. **嵌入生成**：當你儲存解決方案時，伺服器使用 `all-MiniLM-L6-v2` 模型在本地生成 384 維向量嵌入
2. **向量儲存**：嵌入作為二進位 blob 儲存在 SQLite 中
3. **查詢匹配**：當你搜尋時，你的查詢被轉換為嵌入並使用餘弦相似度進行比較
4. **排名**：結果按相似度分數（0-100%）排名

## 許可證

MIT

## 快速開始

查看 [QUICKSTART.md](../QUICKSTART.md) 取得 5 分鐘快速入門指南。

## 對比

查看 [COMPARISON.md](../COMPARISON.md) 瞭解 Context7 和 Context8 (ErrorSolver) 之間的區別。
