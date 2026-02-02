# MCP Integration - Complete Implementation Plan

> **For Claude:** Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` to implement this plan task-by-task.

## 🎯 Objetivo

**Habilitar agente + usuário para descobrir, instalar, configurar e executar MCPs (Model Context Protocol servers)**

Isso significa:
1. ✅ **Descobrir** MCPs disponíveis (registry + installed + enabled)
2. ✅ **Instalar** MCP servers (npm, git, local)
3. ✅ **Configurar** quais MCPs usar e suas settings
4. ✅ **Executar** tools/resources/prompts dos MCPs
5. ✅ **Integrar** MCPs com comandos existentes do NOOA (ai, context, fix)

---

## 📐 Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                       NOOA Commands                          │
│  (nooa ai, nooa context, nooa fix, ...)                     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  MCP Tool Provider                           │
│         Injeta MCP tools no AI context                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCP Registry                              │
│  Gerencia: install, enable, configure, list                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  MCP Client (JSON-RPC)          │
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

## 📦 Estrutura de Arquivos

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

## 🗄️ Configuração Persistente

### Schema SQLite (`mcp_servers` table)

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

---

## 📋 Tasks TDD (Estimativa: 18 tasks)

### **Fase 1: Core Infrastructure (6 tasks)**

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

---

#### Task 2: MCP ConfigStore (SQLite)

**Files:**
- Create: `src/core/db/schema/mcp_servers.ts`
- Create: `src/core/mcp/ConfigStore.ts`
- Test: `src/core/mcp/ConfigStore.test.ts`

**Test:**
```typescript
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
});
```

---

#### Task 3: MCP Client (JSON-RPC Stdio)

**Test:**
```typescript
test("McpClient can start and list tools", async () => {
  const client = new McpClient({
    command: "node",
    args: ["./test/fixtures/mock-mcp-server.js"]
  });
  
  await client.start();
  const tools = await client.listTools();
  
  expect(Array.isArray(tools)).toBe(true);
  await client.stop();
});
```

---

#### Task 4-6: ServerManager, Registry, ToolProvider

[Similar TDD patterns for each component]

---

### **Fase 2: CLI Commands (10 tasks)**

#### Task 7: `nooa mcp install`

**CLI Usage:**
```bash
nooa mcp install @modelcontextprotocol/server-filesystem
nooa mcp install ./my-local-mcp
```

---

#### Task 8-16: Demais comandos CLI

[install, list, enable, disable, call, resource, info, configure, uninstall, test]

---

### **Fase 3: Integration (2 tasks)**

#### Task 17-18: Integrate with `nooa ai` and `nooa context`

---

## ✅ Verification Plan

### Automated Tests
```bash
bun test src/core/mcp/
bun test src/features/mcp/
```

### Integration Tests
```bash
nooa mcp install @modelcontextprotocol/server-filesystem
nooa mcp call filesystem list_directory --path .
```

---

## 📊 Resumo

- **Total:** 18 tasks TDD
- **Arquivos:** ~36 (18 impl + 18 tests)
- **Comandos:** 10+ subcommands
- **Cobertura:** 100% dos requisitos
