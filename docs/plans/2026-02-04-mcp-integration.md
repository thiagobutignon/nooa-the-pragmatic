# MCP Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a minimal MCP (Model Context Protocol) client so NOOA can later exchange JSON-RPC messages with MCP engines, starting with the skeleton and a stubbed tool list.

**Architecture:** A `McpClient` class will manage stdio-based MCP subprocesses and expose discovery helpers. We start with a lightweight synchronous client that can be constructed and asked for its available tools; future iterations will extend it to stream JSON-RPC messages over stdio.

**Tech Stack:** Bun + TypeScript, node child_process spawn, Bun test harness.

### Task 1: add `McpClient` skeleton with constructor test

**Files:**
- Create: `src/core/mcp/Client.ts`
- Create: `src/core/mcp/Client.test.ts`

**Step 1: Write the failing test**
```ts
import { describe, expect, test } from "bun:test";
import { McpClient } from "./Client";

describe("McpClient", () => {
	test("can be created with a command name", () => {
		const client = new McpClient("echo");
		expect(client).toBeInstanceOf(McpClient);
	});
});
```

**Step 2: Run it and see the failure**
```
bun test src/core/mcp/Client.test.ts
```
Expected: FAIL because `McpClient` module doesn't exist yet.

**Step 3: Implement the minimal client**
```ts
export class McpClient {
	constructor(private command: string) {}
}
```

**Step 4: Run the test again**
```
bun test src/core/mcp/Client.test.ts
```
Expected: PASS.

### Task 2: add listTools stub to the client

**Files:**
- Modify: `src/core/mcp/Client.ts`
- Modify: `src/core/mcp/Client.test.ts`

**Step 1: Add a new test case**
```ts
test("listTools returns an array", async () => {
	const client = new McpClient("echo");
	const tools = await client.listTools();
	expect(Array.isArray(tools)).toBe(true);
});
```

**Step 2: Run the test and observe the new failure**
```
bun test src/core/mcp/Client.test.ts
```
Expected: FAIL because `listTools` is not implemented.

**Step 3: Implement `listTools` stub**
```ts
async listTools(): Promise<{ name: string; description?: string }[]> {
	return [];
}
```

**Step 4: Run the test again**
```
bun test src/core/mcp/Client.test.ts
```
Expected: PASS.

### Task 3: document usage placeholder

**Files:**
- Modify: `docs/commands/ai.md` (or create a short note) to mention MCP client exists.

**Step:** Briefly mention the new `McpClient` stub and that the plan is to wire it into AI commands once MCP servers are available.

### Task 4: Sanity checks and cleanup

**Step:** Run `bun check` to ensure no type issues.

```
bun check
```

Plan complete and saved to `docs/plans/2026-02-04-mcp-integration.md`. Two execution options:

1. **Subagent-Driven (this session)** – continue here using `superpowers:subagent-driven-development` with per-task reviews.
2. **Parallel Session** – open a new session and use `superpowers:executing-plans`.

Which approach should I take for implementation?
