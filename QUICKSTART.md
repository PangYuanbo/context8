# Context8 Quick Start Guide

Get up and running with Context8 MCP Server in 5 minutes (v1.0.3).

## Prerequisites

- Node.js 18+
- An MCP client (Claude Code/Desktop, Cursor, VS Code MCP, etc.)
- Optional: Context8 cloud API key (email-verified) if you want remote mode

## Step 1: Install via npx

- Claude Code/Desktop: `claude mcp add context8 -- npx -y context8-mcp`
- Any other client: command `npx`, args `-y`, `context8-mcp` in the MCP config.

## Step 2: Pick your mode

- **Remote (lightweight)**: Set `CONTEXT8_REMOTE_URL` and `CONTEXT8_REMOTE_API_KEY` in your MCP config, or run `context8-mcp remote-config --remote-url https://api.context8.org --api-key <key>`. Optional deps stay uninstalled.
- **Local (offline embeddings)**: Leave those envs unset (or `context8-mcp remote-config --clear`), then run `npx context8-mcp setup-local` once to pull `better-sqlite3` + `@xenova/transformers`. Data lives in `~/.context8/`.
- **Switch anytime**: Add/remove the envs above; run `setup-local` only when you actually want local embeddings.

## Step 3: Verify

```bash
npx context8-mcp diagnose
```

You should see whether you're in remote or local mode, plus connectivity and total counts.

## Step 4: Save your first solution

Ask your MCP client:

```
I want to save an error solution:

Title: React Hook called conditionally causes error
Error: "React Hook 'useState' is called conditionally"
Type: compile
Context: Building a React application with TypeScript
Root Cause: React Hooks must be called in the same order on every render
Solution: Move all hooks to the top of the component before any conditional logic
Tags: react, hooks, typescript
```

## Step 5: Search for it

```
Search my error solutions for "hook conditionally"
```

You should see your saved solution with a similarity score.

## Common prompts

- Save a solution: `Save this error solution to my knowledge base: [describe the error and fix]`
- Search: `Search my error solutions for "typescript type error"`
- Get details: `Show me the full details for solution ID abc123-def456`

### Batch Retrieve Multiple Solutions

```
Get me the full details for these solutions: abc123, def456, xyz789
```

## Database Location

In local mode, your solutions are stored at:

- **Windows**: `C:\Users\YourUsername\.context8\solutions.db`
- **macOS/Linux**: `~/.context8/solutions.db`

In remote mode, data stays on your configured Context8 server.

## Tips for Best Results

### 1. Use Good Tags

```
Tags: ["react", "typescript", "hooks", "nextjs", "ssr"]
```

### 2. Write Generic Solutions

❌ Bad: "Fixed getUserProfile API error in the auth module"
✅ Good: "Resolved async/await error in API request handler"

### 3. Include Context

```
Context: "During server-side rendering in a Next.js application"
```

### 4. Abstract Sensitive Info

Replace:

- Real paths → Generic paths (`src/components/Component.tsx`)
- Real API URLs → Placeholders (`api.example.com/resource`)
- Real function names → Generic names (`fetchData`, `handleSubmit`)

## Troubleshooting

### Server Not Starting?

Check the Claude Desktop logs:

- Windows: `%APPDATA%\Claude\logs\mcp*.log`
- macOS: `~/Library/Logs/Claude/mcp*.log`

### Build Failed? (source checkout only)

```bash
rm -rf node_modules dist
npm install
npm run build
```

### Database Issues? (local mode)

The database is created automatically on first use. If you want to start fresh:

```bash
# Backup first!
rm ~/.context8/solutions.db
```

## Example Workflow

1. **Encounter an error** while coding
2. **Debug and fix** the error
3. **Ask Claude** to save the solution:
   ```
   Save this error to my knowledge base:
   Title: [error description]
   Error: [error message]
   ...
   ```
4. **Later**, when you encounter similar error:
   ```
   Search my solutions for "similar error keywords"
   ```
5. **Review** the matched solutions and apply the fix!

## Next Steps

- Check out [README.md](./README.md) for detailed documentation
- See [COMPARISON.md](./COMPARISON.md) to understand Context7 vs Context8
- Read the [CHANGELOG.md](./CHANGELOG.md) for version history

## Getting Help

If you encounter issues:

1. Check the Claude Desktop logs
2. Verify your paths in the config file
3. Ensure Node.js 18+ is installed
4. If running from source, build with `npm run build`; if using npx, re-run `npx -y context8-mcp` to ensure you have the latest package

Happy debugging! 🐛✨
