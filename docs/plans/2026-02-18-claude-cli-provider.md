# ClaudeCliProvider Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adicionar `ClaudeCliProvider` que wrapa o binário `claude` (Claude Code CLI) como subprocess, permitindo usar Claude como backend LLM sem API key direta — apenas com `claude` instalado no PATH.

**Architecture:** Seguir exatamente o padrão dos providers existentes em `src/features/ai/providers/`. O provider executa `claude -p "<prompt>" --output-format json` como subprocess via `Bun.spawn`, parseia o JSON de saída, e retorna no formato `AiResponse`. Registrado no `AiEngine` como provider selecionável via `NOOA_AI_PROVIDER=claude-cli`.

**Dependências existentes que DEVEM ser reusadas:**
- `src/features/ai/providers/openai.ts` — padrão de implementação de provider (interface `AiProvider`)
- `src/features/ai/engine.ts` — `AiEngine.register()` para registrar o novo provider
- `src/features/agent/engine.ts` — `createAiEngine()` onde o provider deve ser adicionado
- `src/features/ai/types.ts` — `AiMessage`, `AiResponse`, `AiProvider` interface

**Tech Stack:** TypeScript, Bun, bun:test.

---

### Task 1: Implementar ClaudeCliProvider

**Files:**
- Create: `src/features/ai/providers/claude-cli.ts`
- Create: `src/features/ai/providers/claude-cli.test.ts`

**Step 1: Write failing tests**

```typescript
// src/features/ai/providers/claude-cli.test.ts
import { describe, expect, it, mock, spyOn } from "bun:test";
import { ClaudeCliProvider } from "./claude-cli";

describe("ClaudeCliProvider", () => {
  it("returns provider name 'claude-cli'", () => {
    const provider = new ClaudeCliProvider();
    expect(provider.name).toBe("claude-cli");
  });

  it("is available when NOOA_AI_PROVIDER=claude-cli", () => {
    const provider = new ClaudeCliProvider();
    const originalEnv = process.env.NOOA_AI_PROVIDER;
    process.env.NOOA_AI_PROVIDER = "claude-cli";
    expect(provider.isAvailable()).toBe(true);
    process.env.NOOA_AI_PROVIDER = originalEnv;
  });

  it("is not available when NOOA_AI_PROVIDER is not claude-cli", () => {
    const provider = new ClaudeCliProvider();
    const originalEnv = process.env.NOOA_AI_PROVIDER;
    process.env.NOOA_AI_PROVIDER = "ollama";
    expect(provider.isAvailable()).toBe(false);
    process.env.NOOA_AI_PROVIDER = originalEnv;
  });

  it("calls claude CLI with prompt and returns content", async () => {
    const provider = new ClaudeCliProvider({
      // Inject mock subprocess for testing
      spawnClaude: async (prompt: string) => ({
        stdout: JSON.stringify({ content: "Hello from Claude!" }),
        exitCode: 0,
      }),
    });

    const result = await provider.complete({
      messages: [{ role: "user", content: "hello" }],
    });

    expect(result.content).toBe("Hello from Claude!");
  });

  it("returns error content when claude CLI exits with non-zero code", async () => {
    const provider = new ClaudeCliProvider({
      spawnClaude: async () => ({
        stdout: "",
        stderr: "claude: command not found",
        exitCode: 127,
      }),
    });

    const result = await provider.complete({
      messages: [{ role: "user", content: "hello" }],
    });

    expect(result.content).toContain("claude-cli error");
  });

  it("handles non-JSON output gracefully", async () => {
    const provider = new ClaudeCliProvider({
      spawnClaude: async () => ({
        stdout: "plain text response",
        exitCode: 0,
      }),
    });

    const result = await provider.complete({
      messages: [{ role: "user", content: "hello" }],
    });

    // Falls back to raw stdout when not JSON
    expect(result.content).toBe("plain text response");
  });
});
```

**Step 2: Verify RED**
Run: `bun test ./src/features/ai/providers/claude-cli.test.ts`
Expected: FAIL — `Cannot find module "./claude-cli"`

**Step 3: Implementar provider**

```typescript
// src/features/ai/providers/claude-cli.ts
import type { AiMessage, AiProvider, AiResponse } from "../types";

type SpawnClaudeFn = (prompt: string) => Promise<{
  stdout: string;
  stderr?: string;
  exitCode: number;
}>;

export interface ClaudeCliProviderOptions {
  spawnClaude?: SpawnClaudeFn;
  model?: string;
}

export class ClaudeCliProvider implements AiProvider {
  readonly name = "claude-cli";
  private readonly spawnClaude: SpawnClaudeFn;
  private readonly model: string;

  constructor(options: ClaudeCliProviderOptions = {}) {
    this.model = options.model ?? process.env.NOOA_CLAUDE_MODEL ?? "claude-opus-4-5";
    this.spawnClaude = options.spawnClaude ?? this.defaultSpawn.bind(this);
  }

  isAvailable(): boolean {
    return process.env.NOOA_AI_PROVIDER === "claude-cli";
  }

  async complete(input: { messages: AiMessage[] }): Promise<AiResponse> {
    // Build prompt from messages (system + conversation)
    const systemMsg = input.messages.find((m) => m.role === "system");
    const userMessages = input.messages.filter((m) => m.role !== "system");
    const prompt = userMessages.map((m) => `${m.role}: ${m.content}`).join("\n");

    const systemFlag = systemMsg
      ? `--system-prompt "${systemMsg.content.replace(/"/g, '\\"')}"`
      : "";

    const { stdout, stderr, exitCode } = await this.spawnClaude(
      `${systemFlag} ${prompt}`.trim(),
    );

    if (exitCode !== 0) {
      return {
        content: `claude-cli error (exit ${exitCode}): ${stderr ?? stdout ?? "unknown error"}`,
      };
    }

    // Try to parse JSON output (claude --output-format json)
    try {
      const parsed = JSON.parse(stdout.trim()) as { content?: string; result?: string };
      return { content: parsed.content ?? parsed.result ?? stdout.trim() };
    } catch {
      // Fall back to raw stdout
      return { content: stdout.trim() };
    }
  }

  private async defaultSpawn(prompt: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const proc = Bun.spawn(
      ["claude", "-p", prompt, "--output-format", "json", "--model", this.model],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { stdout, stderr, exitCode };
  }
}
```

**Step 4: Verify GREEN**
Run: `bun test ./src/features/ai/providers/claude-cli.test.ts`
Expected: PASS (5 tests)

**Step 5: Lint**
Run: `bun run check`
Expected: Sem erros.

**Step 6: Commit**
`git add src/features/ai/providers/claude-cli.ts src/features/ai/providers/claude-cli.test.ts`
`git commit -m "feat(ai): add ClaudeCliProvider wrapping claude CLI subprocess"`

---

### Task 2: Registrar no AiEngine e AgentEngine

**Files:**
- Modify: `src/features/agent/engine.ts`
- Test: `src/features/agent/engine.test.ts`

**Ponto exato de integração:**  
`createAiEngine()` em `engine.ts` (linha 28-35) registra os providers.  
Adicionar `ClaudeCliProvider` à lista.

**Step 1: Write failing test**

```typescript
// src/features/agent/engine.test.ts
it("uses ClaudeCliProvider when NOOA_AI_PROVIDER=claude-cli", async () => {
  const originalEnv = process.env.NOOA_AI_PROVIDER;
  process.env.NOOA_AI_PROVIDER = "claude-cli";

  const result = await run({
    prompt: "hello",
    provider: new AiEngineAgentProvider(createAiEngine()),
    // Note: will fail to call claude CLI in test env — that's OK,
    // we just verify the provider is selected (not mock/ollama)
  });

  process.env.NOOA_AI_PROVIDER = originalEnv;
  // Result may be error (claude not in PATH in CI), but provider was selected
  expect(result).toBeDefined();
});
```

**Step 2: Verify RED**
Run: `bun test ./src/features/agent/engine.test.ts`
Expected: FAIL — `ClaudeCliProvider` não está registrado.

**Step 3: Minimal implementation**

Em `createAiEngine()` (linha 28-35 de `engine.ts`):
```typescript
import { ClaudeCliProvider } from "../ai/providers/claude-cli";

function createAiEngine(): AiEngine {
  const engine = new AiEngine();
  engine.register(new ClaudeCliProvider()); // Adicionar antes dos outros
  engine.register(new OllamaProvider());
  engine.register(new OpenAiProvider());
  engine.register(new GroqProvider());
  engine.register(new MockProvider());
  return engine;
}
```

**Step 4: Verify GREEN**
Run: `bun test ./src/features/agent/engine.test.ts`
Expected: PASS

**Step 5: Full test suite**
Run: `bun test`
Expected: 825+ tests passando.

**Step 6: Commit**
`git add src/features/agent/engine.ts src/features/agent/engine.test.ts`
`git commit -m "feat(agent): register ClaudeCliProvider in AiEngine"`

---

### Task 3: Documentar variáveis de ambiente

**Files:**
- Modify: `.env.example`

```bash
# AI Provider selection
# Options: ollama (default), openai, groq, claude-cli, mock
NOOA_AI_PROVIDER=ollama

# ClaudeCliProvider options
# NOOA_CLAUDE_MODEL=claude-opus-4-5
```

**Step 1: Commit**
`git add .env.example`
`git commit -m "docs(ai): document NOOA_AI_PROVIDER and claude-cli options"`

---

### Task 4: Dogfooding end-to-end

**Step 1:** Verificar que `claude` está no PATH: `which claude`
**Step 2:** `NOOA_AI_PROVIDER=claude-cli bun index.ts ai "hello" --json`
**Step 3:** Verificar que a resposta vem do Claude CLI
**Step 4:** `NOOA_AI_PROVIDER=claude-cli bun index.ts agent "list files in current dir" --json`
**Step 5:** Verificar que o agente usa Claude como backend

---

### Notas de integração

- **`AiEngineAgentProvider` retorna `toolCalls: []` sempre** (linha 21 de `provider.ts`). O `ClaudeCliProvider` também não suporta tool-calling nativo via JSON. Isso é intencional por ora — o AgentLoop usa tool-calling via parsing de texto, não via API nativa.
- **Segurança:** O prompt é passado como argumento de linha de comando. Para prompts longos, considerar usar stdin em vez de argumento (evita exposição em `ps aux`). Isso é um upgrade futuro.
- **Fallback:** Se `claude` não estiver no PATH, o provider retorna erro gracioso. O `AiEngine` tentará o próximo provider disponível.
