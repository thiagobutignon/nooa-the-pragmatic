# MCP Integration - Complete Implementation Plan

> **For Claude:** Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` to implement this plan task-by-task.

## 🎯 Objective

**Enable agent + user to discover, install, configure, and execute MCPs (Model Context Protocol servers)**

This means:
1. ✅ **Discover** available MCPs (registry + installed + enabled)
2. ✅ **Install** MCP servers (npm, git, local)
3. ✅ **Configure** which MCPs to use and their settings
4. ✅ **Execute** tools/resources/prompts from MCPs
5. ✅ **Integrate** MCPs with existing NOOA commands (ai, context, fix)

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       NOOA Commands                          │
│  (nooa ai, nooa context, nooa fix, ...)                     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  MCP Tool Provider                           │
│         Inject MCP tools into AI context                    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCP Registry                              │
│  Manages: install, enable, configure, list                  │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  MCP Client (JSON-RPC)                       │
│  Stdio communication, discovery, execution                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   MCP Servers                                │
│  (filesystem, github, slack, postgres, ...)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 File Structure

```
src/
├── core/
│   └── mcp/
│       ├── Client.ts              # JSON-RPC over stdio
│       ├── Client.test.ts
│       ├── Registry.ts            # Install/enable/configure/list
│       ├── Registry.test.ts
│       ├── ServerManager.ts       # Spawn/kill servers
│       ├── ServerManager.test.ts
│       ├── ConfigStore.ts         # SQLite persistence
│       ├── ConfigStore.test.ts
│       ├── ToolProvider.ts        # Inject tools to AI
│       ├── ToolProvider.test.ts
│       └── types.ts               # MCP types
│
├── features/
│   └── mcp/
│       ├── cli.ts                 # Main CLI entry
│       ├── cli.test.ts
│       ├── install.ts             # Install subcommand
│       ├── install.test.ts
│       ├── list.ts                # List subcommand
│       ├── list.test.ts
│       ├── enable.ts              # Enable subcommand
│       ├── enable.test.ts
│       ├── disable.ts             # Disable subcommand
│       ├── disable.test.ts
│       ├── call.ts                # Call tool subcommand
│       ├── call.test.ts
│       ├── resource.ts            # Read resource subcommand
│       ├── resource.test.ts
│       ├── info.ts                # Show MCP info subcommand
│       ├── info.test.ts
│       ├── configure.ts           # Configure subcommand
│       └── configure.test.ts
│
└── core/
    └── db/
        └── schema/
            └── mcp_servers.ts     # SQLite schema for MCP config
```

---

## 🗄️ Persistent Configuration

### SQLite Schema (`mcp_servers` table)

```sql
CREATE TABLE mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  package TEXT,              -- npm package name or git url
  command TEXT NOT NULL,      -- e.g., "node" or "bun"
  args TEXT NOT NULL,         -- JSON array of args
  env TEXT,                   -- JSON object of env vars
  enabled BOOLEAN DEFAULT 1,
  installed_at INTEGER,
  updated_at INTEGER
);
```

### Configuration Example

```json
{
  "servers": {
    "filesystem": {
      "enabled": true,
      "package": "@modelcontextprotocol/server-filesystem",
      "command": "node",
      "args": ["/path/to/node_modules/.bin/mcp-server-filesystem", "/workspace"]
    },
    "github": {
      "enabled": false,
      "package": "@modelcontextprotocol/server-github",
      "command": "node",
      "args": ["/path/to/node_modules/.bin/mcp-server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxx"
      }
    }
  }
}
```

---

## 📋 TDD Tasks (Estimated: 18 tasks)

### **Phase 1: Core Infrastructure (6 tasks)**

#### Task 1: MCP Types & Interfaces

**Files:**
- Create: `src/core/mcp/types.ts`

**Test:**
```typescript
import { test, expect } from "bun:test";
import type { McpServer, McpTool, McpResource } from "./types";

test("McpServer type is defined", () => {
  const server: McpServer = {
    id: "test",
    name: "test-server",
    package: "@test/server",
    command: "node",
    args: ["server.js"],
    enabled: true
  };
  expect(server.name).toBe("test-server");
});
```

**Implementation:**
```typescript
export interface McpServer {
  id: string;
  name: string;
  package?: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  installedAt?: number;
  updatedAt?: number;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: any;
}

export interface McpResource {
  uri: string;
  name: string;
  mimeType?: string;
}

export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: any[];
}
```

---

#### Task 2: MCP ConfigStore (SQLite)

**Files:**
- Create: `src/core/db/schema/mcp_servers.ts`
- Create: `src/core/mcp/ConfigStore.ts`
- Test: `src/core/mcp/ConfigStore.test.ts`

**Test:**
```typescript
import { test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { ConfigStore } from "./ConfigStore";
import type { McpServer } from "./types";

test("ConfigStore can save and load MCP config", async () => {
  const db = new Database(":memory:");
  const store = new ConfigStore(db);
  
  const server: McpServer = {
    id: "fs-1",
    name: "filesystem",
    package: "@modelcontextprotocol/server-filesystem",
    command: "node",
    args: ["server.js"],
    enabled: true
  };
  
  await store.save(server);
  const loaded = await store.get("filesystem");
  
  expect(loaded?.name).toBe("filesystem");
  expect(loaded?.enabled).toBe(true);
});
```

---

#### Task 3: MCP Client (JSON-RPC Stdio)

**Files:**
- Create: `src/core/mcp/Client.ts`
- Test: `src/core/mcp/Client.test.ts`

**Test:**
```typescript
test("McpClient can start and list tools", async () => {
  // Use mock MCP server for testing
  const client = new McpClient({
    command: "node",
    args: ["./test/fixtures/mock-mcp-server.js"]
  });
  
  await client.start();
  const tools = await client.listTools();
  
  expect(Array.isArray(tools)).toBe(true);
  expect(tools.length).toBeGreaterThan(0);
  
  await client.stop();
});

test("McpClient can call a tool", async () => {
  const client = new McpClient({
    command: "node",
    args: ["./test/fixtures/mock-mcp-server.js"]
  });
  
  await client.start();
  const result = await client.callTool("echo", { message: "hello" });
  
  expect(result).toBe("hello");
  
  await client.stop();
});
```

---

#### Task 4: ServerManager (Lifecycle)

**Files:**
- Create: `src/core/mcp/ServerManager.ts`
- Test: `src/core/mcp/ServerManager.test.ts`

**Test:**
```typescript
test("ServerManager can spawn and stop servers", async () => {
  const manager = new ServerManager();
  const config: McpServer = {
    id: "test",
    name: "test-server",
    command: "node",
    args: ["mock-server.js"],
    enabled: true
  };
  
  const client = await manager.start(config);
  expect(client).toBeDefined();
  expect(await client.ping()).toBe(true);
  
  await manager.stop("test-server");
  expect(manager.isRunning("test-server")).toBe(false);
});
```

---

#### Task 5: MCP Registry

**Files:**
- Create: `src/core/mcp/Registry.ts`
- Test: `src/core/mcp/Registry.test.ts`

**Test:**
```typescript
test("Registry can install MCP from npm", async () => {
  const registry = new Registry();
  
  await registry.install("@modelcontextprotocol/server-filesystem");
  
  const installed = await registry.listInstalled();
  expect(installed.some(s => s.name === "filesystem")).toBe(true);
});

test("Registry can enable/disable MCP", async () => {
  const registry = new Registry();
  await registry.install("@test/server");
  
  await registry.disable("test-server");
  expect((await registry.get("test-server"))?.enabled).toBe(false);
  
  await registry.enable("test-server");
  expect((await registry.get("test-server"))?.enabled).toBe(true);
});
```

---

#### Task 6: MCP ToolProvider (AI Integration)

**Files:**
- Create: `src/core/mcp/ToolProvider.ts`
- Test: `src/core/mcp/ToolProvider.test.ts`

**Test:**
```typescript
test("ToolProvider aggregates tools from all enabled MCPs", async () => {
  const provider = new ToolProvider();
  const tools = await provider.getAvailableTools();
  
  expect(Array.isArray(tools)).toBe(true);
  // Should include tools from filesystem, github, etc.
});

test("ToolProvider can execute a tool", async () => {
  const provider = new ToolProvider();
  const result = await provider.executeTool({
    mcpSource: "filesystem",
    name: "read_file",
    args: { path: "README.md" }
  });
  
  expect(result).toBeDefined();
});
```

---

### **Phase 2: CLI Commands (10 tasks)**

#### Task 7: `nooa mcp install`

**Files:**
- Create: `src/features/mcp/install.ts`
- Test: `src/features/mcp/install.test.ts`

**Test:**
```typescript
test("mcp install --help shows usage", async () => {
  const { stdout } = await execa("bun", ["index.ts", "mcp", "install", "--help"]);
  expect(stdout).toContain("Usage:");
  expect(stdout).toContain("nooa mcp install");
});

test("mcp install validates package name", async () => {
  const result = await execa("bun", ["index.ts", "mcp", "install"], { reject: false });
  expect(result.exitCode).toBe(2);
  expect(result.stderr).toContain("Package name required");
});
```

**CLI Usage:**
```bash
nooa mcp install @modelcontextprotocol/server-filesystem
nooa mcp install @modelcontextprotocol/server-github --env GITHUB_TOKEN=xxx
nooa mcp install ./my-local-mcp
nooa mcp install git+https://github.com/user/mcp-server.git
```

---

#### Task 8: `nooa mcp list`

**Files:**
- Create: `src/features/mcp/list.ts`
- Test: `src/features/mcp/list.test.ts`

**Test:**
```typescript
test("mcp list --installed shows installed MCPs", async () => {
  const { stdout } = await execa("bun", ["index.ts", "mcp", "list", "--installed"]);
  expect(stdout).toContain("filesystem");
});

test("mcp list --enabled shows only enabled MCPs with tools", async () => {
  const { stdout } = await execa("bun", ["index.ts", "mcp", "list", "--enabled"]);
  expect(stdout).toContain("Tools:");
});
```

**CLI Usage:**
```bash
nooa mcp list                # Default: enabled MCPs with tools
nooa mcp list --installed    # All installed MCPs
nooa mcp list --enabled      # Only enabled MCPs
nooa mcp list --available    # MCPs available in registry
nooa mcp list --json         # JSON output
```

---

#### Task 9: `nooa mcp enable/disable`

**Files:**
- Create: `src/features/mcp/enable.ts`
- Create: `src/features/mcp/disable.ts`
- Test: `src/features/mcp/enable.test.ts`

**CLI Usage:**
```bash
nooa mcp enable filesystem
nooa mcp disable github
```

---

#### Task 10: `nooa mcp call`

**Files:**
- Create: `src/features/mcp/call.ts`
- Test: `src/features/mcp/call.test.ts`

**CLI Usage:**
```bash
nooa mcp call filesystem read_file --path README.md
nooa mcp call github create_issue --title "Bug" --body "Description"
nooa mcp call filesystem list_directory --path src/ --json
```

---

#### Task 11: `nooa mcp resource`

**Files:**
- Create: `src/features/mcp/resource.ts`
- Test: `src/features/mcp/resource.test.ts`

**CLI Usage:**
```bash
nooa mcp resource filesystem file:///workspace/README.md
nooa mcp resource postgres schema://public
```

---

#### Task 12: `nooa mcp info`

**Files:**
- Create: `src/features/mcp/info.ts`
- Test: `src/features/mcp/info.test.ts`

**CLI Usage:**
```bash
nooa mcp info filesystem
# Shows: status, tools, resources, config
```

---

#### Task 13: `nooa mcp configure`

**Files:**
- Create: `src/features/mcp/configure.ts`
- Test: `src/features/mcp/configure.test.ts`

**CLI Usage:**
```bash
nooa mcp configure github --env GITHUB_TOKEN=ghp_xxx
nooa mcp configure filesystem --args /workspace,/home
```

---

#### Task 14: `nooa mcp uninstall`

**Files:**
- Create: `src/features/mcp/uninstall.ts`
- Test: `src/features/mcp/uninstall.test.ts`

**CLI Usage:**
```bash
nooa mcp uninstall github
```

---

#### Task 15: `nooa mcp test`

**Files:**
- Create: `src/features/mcp/test.ts`
- Test: `src/features/mcp/test.test.ts`

**CLI Usage:**
```bash
nooa mcp test filesystem
# Validates: can start, list tools, ping, stop
```

---

#### Task 16: Main MCP CLI

**Files:**
- Create: `src/features/mcp/cli.ts`
- Test: `src/features/mcp/cli.test.ts`

**Test:**
```typescript
test("mcp --help lists all subcommands", async () => {
  const { stdout } = await execa("bun", ["index.ts", "mcp", "--help"]);
  expect(stdout).toContain("install");
  expect(stdout).toContain("list");
  expect(stdout).toContain("enable");
  expect(stdout).toContain("call");
});
```

---

### **Phase 3: Integration (2 tasks)**

#### Task 17: Integrate MCPs with `nooa ai`

**Files:**
- Modify: `src/features/ai/execute.ts`
- Test: `src/features/ai/execute.test.ts`

**Changes:**
- Inject MCP tools into AI context
- Handle MCP tool calls from AI
- Return MCP tool results to AI

**Test:**
```typescript
test("ai command can use MCP tools", async () => {
  // Enable filesystem MCP
  await registry.enable("filesystem");
  
  // Ask AI to read a file using MCP
  const result = await executeAi({
    prompt: "Read the README.md file",
    enableMcp: true
  });
  
  expect(result.toolCalls).toContain("read_file");
});
```

---

#### Task 18: Integrate MCPs with `nooa context`

**Files:**
- Modify: `src/features/context/execute.ts`
- Test: `src/features/context/execute.test.ts`

**Changes:**
- Use MCP resources to fetch context
- Aggregate context from multiple MCPs

---

## ✅ Verification Plan

### Automated Tests
```bash
# Run all MCP tests
bun test src/core/mcp/
bun test src/features/mcp/

# Full test suite
bun test
```

### Integration Tests
```bash
# Install real MCP
nooa mcp install @modelcontextprotocol/server-filesystem

# Verify installation
nooa mcp list --installed | grep filesystem

# Enable it
nooa mcp enable filesystem

# Test tool call
nooa mcp call filesystem list_directory --path . --json

# Test with AI
nooa ai "List files in the current directory using filesystem MCP"
```

### Manual Verification

1. **Install workflow:**
   ```bash
   nooa mcp install @modelcontextprotocol/server-filesystem
   nooa mcp info filesystem
   ```

2. **Enable/Disable:**
   ```bash
   nooa mcp disable filesystem
   nooa mcp list --enabled  # Should not show filesystem
   nooa mcp enable filesystem
   nooa mcp list --enabled  # Should show filesystem
   ```

3. **Tool execution:**
   ```bash
   echo "test content" > test.txt
   nooa mcp call filesystem read_file --path test.txt
   # Should output "test content"
   ```

4. **AI integration:**
   ```bash
   nooa ai "Read test.txt file" --enable-mcp
   # AI should use filesystem MCP to read the file
   ```

---

## 📊 Summary

- **Total tasks:** 18 TDD tasks
- **New files:** ~36 files (18 implementations + 18 tests)
- **CLI commands:** 10+ subcommands
- **Coverage:** Core infrastructure + Complete CLI + Integration

This plan covers **100%** of the requirements for MCP integration, versus ~10% of the previous plan.
