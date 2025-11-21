# ErrorSolver Quick Start Guide

Get up and running with ErrorSolver MCP Server in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Claude Desktop (or any MCP-compatible client)

## Step 1: Build the Server

```bash
cd context8
npm install
npm run build
```

Expected output:

```
added 293 packages
```

## Step 2: Configure Claude Desktop

### Windows

Edit `%APPDATA%\Claude\claude_desktop_config.json`

### macOS

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`

### Linux

Edit `~/.config/Claude/claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "errorsolver": {
      "command": "node",
      "args": ["C:/Users/aaron/Desktop/MCP/context8/dist/index.js"]
    }
  }
}
```

**Note**: Use the absolute path to your `context8/dist/index.js` file!

## Step 3: Restart Claude Desktop

Close and reopen Claude Desktop to load the new MCP server.

## Step 4: Verify Installation

In Claude Desktop, try this prompt:

```
Search my error solutions for "react"
```

If the server is working, you'll see:

```
No solutions found for "react".
Knowledge base contains 0 total solution(s).
```

Perfect! Your ErrorSolver is ready.

## Step 5: Save Your First Solution

Try this prompt in Claude:

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

Claude will use the `save-error-solution` tool to save this to your local database!

## Step 6: Search for Solutions

Now search for it:

```
Search my error solutions for "hook conditionally"
```

You should see your saved solution with a similarity score!

## Common Commands

### Save a Solution (when you fix an error)

```
Save this error solution to my knowledge base:
[describe the error and solution]
```

### Search for Solutions

```
Search my error solutions for "typescript type error"
```

### Get Solution Details

```
Show me the full details for solution ID abc123-def456
```

### Batch Retrieve Multiple Solutions

```
Get me the full details for these solutions: abc123, def456, xyz789
```

## Database Location

Your solutions are stored at:

- **Windows**: `C:\Users\YourUsername\.errorsolver\solutions.db`
- **macOS/Linux**: `~/.errorsolver/solutions.db`

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

### Build Failed?

```bash
rm -rf node_modules dist
npm install
npm run build
```

### Database Issues?

The database is created automatically on first use. If you want to start fresh:

```bash
# Backup first!
rm ~/.errorsolver/solutions.db
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
4. Make sure you ran `npm run build`

Happy debugging! 🐛✨
