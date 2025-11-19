# ErrorSolver MCP 服务器

一个基于模型上下文协议（MCP）的本地错误解决方案知识库服务器，支持语义搜索功能。

[English](../README.md) | **简体中文** | [繁體中文](./README.zh-TW.md)

## 概览

ErrorSolver 帮助开发者维护一个个人的调试知识库。当你遇到并解决错误时，将它们保存到本地数据库以供将来参考。语义搜索功能可以智能地将你的查询匹配到之前解决的问题，即使措辞不同也能找到相关结果。

## 特性

- **🔒 隐私优先设计**：所有数据存储在你的本地机器上
- **🧠 语义搜索**：使用本地嵌入模型的 AI 驱动相似度匹配
- **📦 SQLite 数据库**：轻量级、快速且可靠的存储
- **🏷️ 标签系统**：按技术、错误类型和自定义标签组织解决方案
- **🔍 全文搜索**：当语义搜索不可用时的备用搜索
- **📝 丰富元数据**：存储错误消息、上下文、根本原因、解决方案和代码更改

## 安装

```bash
cd context8
npm install
npm run build
```

## 在 Claude Code 中使用

将以下配置添加到你的 MCP 设置文件：

### Windows
`%APPDATA%\Claude\claude_desktop_config.json`

### macOS/Linux
`~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "errorsolver": {
      "command": "node",
      "args": ["/你的绝对路径/context8/dist/index.js"]
    }
  }
}
```

## 可用的 MCP 工具

### 1. `save-error-solution` - 保存错误解决方案

将错误及其解决方案保存到本地知识库。

**参数：**
- `title` (字符串)：通用技术标题
- `errorMessage` (字符串)：错误消息（已脱敏）
- `errorType` (枚举)：错误类型（编译、运行时、配置等）
- `context` (字符串)：通用技术上下文
- `rootCause` (字符串)：技术根本原因分析
- `solution` (字符串)：通用的分步解决方案
- `codeChanges` (字符串，可选)：抽象的代码更改
- `tags` (字符串数组)：技术标签
- `projectPath` (字符串，可选)：通用项目类型

**隐私指南：**
- ❌ 不要包含项目特定的文件路径、变量名或 API 端点
- ❌ 不要包含敏感信息（密钥、令牌、密码、URL）
- ❌ 不要包含业务逻辑或专有细节
- ✅ 专注于通用技术模式
- ✅ 使用占位符名称和假设场景

**示例：**
```typescript
{
  title: "React Hook 在函数式组件外部调用导致 TypeError",
  errorMessage: "TypeError: Cannot read property 'useState' of null",
  errorType: "runtime",
  context: "在 Next.js 应用中渲染 React 组件期间",
  rootCause: "React hooks 只能在函数式组件或自定义 hooks 内部调用。当试图在类组件或组件树外部使用 hook 时会发生此错误。",
  solution: "1. 确保 hook 在函数式组件内部调用\n2. 检查组件文件导出的是函数式组件\n3. 验证 React 版本支持 hooks（16.8+）",
  codeChanges: "// 之前\nclass Component extends React.Component {\n  const [state] = useState(0);\n}\n\n// 之后\nfunction Component() {\n  const [state, setState] = useState(0);\n}",
  tags: ["react", "hooks", "typescript", "nextjs"],
  projectPath: "nextjs-app"
}
```

### 2. `search-solutions` - 搜索错误解决方案

使用语义相似度或全文搜索在知识库中搜索。

**参数：**
- `query` (字符串)：搜索查询（错误消息、关键词或技术名称）
- `limit` (数字，可选)：最大结果数（默认：25）

**返回：**
- 带有相似度分数的匹配解决方案列表
- 错误消息和上下文的预览
- 用于详细检索的解决方案 ID

**示例：**
```typescript
{
  query: "react hook error useState",
  limit: 10
}
```

### 3. `get-solution-detail` - 获取解决方案详情

通过 ID 检索特定解决方案的完整详情。

**参数：**
- `solutionId` (字符串)：来自搜索结果的解决方案 ID

**返回：**
- 包含所有字段的完整解决方案
- 错误消息、上下文、根本原因、解决方案步骤
- 代码更改（如果有）

### 4. `batch-get-solutions` - 批量获取解决方案

一次检索多个解决方案（比单独请求更高效）。

**参数：**
- `solutionIds` (字符串数组)：解决方案 ID 数组（1-10 个）

**返回：**
- 所有请求解决方案的完整详情
- 缺失解决方案的通知

**示例：**
```typescript
{
  solutionIds: ["abc123-def456", "xyz789-uvw012", "pqr345-stu678"]
}
```

## 数据库位置

解决方案存储在：`~/.errorsolver/solutions.db`

## 工作原理

### 语义搜索

1. **嵌入生成**：当你保存解决方案时，服务器使用 `all-MiniLM-L6-v2` 模型在本地生成 384 维向量嵌入
2. **向量存储**：嵌入作为二进制 blob 存储在 SQLite 中
3. **查询匹配**：当你搜索时，你的查询被转换为嵌入并使用余弦相似度进行比较
4. **排名**：结果按相似度分数（0-100%）排名

### 全文搜索（备用）

如果语义搜索失败或不存在嵌入，服务器会回退到使用 BM25 排名的 SQLite FTS5 全文搜索。

## 架构

```
context8/
├── src/
│   ├── index.ts          # MCP 服务器和工具注册
│   └── lib/
│       ├── database.ts   # SQLite 操作和搜索
│       ├── embeddings.ts # 用于向量的本地 transformer 模型
│       └── types.ts      # TypeScript 类型定义
├── dist/                 # 编译后的 JavaScript 输出
├── package.json          # 依赖和脚本
└── tsconfig.json         # TypeScript 配置
```

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 格式化代码
npm run format

# 代码检查
npm run lint

# 运行
npm start
```

## 依赖项

- **@modelcontextprotocol/sdk**：MCP 协议实现
- **@xenova/transformers**：用于嵌入的本地 transformer 模型
- **better-sqlite3**：支持 FTS5 的快速 SQLite 数据库
- **zod**：工具输入的模式验证

## 使用场景

- 📚 构建个人调试知识库
- 🔄 在团队内共享常见解决方案
- 🚀 通过参考过去的解决方案加快问题解决速度
- 🎓 从调试历史中学习
- 📊 跟踪重复出现的问题和模式

## 隐私和安全

- ✅ **100% 本地**：所有数据存储在你的机器上
- ✅ **无云同步**：存储不进行外部 API 调用
- ✅ **本地 AI**：使用 transformers.js 在本地生成嵌入
- ✅ **隐私指南**：内置提示强制执行数据抽象

## 许可证

MIT

## 贡献

欢迎贡献！这是一个基于 Context7 架构的自定义修改 MCP 服务器。

## 致谢

- 基于 Anthropic 的 MCP（模型上下文协议）构建
- 架构灵感来自 Context7
- 嵌入由 Xenova/transformers.js 提供支持

## 快速开始

查看 [QUICKSTART.md](../QUICKSTART.md) 获取 5 分钟快速入门指南。

## 对比

查看 [COMPARISON.md](../COMPARISON.md) 了解 Context7 和 Context8 (ErrorSolver) 之间的区别。
