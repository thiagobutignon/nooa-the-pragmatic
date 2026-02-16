# Phase 1: Agent Runtime Kernel

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Criar o kernel do runtime agentico: session manager, context builder, agent loop iterativo com tool calls, e o comando `nooa agent`.

**Architecture:** O Agent Runtime é um loop iterativo que: (1) monta contexto (system prompt + history + memory), (2) chama o LLM, (3) executa tool calls, (4) persiste sessão. O loop depende de uma interface `AgentModelProvider` (`generate -> { content, toolCalls }`). A integração com o `AiEngine` existente ocorre via adapter (`AiEngineAgentProvider`) para manter compatibilidade com `complete(...)` e evoluir tool-calling sem quebrar features existentes. `ToolRegistry` vem da Phase 0.

**Tech Stack:** TypeScript, Bun, AgentModelProvider + AiEngineAgentProvider (bridge para AiEngine existente), ToolRegistry (Phase 0), bun:test

**Worktree:** `git worktree add ../nooa-phase-1 -b codex/phase-1-agent-runtime`

**Dependência:** Phase 0 concluída e mergeada em main.

---

### Task 1: Session Manager com persistência atômica

**Files:**
- Create: `src/runtime/session/manager.ts`
- Test: `src/runtime/session/manager.test.ts`

**Step 1: Criar worktree**

```bash
git worktree add ../nooa-phase-1 -b codex/phase-1-agent-runtime
cd ../nooa-phase-1
```

**Step 2: Escrever teste que falha**

```typescript
// src/runtime/session/manager.test.ts
import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { SessionManager } from "./manager";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("SessionManager", () => {
  let tmpDir: string;
  let manager: SessionManager;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "nooa-session-"));
    manager = new SessionManager(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("creates a new session", () => {
    const session = manager.getOrCreate("cli:direct");
    expect(session.key).toBe("cli:direct");
    expect(session.messages).toHaveLength(0);
  });

  it("returns existing session", () => {
    const s1 = manager.getOrCreate("cli:direct");
    manager.addMessage("cli:direct", "user", "hello");
    const s2 = manager.getOrCreate("cli:direct");
    expect(s2.messages).toHaveLength(1);
  });

  it("adds messages to session", () => {
    manager.getOrCreate("test:1");
    manager.addMessage("test:1", "user", "hello");
    manager.addMessage("test:1", "assistant", "hi there");
    const history = manager.getHistory("test:1");
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe("user");
    expect(history[1].role).toBe("assistant");
  });

  it("saves and loads sessions (atomic)", async () => {
    manager.getOrCreate("persist:test");
    manager.addMessage("persist:test", "user", "remember me");
    await manager.save("persist:test");

    const manager2 = new SessionManager(tmpDir);
    const history = manager2.getHistory("persist:test");
    expect(history).toHaveLength(1);
    expect(history[0].content).toBe("remember me");
  });

  it("truncates history keeping last N", () => {
    manager.getOrCreate("trunc:test");
    for (let i = 0; i < 10; i++) {
      manager.addMessage("trunc:test", "user", `msg ${i}`);
    }
    manager.truncateHistory("trunc:test", 3);
    const history = manager.getHistory("trunc:test");
    expect(history).toHaveLength(3);
    expect(history[0].content).toBe("msg 7");
  });

  it("manages summary", () => {
    manager.getOrCreate("sum:test");
    manager.setSummary("sum:test", "User likes TypeScript");
    expect(manager.getSummary("sum:test")).toBe("User likes TypeScript");
  });
});
```

**Step 3: Rodar teste para verificar que falha**

Run: `bun test src/runtime/session/manager.test.ts`
Expected: FAIL

**Step 4: Implementar SessionManager**

```typescript
// src/runtime/session/manager.ts
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCallId?: string;
}

export interface Session {
  key: string;
  messages: Message[];
  summary?: string;
  created: string;
  updated: string;
}

export class SessionManager {
  private sessions = new Map<string, Session>();
  private storage: string;

  constructor(storage: string) {
    this.storage = storage;
    if (!existsSync(storage)) mkdirSync(storage, { recursive: true });
    this.load();
  }

  getOrCreate(key: string): Session {
    const existing = this.sessions.get(key);
    if (existing) return existing;
    const session: Session = {
      key,
      messages: [],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
    this.sessions.set(key, session);
    return session;
  }

  addMessage(sessionKey: string, role: Message["role"], content: string): void {
    const session = this.getOrCreate(sessionKey);
    session.messages.push({ role, content });
    session.updated = new Date().toISOString();
  }

  getHistory(key: string): Message[] {
    const session = this.sessions.get(key);
    if (!session) return [];
    return [...session.messages];
  }

  getSummary(key: string): string | undefined {
    return this.sessions.get(key)?.summary;
  }

  setSummary(key: string, summary: string): void {
    const session = this.sessions.get(key);
    if (session) {
      session.summary = summary;
      session.updated = new Date().toISOString();
    }
  }

  truncateHistory(key: string, keepLast: number): void {
    const session = this.sessions.get(key);
    if (!session) return;
    if (session.messages.length > keepLast) {
      session.messages = session.messages.slice(-keepLast);
      session.updated = new Date().toISOString();
    }
  }

  async save(key: string): Promise<void> {
    const session = this.sessions.get(key);
    if (!session) return;
    const filename = key.replace(/:/g, "_");
    const filepath = join(this.storage, `${filename}.json`);
    const tmpPath = `${filepath}.tmp`;
    const data = JSON.stringify(session, null, 2);
    writeFileSync(tmpPath, data, "utf-8");
    // Atomic rename
    const { renameSync } = await import("node:fs");
    renameSync(tmpPath, filepath);
  }

  private load(): void {
    if (!existsSync(this.storage)) return;
    for (const file of readdirSync(this.storage)) {
      if (!file.endsWith(".json")) continue;
      try {
        const data = readFileSync(join(this.storage, file), "utf-8");
        const session: Session = JSON.parse(data);
        this.sessions.set(session.key, session);
      } catch {
        // Skip corrupted files
      }
    }
  }
}
```

**Step 5: Rodar teste para verificar que passa**

Run: `bun test src/runtime/session/manager.test.ts`
Expected: PASS (6 tests)

**Step 6: Lint e commit**

Run: `bun run check`

```bash
git add src/runtime/session/
git commit -m "feat(runtime): add SessionManager with atomic persistence and history management"
```

---

### Task 2: Context Builder (SOUL.md + USER.md + memory → system prompt)

**Files:**
- Create: `src/runtime/context/builder.ts`
- Test: `src/runtime/context/builder.test.ts`

**Step 1: Escrever teste que falha**

```typescript
// src/runtime/context/builder.test.ts
import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { ContextBuilder } from "./builder";
import { ToolRegistry } from "../tool-registry";
import { toolResult } from "../types";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("ContextBuilder", () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "nooa-ctx-"));
    await mkdir(join(workspace, ".nooa"), { recursive: true });
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it("builds system prompt from identity files", async () => {
    await writeFile(join(workspace, ".nooa", "SOUL.md"), "Sou pragmático e direto.");
    await writeFile(join(workspace, ".nooa", "USER.md"), "Timezone: BRT. Lingua: pt-BR.");

    const builder = new ContextBuilder(workspace, new ToolRegistry());
    const prompt = await builder.buildSystemPrompt();

    expect(prompt).toContain("Sou pragmático e direto.");
    expect(prompt).toContain("Timezone: BRT");
  });

  it("includes tool definitions in prompt", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "read_file",
      description: "Read a file from disk",
      parameters: { path: { type: "string", required: true } },
      execute: async () => toolResult("content"),
    });

    const builder = new ContextBuilder(workspace, registry);
    const prompt = await builder.buildSystemPrompt();

    expect(prompt).toContain("read_file");
    expect(prompt).toContain("Read a file from disk");
  });

  it("includes summary if provided", async () => {
    const builder = new ContextBuilder(workspace, new ToolRegistry());
    const prompt = await builder.buildSystemPrompt("User prefers TypeScript.");
    expect(prompt).toContain("User prefers TypeScript.");
  });

  it("builds full messages array", async () => {
    const builder = new ContextBuilder(workspace, new ToolRegistry());
    const messages = await builder.buildMessages(
      [{ role: "user", content: "hello" }],
      "what is 2+2?",
      undefined,
    );

    expect(messages[0].role).toBe("system");
    expect(messages[messages.length - 1].content).toBe("what is 2+2?");
  });
});
```

**Step 2: Rodar teste para verificar que falha**

Run: `bun test src/runtime/context/builder.test.ts`
Expected: FAIL

**Step 3: Implementar ContextBuilder**

O `ContextBuilder` lê `.nooa/SOUL.md`, `.nooa/USER.md`, `.nooa/AGENT.md`, `.nooa/IDENTITY.md`, monta seções de tools e memory, e junta tudo num system prompt.

**Step 4: Rodar e verificar**

Run: `bun test src/runtime/context/builder.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/runtime/context/
git commit -m "feat(runtime): add ContextBuilder with identity files and tool definitions"
```

---

### Task 3: Agent Loop (loop iterativo LLM + tool calls)

**Files:**
- Create: `src/runtime/agent/loop.ts`
- Test: `src/runtime/agent/loop.test.ts`

**Step 1: Escrever teste que falha**

```typescript
// src/runtime/agent/loop.test.ts
import { describe, expect, it, mock } from "bun:test";
import { AgentLoop } from "./loop";
import { ToolRegistry } from "../tool-registry";
import { SessionManager } from "../session/manager";
import { toolResult } from "../types";

describe("AgentLoop", () => {
  it("processes a simple message (no tool calls)", async () => {
    const mockProvider = {
      generate: mock(async () => ({
        content: "Hello! I'm NOOA.",
        toolCalls: [],
      })),
    };

    const registry = new ToolRegistry();
    const sessions = new SessionManager("");

    const loop = new AgentLoop({
      provider: mockProvider,
      tools: registry,
      sessions,
      workspace: "/tmp/test",
      maxIterations: 5,
    });

    const result = await loop.processMessage("cli:direct", "Hello!");
    expect(result.forLlm).toContain("Hello! I'm NOOA.");
    expect(mockProvider.generate).toHaveBeenCalledTimes(1);
  });

  it("executes tool calls and iterates", async () => {
    let callCount = 0;
    const mockProvider = {
      generate: mock(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            content: "",
            toolCalls: [{ id: "call_1", name: "echo", arguments: { text: "test" } }],
          };
        }
        return { content: "Done! Echo returned: test", toolCalls: [] };
      }),
    };

    const registry = new ToolRegistry();
    registry.register({
      name: "echo",
      description: "Echo text",
      parameters: { text: { type: "string", required: true } },
      execute: async (args) => toolResult(`Echo: ${args.text}`),
    });

    const sessions = new SessionManager("");
    const loop = new AgentLoop({
      provider: mockProvider,
      tools: registry,
      sessions,
      workspace: "/tmp/test",
      maxIterations: 5,
    });

    const result = await loop.processMessage("cli:direct", "echo test");
    expect(mockProvider.generate).toHaveBeenCalledTimes(2);
    expect(result.forLlm).toContain("Done!");
  });

  it("stops after maxIterations", async () => {
    const mockProvider = {
      generate: mock(async () => ({
        content: "",
        toolCalls: [{ id: "call_1", name: "loop_forever", arguments: {} }],
      })),
    };

    const registry = new ToolRegistry();
    registry.register({
      name: "loop_forever",
      description: "Never ends",
      parameters: {},
      execute: async () => toolResult("again"),
    });

    const sessions = new SessionManager("");
    const loop = new AgentLoop({
      provider: mockProvider,
      tools: registry,
      sessions,
      workspace: "/tmp/test",
      maxIterations: 3,
    });

    const result = await loop.processMessage("cli:direct", "loop");
    expect(result.isError).toBe(true);
    expect(result.forLlm).toContain("max");
  });
});
```

**Step 2: Rodar para verificar falha, implementar, verificar que passa**

Run: `bun test src/runtime/agent/loop.test.ts`

**Step 3: Implementar AgentLoop**

O `AgentLoop` segue o padrão (recebendo `provider.generate(...)` via `AgentModelProvider`):
1. `getOrCreate` session
2. Build messages via ContextBuilder
3. Loop: call LLM → if tool calls → execute tools → append results → repeat
4. Break on: no tool calls, or maxIterations
5. Save session

**Step 4: Commit**

```bash
git add src/runtime/agent/
git commit -m "feat(runtime): add AgentLoop with iterative LLM tool execution"
```

---

### Task 4: Comando `nooa agent`

**Files:**
- Create: `src/features/agent/cli.ts`
- Create: `src/features/agent/engine.ts`
- Test: `src/features/agent/cli.test.ts`

**Step 1: Escrever teste**

```typescript
// src/features/agent/cli.test.ts
import { describe, expect, it } from "bun:test";

describe("Agent CLI", () => {
  it("exports a command with name 'agent'", async () => {
    const mod = await import("./cli");
    expect(mod.default.name).toBe("agent");
  });

  it("has help text mentioning agentic loop", async () => {
    const mod = await import("./cli");
    const help = mod.default.help;
    expect(help).toContain("agent");
  });
});
```

**Step 2: Implementar CLI usando CommandBuilder**

O `nooa agent "mensagem"` abre uma sessão interativa usando o AgentLoop.

**Step 3: Rodar lint e testes**

Run: `bun run check && bun run linter && bun test`

**Step 4: Commit**

```bash
git add src/features/agent/
git commit -m "feat(agent): add nooa agent command with interactive agentic session"
```

---

### Task 5: Adapter AiEngine -> AgentModelProvider (CLI-first, sem TUI)

**Files:**
- Create: `src/runtime/agent/provider.ts`
- Test: `src/runtime/agent/provider.test.ts`
- Modify: `src/features/agent/engine.ts`

**Step 1: Criar adapter de compatibilidade**

Criar `AiEngineAgentProvider` que usa `AiEngine.complete(...)` e expõe contrato do runtime:

```typescript
interface AgentModelProvider {
  generate(input: { messages: { role: string; content: string }[] }): Promise<{
    content: string;
    toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  }>;
}
```

No modo inicial, mapear resposta para `toolCalls: []` quando o provider subjacente não suportar tool-calling nativo.

**Step 2: Integrar adapter no fluxo do `nooa agent`**

`src/features/agent/engine.ts` deve construir `AgentLoop` usando esse adapter como provider default.

**Step 3: Commit**

```bash
git add src/runtime/agent/provider.ts src/runtime/agent/provider.test.ts src/features/agent/engine.ts
git commit -m "feat(runtime): add AiEngineAgentProvider bridge for AgentLoop"
```

---

### Task 6: Verificação final de Phase 1

**Step 1:** `bun test` — todos passam
**Step 2:** `bun run check` — sem erros
**Step 3:** `bun run linter` — sem erros (dogfooding)
**Step 4:** `bun test --coverage src/runtime/` — >80%
**Step 5:** `bun index.ts agent --help` — mostra help
**Step 6:** Verificar features existentes não quebraram: `bun test src/features/ src/core/`
