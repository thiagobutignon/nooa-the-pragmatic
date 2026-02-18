# Phase 0: ToolResult Dual-Output + Security Foundation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Criar o alicerce do sistema agentic: `ToolResult` dual-output, dangerous command blocklist, e atomic saves — sem quebrar nenhuma feature existente.

**Architecture:** Introduzir `ToolResult` como type central para retorno de ferramentas do agente. Cada tool retorna `forLlm` (contexto técnico) + `forUser` (mensagem limpa) + `silent` + `async`. Adicionar blocklist de comandos perigosos no core. Hardening de persistência com atomic saves.

**Tech Stack:** TypeScript, Bun, Zod (validação), bun:test

**Worktree:** `git worktree add ../nooa-phase-0 -b codex/phase-0-tool-result`

---

### Task 1: Criar tipo ToolResult

**Files:**
- Create: `src/runtime/types.ts`
- Test: `src/runtime/types.test.ts`

**Step 1: Criar worktree isolada**

```bash
git worktree add ../nooa-phase-0 -b codex/phase-0-tool-result
cd ../nooa-phase-0
```

**Step 2: Escrever o teste que falha**

```typescript
// src/runtime/types.test.ts
import { describe, expect, it } from "bun:test";
import {
  type ToolResult,
  silentResult,
  errorResult,
  asyncResult,
  userResult,
  toolResult,
} from "./types";

describe("ToolResult", () => {
  it("creates basic result with forLlm only", () => {
    const r = toolResult("File read: 42 lines");
    expect(r.forLlm).toBe("File read: 42 lines");
    expect(r.forUser).toBeUndefined();
    expect(r.silent).toBe(false);
    expect(r.async).toBe(false);
    expect(r.isError).toBe(false);
  });

  it("creates silent result", () => {
    const r = silentResult("Config saved");
    expect(r.forLlm).toBe("Config saved");
    expect(r.silent).toBe(true);
  });

  it("creates error result", () => {
    const r = errorResult("File not found", new Error("ENOENT"));
    expect(r.isError).toBe(true);
    expect(r.error?.message).toBe("ENOENT");
  });

  it("creates async result", () => {
    const r = asyncResult("Subagent spawned");
    expect(r.async).toBe(true);
  });

  it("creates user-facing result", () => {
    const r = userResult("Found 42 files matching query");
    expect(r.forLlm).toBe("Found 42 files matching query");
    expect(r.forUser).toBe("Found 42 files matching query");
    expect(r.silent).toBe(false);
  });
});
```

**Step 3: Rodar teste para verificar que falha**

Run: `bun test src/runtime/types.test.ts`
Expected: FAIL — `Cannot find module "./types"`

**Step 4: Implementar tipo ToolResult e factories**

```typescript
// src/runtime/types.ts
export interface ToolResult {
  /** Conteúdo enviado ao LLM para raciocínio (sempre presente) */
  forLlm: string;
  /** Conteúdo enviado ao usuário (opcional, silenciado se silent=true) */
  forUser?: string;
  /** Suprime mensagem ao usuário */
  silent: boolean;
  /** Indica erro na execução */
  isError: boolean;
  /** Indica execução assíncrona em background */
  async: boolean;
  /** Erro interno (não serializado) */
  error?: Error;
}

/** Resultado básico — só para o LLM */
export function toolResult(forLlm: string): ToolResult {
  return { forLlm, silent: false, isError: false, async: false };
}

/** Resultado silencioso — LLM vê, usuário não */
export function silentResult(forLlm: string): ToolResult {
  return { forLlm, silent: true, isError: false, async: false };
}

/** Resultado de erro */
export function errorResult(forLlm: string, error?: Error): ToolResult {
  return { forLlm, silent: false, isError: true, async: false, error };
}

/** Resultado assíncrono — task rodando em background */
export function asyncResult(forLlm: string): ToolResult {
  return { forLlm, silent: false, isError: false, async: true };
}

/** Resultado com output para o usuário */
export function userResult(content: string): ToolResult {
  return { forLlm: content, forUser: content, silent: false, isError: false, async: false };
}
```

**Step 5: Rodar teste para verificar que passa**

Run: `bun test src/runtime/types.test.ts`
Expected: PASS (5 tests)

**Step 6: Rodar lint**

Run: `bun run check`
Expected: Sem erros

**Step 7: Commit**

```bash
git add src/runtime/types.ts src/runtime/types.test.ts
git commit -m "feat(runtime): add ToolResult dual-output type with factory functions"
```

---

### Task 2: Criar DangerousCommandGuard

**Files:**
- Create: `src/runtime/security/command-guard.ts`
- Test: `src/runtime/security/command-guard.test.ts`

**Step 1: Escrever o teste que falha**

```typescript
// src/runtime/security/command-guard.test.ts
import { describe, expect, it } from "bun:test";
import { DangerousCommandGuard } from "./command-guard";

describe("DangerousCommandGuard", () => {
  const guard = new DangerousCommandGuard();

  describe("blocks destructive commands", () => {
    it.each([
      ["rm -rf /", "bulk deletion"],
      ["rm -rf ~", "home deletion"],
      ["sudo rm -rf /var", "sudo deletion"],
      ["format C:", "disk format"],
      ["mkfs.ext4 /dev/sda", "filesystem create"],
      ["dd if=/dev/zero of=/dev/sda", "disk image"],
      [":(){ :|:& };:", "fork bomb"],
      ["shutdown -h now", "system shutdown"],
      ["reboot", "system reboot"],
      ["poweroff", "system poweroff"],
    ])("blocks: %s (%s)", (cmd) => {
      const result = guard.check(cmd);
      expect(result.blocked).toBe(true);
      expect(result.reason).toBeDefined();
    });
  });

  describe("allows safe commands", () => {
    it.each([
      ["ls -la", "list files"],
      ["cat README.md", "read file"],
      ["bun test", "run tests"],
      ["git status", "git status"],
      ["echo hello", "echo"],
      ["bun run check", "lint check"],
      ["npm install", "npm install"],
    ])("allows: %s (%s)", (cmd) => {
      const result = guard.check(cmd);
      expect(result.blocked).toBe(false);
    });
  });

  it("provides human-readable reason for blocked commands", () => {
    const result = guard.check("rm -rf /");
    expect(result.reason).toContain("rm -rf");
  });
});
```

**Step 2: Rodar teste para verificar que falha**

Run: `bun test src/runtime/security/command-guard.test.ts`
Expected: FAIL — `Cannot find module "./command-guard"`

**Step 3: Implementar DangerousCommandGuard**

```typescript
// src/runtime/security/command-guard.ts
export interface GuardResult {
  blocked: boolean;
  reason?: string;
}

interface DangerousPattern {
  pattern: RegExp;
  description: string;
}

const DANGEROUS_PATTERNS: DangerousPattern[] = [
  { pattern: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--recursive\s+--force|-[a-zA-Z]*f[a-zA-Z]*r)\b/i, description: "Recursive force delete (rm -rf)" },
  { pattern: /\brm\s+-[a-zA-Z]*r[a-zA-Z]*\s+[\/~]/i, description: "Recursive delete from root/home" },
  { pattern: /\bformat\s+[A-Z]:/i, description: "Disk format (Windows)" },
  { pattern: /\bmkfs\b/i, description: "Filesystem create (mkfs)" },
  { pattern: /\bdiskpart\b/i, description: "Disk partition tool" },
  { pattern: /\bdd\s+if=/i, description: "Disk image/write (dd)" },
  { pattern: /\/dev\/sd[a-z]/i, description: "Direct disk device access" },
  { pattern: /:\(\)\{\s*:\|:&\s*\};:/i, description: "Fork bomb" },
  { pattern: /\bshutdown\b/i, description: "System shutdown" },
  { pattern: /\breboot\b/i, description: "System reboot" },
  { pattern: /\bpoweroff\b/i, description: "System poweroff" },
  { pattern: /\bdel\s+\/[fF]\b/i, description: "Force delete (Windows)" },
  { pattern: /\brmdir\s+\/[sS]\b/i, description: "Recursive directory removal (Windows)" },
];

export class DangerousCommandGuard {
  check(command: string): GuardResult {
    for (const { pattern, description } of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        return { blocked: true, reason: `Blocked: ${description} — "${command}"` };
      }
    }
    return { blocked: false };
  }
}
```

**Step 4: Rodar teste para verificar que passa**

Run: `bun test src/runtime/security/command-guard.test.ts`
Expected: PASS

**Step 5: Rodar lint**

Run: `bun run check`
Expected: Sem erros

**Step 6: Commit**

```bash
git add src/runtime/security/
git commit -m "feat(runtime): add DangerousCommandGuard with blocklist for destructive commands"
```

---

### Task 3: Criar ToolDefinition e ToolRegistry

**Files:**
- Create: `src/runtime/tool-registry.ts`
- Test: `src/runtime/tool-registry.test.ts`

**Step 1: Escrever o teste que falha**

```typescript
// src/runtime/tool-registry.test.ts
import { describe, expect, it } from "bun:test";
import { ToolRegistry } from "./tool-registry";
import type { ToolResult } from "./types";
import { toolResult } from "./types";

describe("ToolRegistry", () => {
  it("registers and retrieves a tool", () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "read_file",
      description: "Read a file",
      parameters: { path: { type: "string", required: true } },
      execute: async () => toolResult("file content"),
    });

    const tool = registry.get("read_file");
    expect(tool).toBeDefined();
    expect(tool?.name).toBe("read_file");
  });

  it("executes a tool and returns ToolResult", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "echo",
      description: "Echo back input",
      parameters: { text: { type: "string", required: true } },
      execute: async (args) => toolResult(`Echo: ${args.text}`),
    });

    const result = await registry.execute("echo", { text: "hello" });
    expect(result.forLlm).toBe("Echo: hello");
    expect(result.isError).toBe(false);
  });

  it("returns error for unknown tool", async () => {
    const registry = new ToolRegistry();
    const result = await registry.execute("nonexistent", {});
    expect(result.isError).toBe(true);
    expect(result.forLlm).toContain("nonexistent");
  });

  it("lists all registered tools", () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "tool_a",
      description: "A",
      parameters: {},
      execute: async () => toolResult("a"),
    });
    registry.register({
      name: "tool_b",
      description: "B",
      parameters: {},
      execute: async () => toolResult("b"),
    });

    const defs = registry.listDefinitions();
    expect(defs).toHaveLength(2);
    expect(defs.map((d) => d.name)).toContain("tool_a");
    expect(defs.map((d) => d.name)).toContain("tool_b");
  });

  it("generates tool definitions for LLM prompt", () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "search",
      description: "Search files",
      parameters: { query: { type: "string", required: true } },
      execute: async () => toolResult("results"),
    });

    const schema = registry.toToolSchema();
    expect(schema).toHaveLength(1);
    expect(schema[0].type).toBe("function");
    expect(schema[0].function.name).toBe("search");
  });
});
```

**Step 2: Rodar teste para verificar que falha**

Run: `bun test src/runtime/tool-registry.test.ts`
Expected: FAIL

**Step 3: Implementar ToolRegistry**

```typescript
// src/runtime/tool-registry.ts
import { type ToolResult, errorResult } from "./types";

export interface ToolParam {
  type: "string" | "number" | "boolean";
  required?: boolean;
  description?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParam>;
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description?: string }>;
      required: string[];
    };
  };
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return errorResult(`Tool not found: ${name}`);
    }
    try {
      return await tool.execute(args);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      return errorResult(`Tool "${name}" failed: ${error.message}`, error);
    }
  }

  listDefinitions(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  toToolSchema(): ToolSchema[] {
    return this.listDefinitions().map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object" as const,
          properties: Object.fromEntries(
            Object.entries(tool.parameters).map(([key, param]) => [
              key,
              { type: param.type, description: param.description },
            ]),
          ),
          required: Object.entries(tool.parameters)
            .filter(([, p]) => p.required)
            .map(([k]) => k),
        },
      },
    }));
  }
}
```

**Step 4: Rodar teste para verificar que passa**

Run: `bun test src/runtime/tool-registry.test.ts`
Expected: PASS (5 tests)

**Step 5: Rodar lint e todos os testes**

Run: `bun run check && bun run linter && bun test`
Expected: Sem erros, todos os testes passam

**Step 6: Commit**

```bash
git add src/runtime/tool-registry.ts src/runtime/tool-registry.test.ts
git commit -m "feat(runtime): add ToolRegistry with execute, list, and LLM schema generation"
```

---

### Task 4: Integrar DangerousCommandGuard no ToolRegistry

**Files:**
- Modify: `src/runtime/tool-registry.ts`
- Test: `src/runtime/tool-registry.test.ts` (adicionar testes)

**Step 1: Adicionar teste para guard integration**

Adicionar ao `src/runtime/tool-registry.test.ts`:

```typescript
describe("ToolRegistry with DangerousCommandGuard", () => {
  it("blocks dangerous commands in exec-like tools", async () => {
    const registry = new ToolRegistry({ enableCommandGuard: true });
    registry.register({
      name: "exec",
      description: "Execute shell command",
      parameters: { command: { type: "string", required: true } },
      execute: async (args) => toolResult(`Executed: ${args.command}`),
      isShellTool: true,
    });

    const result = await registry.execute("exec", { command: "rm -rf /" });
    expect(result.isError).toBe(true);
    expect(result.forLlm).toContain("Blocked");
  });

  it("allows safe commands through guard", async () => {
    const registry = new ToolRegistry({ enableCommandGuard: true });
    registry.register({
      name: "exec",
      description: "Execute shell command",
      parameters: { command: { type: "string", required: true } },
      execute: async (args) => toolResult(`Executed: ${args.command}`),
      isShellTool: true,
    });

    const result = await registry.execute("exec", { command: "ls -la" });
    expect(result.isError).toBe(false);
  });
});
```

**Step 2: Rodar teste para verificar que falha**

Run: `bun test src/runtime/tool-registry.test.ts`
Expected: FAIL — propriedades novas não existem

**Step 3: Modificar ToolRegistry para integrar guard**

Adicionar `isShellTool` a `ToolDefinition`, `enableCommandGuard` ao construtor, e guard check no `execute`.

**Step 4: Rodar teste para verificar que passa**

Run: `bun test src/runtime/tool-registry.test.ts`
Expected: PASS

**Step 5: Rodar lint e todos os testes**

Run: `bun run check && bun run linter && bun test`
Expected: Sem erros

**Step 6: Commit**

```bash
git add src/runtime/tool-registry.ts src/runtime/tool-registry.test.ts
git commit -m "feat(runtime): integrate DangerousCommandGuard into ToolRegistry"
```

---

### Task 5: Verificação final de Phase 0

**Step 1: Rodar todos os testes**

Run: `bun test`
Expected: Todos passam, incluindo testes existentes e novos.

**Step 2: Rodar check**

Run: `bun run check`
Expected: Sem erros.

**Step 3: Rodar linter explícito (dogfooding)**

Run: `bun run linter`
Expected: Sem erros.

**Step 4: Verificar coverage dos novos ficheiros**

Run: `bun test --coverage src/runtime/`
Expected: >90% coverage nos novos arquivos.

**Step 5: Verificar que features existentes não quebraram**

Run: `bun test src/features/ src/core/`
Expected: Todos passam como antes.
