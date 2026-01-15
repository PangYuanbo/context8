[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=context8&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImNvbnRleHQ4LW1jcCJdfQ%3D%3D) [<img alt="Install in VS Code (npx)" src="https://img.shields.io/badge/Install%20in%20VS%20Code-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=white">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22context8%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22context8-mcp%22%5D%7D)

# Context8 MCP - Cloud Error Solution Vault

[![NPM Version](https://img.shields.io/npm/v/context8-mcp?color=red)](https://www.npmjs.com/package/context8-mcp) [![MIT licensed](https://img.shields.io/npm/l/context8-mcp)](./LICENSE)

## 🎯 What is Context8?

Context8 is a **cloud-first error solution vault** for Vibe Coding agents: store fixes with context, search fast, and share solutions with the community. Think of it as a StackOverflow for AI-assisted coding. Local storage remains optional.

### Key Features

- ☁️ **Cloud-first sync** with optional local fallback
- 🔍 **Hybrid search** (semantic + keyword matching)
- 🛠️ **CLI + MCP** integration for coding assistants
- 🤝 **Community-ready** sharing via public solutions
- 📦 **Version tracking** for environment and dependencies

## 🛠️ Installation (cloud-first; local optional)

### ⚡ Quick Start

Choose the method that works best for you:

#### Option 1: Using npx (Simplest - Remote Mode)

Perfect for remote mode with cloud sync. Just configure with your API key:

```json
{
  "mcpServers": {
    "context8": {
      "command": "npx",
      "args": ["-y", "context8-mcp"],
      "env": {
        "CONTEXT8_REMOTE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

> Get your API key at https://www.context8.org (requires email verification)
>
> The remote URL (`https://api.context8.org`) is set as default - no need to specify it!

#### Option 2: Global Installation (Local Mode)

Install once, use everywhere with local database:

1. **Install globally:**

   ```bash
   npm install -g context8-mcp
   ```

2. **Optional - Configure remote access:**

   ```bash
   context8-mcp remote-config --remote-url https://api.context8.org --api-key <your-api-key>
   ```

3. **Add to your MCP client:**

   For **most MCP clients** (JSON format):

   ```json
   {
     "mcpServers": {
       "context8": {
         "command": "context8-mcp",
         "timeout": 30000
       }
     }
   }
   ```

   For **OpenAI Codex** (TOML format):

   ```toml
   [mcp_servers.context8]
   command = "context8-mcp"
   args = []
   startup_timeout_ms = 30000
   ```

That's it!

- **Remote mode (recommended)** → Uses the cloud and community features
- **Local mode (optional)** → Uses `~/.context8/solutions.db`

**Check version:**

```bash
context8-mcp --version
```

**Verify connection and get config paths:**

```bash
context8-mcp diagnose
```

This command will show:

- ✅ Your installation paths (ready to copy-paste into MCP configs)
- ✅ Package version
- ✅ Current mode (remote/local) and connectivity status
- ✅ Number of solutions stored

The output includes ready-to-use config snippets for both JSON and TOML formats!

---

### Requirements

- Node.js >= v18.0.0
- Cursor, Claude Code, VSCode, Windsurf or another MCP Client
- npm or compatible package manager (npx, bunx, etc.)
- Local mode needs optional deps for SQLite + embeddings (kept out of the lightweight default install):
  - `npm i better-sqlite3 @xenova/transformers` (global or project-local)
  - or run `context8-mcp setup-local` to install with npm/pnpm/yarn/bun (uses npm by default)
  - Remote-only mode can skip these; the MCP lazily loads them only when you run local mode.

> [!IMPORTANT]
> **Stdio MCP only; cloud-first**
>
> - ✅ Install via `npx`, `bunx`, or `npm install -g`
> - ✅ Stdio transport (no HTTP server mode)
> - ✅ Local data in `~/.context8/` by default
> - ✅ Cloud/remote mode available via `CONTEXT8_REMOTE_URL` + `CONTEXT8_REMOTE_API_KEY`

> [!TIP]
> **Recommended Post-Setup: Add a Rule to Auto-Use Context8**
>
> After installing Context8, add a rule in your MCP client to automatically search Context8 when encountering errors:
>
> **Example Rule:**
>
> ```txt
> When I encounter an error or bug, automatically search Context8 for similar solutions
> before suggesting fixes. Use the search-solutions tool to find relevant past solutions.
> ```

> [!NOTE]
> **Remote vs Local**
>
> - **Remote mode**: Set only `CONTEXT8_REMOTE_API_KEY` - the URL defaults to `https://api.context8.org`! This stays lightweight—no `better-sqlite3` / `@xenova/transformers` needed.
> - **Local mode**: Leave API key unset; run `context8-mcp setup-local` once to install optional deps. Data lives at `~/.context8/`.
> - **Switch modes**: Unset `CONTEXT8_REMOTE_API_KEY` to use local, or set it to use remote.
>
> Simplified remote config (any MCP client):
>
> ```json
> {
>   "env": {
>     "CONTEXT8_REMOTE_API_KEY": "<your-api-key>"
>   }
> }
> ```
>
> Or with custom remote server:
>
> ```json
> {
>   "env": {
>     "CONTEXT8_REMOTE_URL": "https://your-server.com",
>     "CONTEXT8_REMOTE_API_KEY": "<your-api-key>"
>   }
> }
> ```

<details>
<summary><b>Installing via Smithery</b></summary>

To install Context8 MCP Server for any client automatically via [Smithery](https://smithery.ai):

```bash
npx -y @smithery/cli@latest install context8-mcp --client <CLIENT_NAME>
```

</details>

<details>
<summary><b>Install in Cursor</b></summary>

Go to: `Settings` -> `Cursor Settings` -> `MCP` -> `Add new global MCP server`

Paste the following configuration into your Cursor `~/.cursor/mcp.json` file. You may also install in a specific project by creating `.cursor/mcp.json` in your project folder.

> Since Cursor 1.0, you can click the install button below for instant one-click installation.

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=context8&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImNvbnRleHQ4LW1jcCJdfQ%3D%3D)

#### Option 1: npx (remote mode)

```json
{
  "mcpServers": {
    "context8": {
      "command": "npx",
      "args": ["-y", "context8-mcp"],
      "env": {
        "CONTEXT8_REMOTE_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

#### Option 2: global install (local mode)

```json
{
  "mcpServers": {
    "context8": {
      "command": "context8-mcp",
      "timeout": 30000
    }
  }
}
```

> **Note:** The remote URL defaults to `https://api.context8.org` - you only need to set `CONTEXT8_REMOTE_API_KEY`!
>
> API key must be created via https://www.context8.org (email-verified user). Omit the env block to run local-only.

</details>

<details>
<summary><b>Install in Claude Code</b></summary>

Run this command:

#### Option 2: global install (local mode)

```sh
claude mcp add context8 -- context8-mcp
```

#### Option 1: npx (remote mode)

```sh
claude mcp add context8 \
  --env CONTEXT8_REMOTE_API_KEY=<your-api-key> \
  -- npx -y context8-mcp
```

> **Note:** The remote URL defaults to `https://api.context8.org` - you only need to set `CONTEXT8_REMOTE_API_KEY`!
>
> API key must be created via https://www.context8.org (email-verified user). Omit the env flags to run local-only.

</details>

<details>
<summary><b>Install in Amp</b></summary>

```sh
amp mcp add context8 npx -y context8-mcp
```

</details>

<details>
<summary><b>Install in Windsurf</b></summary>

Add this to your Windsurf MCP config file:

#### Option 1: npx (remote mode)

```json
{
  "mcpServers": {
    "context8": {
      "command": "npx",
      "args": ["-y", "context8-mcp"],
      "env": {
        "CONTEXT8_REMOTE_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

#### Option 2: global install (local mode)

```json
{
  "mcpServers": {
    "context8": {
      "command": "context8-mcp",
      "timeout": 30000
    }
  }
}
```

</details>

<details>
<summary><b>Install in VS Code</b></summary>

[<img alt="Install in VS Code (npx)" src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Context8%20MCP&color=0098FF">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22context8%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22context8-mcp%22%5D%7D)

Add this to your VS Code MCP config file:

#### Option 1: npx (remote mode)

```json
"mcp": {
  "servers": {
    "context8": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "context8-mcp"],
      "env": {
        "CONTEXT8_REMOTE_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

#### Option 2: global install (local mode)

```json
"mcp": {
  "servers": {
    "context8": {
      "type": "stdio",
      "command": "context8-mcp",
      "args": [],
      "startupTimeout": 30000
    }
  }
}
```

</details>

<details>
<summary><b>Install in Cline</b></summary>

1. Open **Cline**.
2. Click the hamburger menu icon (☰) to enter the **MCP Servers** section.
3. Choose **Local Servers** tab.
4. Click the **Edit Configuration** button.
5. Add context8 to `mcpServers`:

#### Option 1: npx (remote mode)

```json
{
  "mcpServers": {
    "context8": {
      "command": "npx",
      "args": ["-y", "context8-mcp"],
      "env": {
        "CONTEXT8_REMOTE_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

#### Option 2: global install (local mode)

```json
{
  "mcpServers": {
    "context8": {
      "command": "context8-mcp",
      "timeout": 30000
    }
  }
}
```

</details>

<details>
<summary><b>Install in Zed</b></summary>

Add this to your Zed `settings.json`:

#### Option 1: npx (remote mode)

```json
{
  "context_servers": {
    "Context8": {
      "source": "custom",
      "command": "npx",
      "args": ["-y", "context8-mcp"],
      "env": {
        "CONTEXT8_REMOTE_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

#### Option 2: global install (local mode)

```json
{
  "context_servers": {
    "Context8": {
      "source": "custom",
      "command": "context8-mcp",
      "args": []
    }
  }
}
```

</details>

<details>
<summary><b>Install in Augment Code</b></summary>

### Using the Augment Code UI

1. Click the hamburger menu.
2. Select **Settings**.
3. Navigate to the **Tools** section.
4. Click the **+ Add MCP** button.
5. Enter the following command:

   ```
   npx -y context8-mcp
   ```

6. Add environment variables:
   - `CONTEXT8_REMOTE_API_KEY=YOUR_API_KEY`
7. Name the MCP: **Context8**.
8. Click the **Add** button.

### Manual Configuration

Add to your `settings.json`:

#### Option 1: npx (remote mode)

```json
"augment.advanced": {
  "mcpServers": [
    {
      "name": "context8",
      "command": "npx",
      "args": ["-y", "context8-mcp"],
      "env": {
        "CONTEXT8_REMOTE_API_KEY": "YOUR_API_KEY"
      }
    }
  ]
}
```

#### Option 2: global install (local mode)

```json
"augment.advanced": {
  "mcpServers": [
    {
      "name": "context8",
      "command": "context8-mcp",
      "args": [],
      "timeout": 30000
    }
  ]
}
```

</details>

<details>
<summary><b>Install in Kilo Code</b></summary>

Create `.kilocode/mcp.json` in your project:

```json
{
  "mcpServers": {
    "context8": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "context8-mcp"],
      "alwaysAllow": [],
      "disabled": false
    }
  }
}
```

After saving, go to Settings → MCP Servers and click **Refresh MCP Servers**.

</details>

<details>
<summary><b>Install in Google Antigravity</b></summary>

Add this to your Antigravity MCP config file:

```json
{
  "mcpServers": {
    "context8": {
      "command": "npx",
      "args": ["-y", "context8-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in Roo Code</b></summary>

Add this to your Roo Code MCP configuration file:

```json
{
  "mcpServers": {
    "context8": {
      "command": "npx",
      "args": ["-y", "context8-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in Gemini CLI</b></summary>

Open `~/.gemini/settings.json` and add:

```json
{
  "mcpServers": {
    "context8": {
      "command": "npx",
      "args": ["-y", "context8-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in Qwen Coder</b></summary>

Open `~/.qwen/settings.json` and add:

```json
{
  "mcpServers": {
    "context8": {
      "command": "npx",
      "args": ["-y", "context8-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in Claude Desktop</b></summary>

Open Claude Desktop developer settings and edit your `claude_desktop_config.json` file:

#### Option 1: npx (remote mode)

```json
{
  "mcpServers": {
    "context8": {
      "command": "npx",
      "args": ["-y", "context8-mcp"],
      "env": {
        "CONTEXT8_REMOTE_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

#### Option 2: global install (local mode)

```json
{
  "mcpServers": {
    "context8": {
      "command": "context8-mcp",
      "timeout": 30000
    }
  }
}
```

</details>

<details>
<summary><b>Install in Opencode</b></summary>

```json
{
  "mcp": {
    "context8": {
      "type": "local",
      "command": ["npx", "-y", "context8-mcp"],
      "enabled": true
    }
  }
}
```

</details>

<details>
<summary><b>Install in OpenAI Codex</b></summary>

### Option 2: global install (local mode)

1. **Install globally:**

   ```bash
   npm install -g context8-mcp
   ```

2. **Add via Codex CLI (one-liner):**

   ```bash
   codex mcp add context8 -- context8-mcp
   ```

3. **Get your config paths:**

   ```bash
   context8-mcp diagnose
   ```

   This will show ready-to-copy config snippets for both recommended and alternative setups!

4. **Add to your Codex config** (copy from diagnose output):

   ```toml
   [mcp_servers.context8]
   command = "context8-mcp"
   args = []
   startup_timeout_ms = 30000
   ```

   This is the cleanest approach—no environment variables needed in the config file.

### Option 1: npx (remote mode)

```bash
codex mcp add context8 --env CONTEXT8_REMOTE_API_KEY=YOUR_API_KEY -- npx -y context8-mcp
```

Or add it manually:

```toml
[mcp_servers.context8]
args = ["-y", "context8-mcp"]
command = "npx"
startup_timeout_ms = 20_000
[mcp_servers.context8.env]
CONTEXT8_REMOTE_API_KEY = "YOUR_API_KEY"
```

> **Note:** The remote URL defaults to `https://api.context8.org` - you only need to set `CONTEXT8_REMOTE_API_KEY`!

</details>

<details>
<summary><b>Install in JetBrains AI Assistant</b></summary>

1. In JetBrains IDEs, go to `Settings` -> `Tools` -> `AI Assistant` -> `Model Context Protocol (MCP)`
2. Click `+ Add`.
3. Select **As JSON** option.
4. Add this configuration:

#### Option 1: npx (remote mode)

```json
{
  "mcpServers": {
    "context8": {
      "command": "npx",
      "args": ["-y", "context8-mcp"],
      "env": {
        "CONTEXT8_REMOTE_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

#### Option 2: global install (local mode)

```json
{
  "mcpServers": {
    "context8": {
      "command": "context8-mcp",
      "timeout": 30000
    }
  }
}
```

5. Click `Apply` to save.

</details>

<details>
<summary><b>Install in Kiro</b></summary>

1. Navigate `Kiro` > `MCP Servers`
2. Click `+ Add`.
3. Paste this configuration:

#### Option 1: npx (remote mode)

```json
{
  "mcpServers": {
    "Context8": {
      "command": "npx",
      "args": ["-y", "context8-mcp"],
      "env": {
        "CONTEXT8_REMOTE_API_KEY": "YOUR_API_KEY"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

#### Option 2: global install (local mode)

```json
{
  "mcpServers": {
    "Context8": {
      "command": "context8-mcp",
      "args": [],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

4. Click `Save`.

</details>

<details>
<summary><b>Install in Trae</b></summary>

#### Option 1: npx (remote mode)

```json
{
  "mcpServers": {
    "context8": {
      "command": "npx",
      "args": ["-y", "context8-mcp"],
      "env": {
        "CONTEXT8_REMOTE_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

#### Option 2: global install (local mode)

```json
{
  "mcpServers": {
    "context8": {
      "command": "context8-mcp",
      "timeout": 30000
    }
  }
}
```

</details>

<details>
<summary><b>Using Bun or Deno</b></summary>

#### Bun

```json
{
  "mcpServers": {
    "context8": {
      "command": "bunx",
      "args": ["-y", "context8-mcp"]
    }
  }
}
```

#### Deno

```json
{
  "mcpServers": {
    "context8": {
      "command": "deno",
      "args": [
        "run",
        "--allow-env",
        "--allow-net",
        "--allow-read",
        "--allow-write",
        "npm:context8-mcp"
      ]
    }
  }
}
```

</details>

<details>
<summary><b>Using Docker</b></summary>

Create a `Dockerfile`:

```Dockerfile
FROM node:18-alpine

WORKDIR /app

RUN npm install -g context8-mcp

CMD ["context8-mcp"]
```

Build and configure:

```bash
docker build -t context8-mcp .
```

Then use in your MCP config:

```json
{
  "mcpServers": {
    "context8": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-v", "$HOME/.context8:/root/.context8", "context8-mcp"]
    }
  }
}
```

Note: The `-v` flag mounts your local Context8 database directory.

</details>

<details>
<summary><b>Install in Windows</b></summary>

The configuration on Windows uses `cmd` wrapper:

```json
{
  "mcpServers": {
    "context8": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "context8-mcp"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

</details>

<details>
<summary><b>Install in Amazon Q Developer CLI</b></summary>

Add to your Amazon Q Developer CLI configuration:

```json
{
  "mcpServers": {
    "context8": {
      "command": "npx",
      "args": ["-y", "context8-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in Warp</b></summary>

1. Navigate `Settings` > `AI` > `Manage MCP servers`.
2. Click `+ Add`.
3. Paste:

```json
{
  "Context8": {
    "command": "npx",
    "args": ["-y", "context8-mcp"],
    "env": {},
    "working_directory": null,
    "start_on_launch": true
  }
}
```

4. Click `Save`.

</details>

<details>
<summary><b>Install in Copilot Coding Agent</b></summary>

Repository → Settings → Copilot → Coding agent → MCP configuration:

```json
{
  "mcpServers": {
    "context8": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "context8-mcp"],
      "tools": [
        "save-error-solution",
        "search-solutions",
        "get-solution-detail",
        "batch-get-solutions",
        "delete-solution"
      ]
    }
  }
}
```

</details>

<details>
<summary><b>Install in Copilot CLI</b></summary>

Open `~/.copilot/mcp-config.json` and add:

```json
{
  "mcpServers": {
    "context8": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "context8-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in LM Studio</b></summary>

[![Add MCP Server context8 to LM Studio](https://files.lmstudio.ai/deeplink/mcp-install-light.svg)](https://lmstudio.ai/install-mcp?name=context8&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImNvbnRleHQ4LW1jcCJdfQ%3D%3D)

Or manually:

1. Navigate to `Program` > `Install` > `Edit mcp.json`.
2. Paste:

```json
{
  "mcpServers": {
    "Context8": {
      "command": "npx",
      "args": ["-y", "context8-mcp"]
    }
  }
}
```

3. Click `Save`.

</details>

<details>
<summary><b>Install in Visual Studio 2022</b></summary>

```json
{
  "inputs": [],
  "servers": {
    "context8": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "context8-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in Crush</b></summary>

```json
{
  "$schema": "https://charm.land/crush.json",
  "mcp": {
    "context8": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "context8-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in BoltAI</b></summary>

Open Settings > Plugins and add:

```json
{
  "mcpServers": {
    "context8": {
      "command": "npx",
      "args": ["-y", "context8-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in Rovo Dev CLI</b></summary>

```bash
acli rovodev mcp
```

Then add:

```json
{
  "mcpServers": {
    "context8": {
      "command": "npx",
      "args": ["-y", "context8-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in Zencoder</b></summary>

1. Go to Zencoder menu (...)
2. Select **Agent tools**
3. Click **Add custom MCP**
4. Add configuration:

```json
{
  "command": "npx",
  "args": ["-y", "context8-mcp"]
}
```

5. Click **Install**

</details>

<details>
<summary><b>Install in Qodo Gen</b></summary>

1. Open Qodo Gen chat panel
2. Click **Connect more tools**
3. Click **+ Add new MCP**
4. Add:

```json
{
  "mcpServers": {
    "context8": {
      "command": "npx",
      "args": ["-y", "context8-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in Perplexity Desktop</b></summary>

1. Navigate `Perplexity` > `Settings` > `Connectors`
2. Click `Add Connector` > `Advanced`
3. Server Name: `Context8`
4. Paste:

```json
{
  "args": ["-y", "context8-mcp"],
  "command": "npx",
  "env": {}
}
```

5. Click `Save`.

</details>

<details>
<summary><b>Install in Factory</b></summary>

```sh
droid mcp add context8 "npx -y context8-mcp"
```

</details>

<details>
<summary><b>Install in Emdash</b></summary>

Emdash supports Context8 MCP. Configure your coding agent to connect to Context8 MCP using the appropriate configuration from the sections above.

</details>

## 🔨 Available Tools

Context8 MCP provides the following tools:

### Core Error Solution Tools

- **`save-error-solution`**: Save an error with its solution, root cause, and environment details
  - `errorMessage` (required): The error message or description
  - `solution` (required): How to fix the error
  - `rootCause` (optional): What caused the error
  - `context` (optional): Additional context about when/where it happened
  - `tags` (optional): Tags for categorization
  - `envVersions` (optional): Environment and dependency versions (JSON string)

- **`search-solutions`**: Search for similar errors using hybrid semantic + keyword search
  - `query` (required): Search query (error message or description)
  - `limit` (optional, default 5): Maximum number of results (1-20)
  - `minScore` (optional, default 0.3): Minimum similarity score (0-1)

- **`get-solution-detail`**: Get full details of a specific solution
  - `id` (required): Solution ID

- **`batch-get-solutions`**: Get details for multiple solutions at once
  - `ids` (required): Comma-separated solution IDs

- **`delete-solution`**: Delete a solution by ID
  - `id` (required): Solution ID to delete

## 💡 Usage Examples

### Save an Error Solution

```txt
I just fixed a TypeScript error. Let me save it to Context8:

Error: "Property 'map' does not exist on type 'string'"
Solution: The variable was incorrectly typed as string instead of array. Changed type from string to string[]
Root Cause: TypeScript inference failed because the initial value was an empty string
Environment: TypeScript 5.3.3, Node.js 20.10.0
```

The AI assistant will use `save-error-solution` to store this in your local vault.

### Search for Solutions

```txt
Search Context8 for solutions about "cannot find module" errors
```

The AI will use `search-solutions` to find relevant past solutions with similar errors.

### Automatic Search on Errors

With the recommended rule set up, simply paste an error:

```txt
I'm getting this error:
Error: ECONNREFUSED connect ECONNREFUSED 127.0.0.1:5432

What could be wrong?
```

The AI will automatically search Context8 for similar errors before suggesting solutions.

## 📦 Data Storage & Management

### Local Database

- **Location**: `~/.context8/solutions.db`
- **Format**: SQLite with WAL (Write-Ahead Logging)
- **Features**:
  - Safe for concurrent access
  - Automatic migration on version updates
  - Inverted index for fast keyword search
  - Semantic embeddings for similarity search

### Environment Version Tracking

Store environment details with each solution:

```json
{
  "node": "20.10.0",
  "typescript": "5.3.3",
  "next": "14.1.0",
  "react": "18.2.0"
}
```

This helps identify version-specific issues and solutions.

## 🖥️ CLI Usage

Context8 also provides a CLI for direct database access:

### List Solutions

```bash
npx context8-mcp list --limit 20 --offset 0
```

### Delete a Solution

```bash
npx context8-mcp delete <solution-id>
```

### Update Database

Run migrations and health checks:

```bash
npx context8-mcp update
```

This command:

- Runs database migrations
- Checks database health
- Verifies WAL mode
- Rebuilds indexes if needed
- Checks for npm package updates

## 🛟 Tips

### Add Automatic Search Rule

Set up your AI assistant to automatically search Context8 when you encounter errors:

```txt
When I share an error message or encounter a bug, automatically:
1. Search Context8 using search-solutions for similar past errors
2. If found, show me the stored solutions and their context
3. If not found, help me solve it and then save the solution to Context8
```

### Tag Your Solutions

Use consistent tags to categorize solutions:

- `typescript`, `react`, `node`
- `build-error`, `runtime-error`, `type-error`
- `database`, `api`, `frontend`

### Store Version Info

Always include environment versions when saving solutions:

```txt
Node: 20.10.0
TypeScript: 5.3.3
Framework: Next.js 14.1.0
```

## 🔧 Development

### Setup

```bash
git clone https://github.com/yourusername/context8-mcp
cd context8-mcp
npm install
```

### Build

```bash
npm run build
```

### Run Locally

```bash
npx . --help
```

### CLI Commands

Context8 MCP runs as a stdio MCP server when invoked without arguments. The following CLI commands are available:

- `context8-mcp --version` (or `-v`) – Display version number
- `context8-mcp diagnose` – **Show installation paths with ready-to-use config snippets** (JSON/TOML), current mode (remote/local), connectivity status, and solution count. Use this to get the exact paths for MCP client configurations!
- `context8-mcp remote-config` – Save or view remote URL/API key for cloud sync and remote mode
- `context8-mcp list` – List recent solutions (see CLI Usage section above)
- `context8-mcp search "<query>" [--limit N --mode hybrid|semantic|sparse]` – Search locally or remotely (if configured)
- `context8-mcp delete <id>` – Delete a solution by ID
- `context8-mcp push-remote` – Upload all local solutions to a remote Context8 server (uses saved/env remote config)
- `context8-mcp update` – Run database migrations and check for package updates
- `context8-mcp setup-local` – Install optional local dependencies (better-sqlite3, @xenova/transformers)

### Environment Variables

- `CONTEXT8_DEFAULT_LIMIT` – Default search result limit (optional, defaults to 25)
- `CONTEXT8_REMOTE_URL` – Remote Context8 server URL (optional, defaults to `https://api.context8.org`)
- `CONTEXT8_REMOTE_API_KEY` – API key for remote server (required for remote mode)

**Simplified remote mode:** Just set `CONTEXT8_REMOTE_API_KEY` - the URL will default to the official server!

You can also persist the remote URL/API key in `~/.context8/config.json` using `context8-mcp remote-config`. Environment variables override the saved config when both are set.

### Remote sync (optional)

- Get an API key at https://www.context8.org (API key must belong to an email-verified user).
- Save remote target locally: `context8-mcp remote-config --remote-url https://your-context8 --api-key <key>` (writes to `~/.context8/config.json`; flags > env > saved file).
- Push all local solutions: `context8-mcp push-remote --yes` (use `--dry-run` to preview; deduped via `~/.context8/remote-sync.json` unless `--force`).
- Remote sync is opt-in; local mode remains the default when no remote URL is resolved.
- Network guardrails: per-request timeout defaults to 10s; override with `--timeout <ms>` (e.g., `--timeout 15000`).
- Accurate total counts require backend support for `GET /solutions/count`; older servers will fall back to an approximate search-based count.
- API keys must be created via the `/apikeys` route and belong to an email-verified user; use `X-API-Key: <plaintext>` in requests (search `query` must be non-empty or backend returns 422).
- Simplified MCP env block (TOML style):
  ```toml
  [mcp_servers.context8.env]
  CONTEXT8_REMOTE_API_KEY = "<your-api-key>"
  # CONTEXT8_REMOTE_URL defaults to "https://api.context8.org" - no need to set it!
  ```

## 🚨 Troubleshooting

<details>
<summary><b>MCP Server Failed to Start / Path Issues</b></summary>

If your MCP client fails to start Context8, use the `diagnose` command to get the correct paths:

```bash
context8-mcp diagnose
```

This will show:

1. **Installation paths** - The exact paths to use in your config
2. **Ready-to-use config snippets** - Copy-paste snippets for both JSON and TOML formats
3. **Recommended vs Alternative configs** - Choose the one that works for your setup

**Common solutions:**

- ✅ Use `"command": "context8-mcp"` with `"args": []` (recommended if globally installed)
- ✅ Use `"command": "node"` with the full path from diagnose output (alternative)
- ✅ Make sure the path shown in diagnose exists and is accessible

</details>

<details>
<summary><b>Database Locked Error</b></summary>

If you see "database is locked" errors:

1. Make sure no other process is using the database
2. Run `npx context8-mcp update` to check database health
3. WAL mode should prevent most locking issues

</details>

<details>
<summary><b>Module Not Found Errors</b></summary>

Try using `bunx` instead of `npx`:

```json
{
  "mcpServers": {
    "context8": {
      "command": "bunx",
      "args": ["-y", "context8-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Auth/401 or 422 on search</b></summary>

- Ensure you are using an API key created via `/apikeys` for an email-verified user.
- For search, `query` must be non-empty (min length 1) or backend returns 422.
- If using a remote URL, check that `CONTEXT8_REMOTE_URL` and `CONTEXT8_REMOTE_API_KEY` are set, and no trailing slash is present.
</details>

<details>
<summary><b>Deployment security</b></summary>

- Set strong `JWT_SECRET` (and related secrets) in your deployment; defaults like `"change_me"` are insecure and for dev only.
- Ensure only verified users/API keys can access `/solutions` and `/search`.
</details>

<details>
<summary><b>Search Not Finding Results</b></summary>

1. Check if solutions are actually saved: `npx context8-mcp list`
2. Lower the `minScore` parameter in search
3. Try different search keywords
4. Run `npx context8-mcp update` to rebuild indexes

</details>

## 🔗 Related Projects

- [Model Context Protocol](https://modelcontextprotocol.io/) - Open standard for AI-application integration

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## ⭐ Star History

If you find Context8 useful, please consider giving it a star on GitHub!

---

Built with ❤️ for developers who want to remember their solutions
