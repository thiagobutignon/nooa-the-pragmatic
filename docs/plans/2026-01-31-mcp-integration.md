# MCP Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate the Model Context Protocol (MCP) to allow NOOA to consume resources and tools from MCP servers.

**Architecture:** A `McpClient` will handle JSON-RPC communication with stdio-based MCP servers, exposing discovery and tool invocation primitives.

**Tech Stack:** Bun, TypeScript, Node.js subprocesses.

---

### Task 1: Basic MCP Client (Stdio)

**Files:**
- Create: `src/core/mcp/Client.ts`
- Test: `src/core/mcp/Client.test.ts`

**Step 1: Write the failing test**

```typescript
import { expect, test, describe } from "bun:test";
import { McpClient } from "./Client";

describe("McpClient", () => {
    test("can initialize and send a sample request", async () => {
        // Mock server would be needed for full integration test
        const client = new McpClient("echo-server");
        expect(client).toBeDefined();
    });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/core/mcp/Client.test.ts`
Expected: FAIL (Cannot find module './Client')

**Step 3: Write minimal implementation**

```typescript
// src/core/mcp/Client.ts
import { spawn } from "node:child_process";

export class McpClient {
    constructor(private command: string) {}
    
    // Future implementation: JSON-RPC over stdio
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/core/mcp/Client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/mcp/
git commit -m "feat: skeleton for MCP client"
```

---

### Task 2: Listing MCP Tools

**Files:**
- Modify: `src/core/mcp/Client.ts`
- Test: `src/core/mcp/Client.test.ts`

**Step 1: Write the failing test**

```typescript
test("listTools returns a list of tools available on the server", async () => {
    const client = new McpClient("example-server");
    const tools = await client.listTools();
    expect(Array.isArray(tools)).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/core/mcp/Client.test.ts`
Expected: FAIL (client.listTools is not a function)

**Step 3: Write minimal implementation**

```typescript
// src/core/mcp/Client.ts
export class McpClient {
    constructor(private command: string) {}
    
    async listTools(): Promise<any[]> {
        return []; // Stub for now
    }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/core/mcp/Client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/mcp/Client.ts
git commit -m "feat: add listTools stub to McpClient"
```
