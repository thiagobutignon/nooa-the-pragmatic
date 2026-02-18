# Agent Provider Tool-Calling Support Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Habilitar tool-calling nativo no `AiEngineAgentProvider` para que o `AgentLoop` possa usar tools via function calling da API (não apenas via parsing de texto).

**Problema identificado:**  
`src/runtime/agent/provider.ts` linha 21: `toolCalls: []` — o provider **sempre retorna lista vazia de tool calls**, mesmo que o LLM retorne function calls. Isso significa que o `AgentLoop` nunca executa tools via API nativa; depende de parsing de texto ou de tools registradas manualmente.

**Architecture:** Estender `AiEngine.complete()` para aceitar `tools` como parâmetro e retornar `toolCalls` estruturados. O `AiEngineAgentProvider` passa as tool definitions do `ToolRegistry` para o LLM e mapeia as respostas de volta para `AgentToolCall[]`.

**Dependências existentes que DEVEM ser reusadas:**
- `src/runtime/agent/loop.ts` — `AgentToolCall` interface já definida (linha 8-12)
- `src/runtime/agent/provider.ts` — `AiEngineAgentProvider` é o ponto de integração
- `src/runtime/tool-registry.ts` — `ToolRegistry` já tem `list()` e `execute()`
- `src/features/ai/providers/openai.ts` — já tem lógica de completions; estender para tools
- `src/features/ai/types.ts` — `AiMessage`, `AiResponse` precisam de extensão

**Tech Stack:** TypeScript, Bun, OpenAI API (function calling), bun:test.

> **Nota:** Este plano é um upgrade avançado. O sistema funciona sem ele (AgentLoop usa tools via registro direto). Implementar após os planos de gateway daemon e heartbeat estarem funcionando.

---

### Task 1: Estender tipos de AI para suportar tools

**Files:**
- Modify: `src/features/ai/types.ts`
- Test: `src/features/ai/types.test.ts` (se existir)

**Step 1: Write failing tests**

```typescript
// Verificar que AiToolDefinition e AiToolCall são exportados
import type { AiToolCall, AiToolDefinition } from "../../features/ai/types";

const toolDef: AiToolDefinition = {
  name: "read_file",
  description: "Read a file from disk",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path" },
    },
    required: ["path"],
  },
};

const toolCall: AiToolCall = {
  id: "call_abc123",
  name: "read_file",
  arguments: { path: "/tmp/test.txt" },
};
```

**Step 2: Verify RED**
Run: `bun test` (type check)
Expected: FAIL — `AiToolDefinition` e `AiToolCall` não existem.

**Step 3: Minimal implementation**

Adicionar em `src/features/ai/types.ts`:
```typescript
export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

export interface AiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// Estender AiResponse
export interface AiResponse {
  content: string;
  toolCalls?: AiToolCall[]; // NOVO: opcional para compatibilidade
}

// Estender AiCompleteInput
export interface AiCompleteInput {
  messages: AiMessage[];
  tools?: AiToolDefinition[]; // NOVO: opcional
}
```

**Step 4: Verify GREEN**
Run: `bun run check && bun test`
Expected: PASS (sem quebrar nada existente)

**Step 5: Commit**
`git add src/features/ai/types.ts`
`git commit -m "feat(ai): add AiToolDefinition and AiToolCall types"`

---

### Task 2: Implementar tool-calling no OpenAiProvider

**Files:**
- Modify: `src/features/ai/providers/openai.ts`
- Test: `src/features/ai/providers/openai.test.ts`

**Step 1: Write failing tests**

```typescript
// src/features/ai/providers/openai.test.ts
it("passes tools to OpenAI API and returns tool calls", async () => {
  const mockFetch = mock(async () =>
    new Response(JSON.stringify({
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: "call_abc",
            type: "function",
            function: { name: "read_file", arguments: JSON.stringify({ path: "/tmp/test.txt" }) },
          }],
        },
      }],
    }), { status: 200 })
  );

  const provider = new OpenAiProvider({ fetch: mockFetch });
  const result = await provider.complete({
    messages: [{ role: "user", content: "read the file" }],
    tools: [{
      name: "read_file",
      description: "Read a file",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    }],
  });

  expect(result.toolCalls).toHaveLength(1);
  expect(result.toolCalls?.[0].name).toBe("read_file");
  expect(result.toolCalls?.[0].arguments).toEqual({ path: "/tmp/test.txt" });
});
```

**Step 2: Verify RED**
Run: `bun test ./src/features/ai/providers/openai.test.ts`
Expected: FAIL — `toolCalls` não é retornado.

**Step 3: Minimal implementation**

Em `openai.ts`, no método `complete()`:
```typescript
// Mapear tools para formato OpenAI
const openaiTools = input.tools?.map((tool) => ({
  type: "function" as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  },
}));

// Incluir na request
const body = {
  model: this.model,
  messages: mappedMessages,
  ...(openaiTools && openaiTools.length > 0 ? { tools: openaiTools } : {}),
};

// Mapear tool_calls da resposta
const toolCalls = choice.message.tool_calls?.map((tc) => ({
  id: tc.id,
  name: tc.function.name,
  arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
})) ?? [];

return {
  content: choice.message.content ?? "",
  toolCalls,
};
```

**Step 4: Verify GREEN**
Run: `bun test ./src/features/ai/providers/openai.test.ts`
Expected: PASS

**Step 5: Commit**
`git add src/features/ai/providers/openai.ts src/features/ai/providers/openai.test.ts`
`git commit -m "feat(ai): add tool-calling support to OpenAiProvider"`

---

### Task 3: Conectar AiEngineAgentProvider ao tool-calling

**Files:**
- Modify: `src/runtime/agent/provider.ts`
- Modify: `src/runtime/agent/loop.ts`
- Test: `src/runtime/agent/provider.test.ts`

**Ponto exato de integração:**  
`AiEngineAgentProvider.generate()` (linha 12-23 de `provider.ts`) chama `engine.complete()` mas ignora tool calls.  
`AgentLoop.processMessage()` (linha 54) chama `provider.generate()` e já processa `response.toolCalls`.

**Step 1: Write failing tests**

```typescript
// src/runtime/agent/provider.test.ts
it("maps AiToolCall from engine to AgentToolCall in response", async () => {
  const mockEngine = {
    complete: mock(async () => ({
      content: "",
      toolCalls: [{
        id: "call_1",
        name: "read_file",
        arguments: { path: "/tmp/test.txt" },
      }],
    })),
  };

  const provider = new AiEngineAgentProvider(mockEngine);
  const response = await provider.generate({
    messages: [{ role: "user", content: "read the file" }],
    tools: [{
      name: "read_file",
      description: "Read a file",
      parameters: { type: "object", properties: { path: { type: "string" } } },
    }],
  });

  expect(response.toolCalls).toHaveLength(1);
  expect(response.toolCalls[0].name).toBe("read_file");
  expect(response.toolCalls[0].arguments).toEqual({ path: "/tmp/test.txt" });
});
```

**Step 2: Verify RED**
Run: `bun test ./src/runtime/agent/provider.test.ts`
Expected: FAIL — `toolCalls` sempre `[]`.

**Step 3: Minimal implementation**

Em `provider.ts`:
```typescript
async generate(input: {
  messages: AgentModelMessage[];
  tools?: AgentToolDefinition[]; // NOVO
}): Promise<AgentModelResponse> {
  const aiTools = input.tools?.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));

  const response = await this.engine.complete({
    messages: input.messages.map((m) => this.toAiMessage(m)),
    tools: aiTools,
  });

  return {
    content: response.content,
    toolCalls: response.toolCalls?.map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.arguments,
    })) ?? [],
  };
}
```

Em `loop.ts`, passar tools ao chamar `provider.generate()`:
```typescript
const toolDefs = this.tools.list().map((t) => ({
  name: t.name,
  description: t.description,
  parameters: t.parameters ?? { type: "object", properties: {} },
}));

const response = await this.provider.generate({ messages, tools: toolDefs });
```

**Step 4: Verify GREEN**
Run: `bun test ./src/runtime/agent/`
Expected: PASS

**Step 5: Full test suite**
Run: `bun test`
Expected: 825+ tests passando.

**Step 6: Commit**
`git add src/runtime/agent/provider.ts src/runtime/agent/loop.ts src/runtime/agent/provider.test.ts`
`git commit -m "feat(agent): wire tool definitions through AiEngineAgentProvider to AgentLoop"`

---

### Task 4: Dogfooding end-to-end

**Step 1:** `NOOA_AI_PROVIDER=openai bun index.ts agent "list files in current dir" --json`
**Step 2:** Verificar que o agente usa tool calls (não apenas texto)
**Step 3:** `bun index.ts agent "read the README.md file" --json`
**Step 4:** Verificar que `read_file` tool é chamada via function calling

---

### Notas de integração

- **Compatibilidade:** `toolCalls` é opcional em `AiResponse` — providers que não suportam (ollama, groq, claude-cli) continuam retornando `[]` sem quebrar.
- **ToolRegistry.list():** Verificar que `ToolRegistry` tem método `list()` que retorna `ToolDefinition[]` com `name`, `description`, `parameters`. Se não existir, adicionar.
- **Ordem de implementação:** Este plano deve ser executado APÓS o gateway daemon e heartbeat estarem funcionando. É um upgrade de qualidade, não um bloqueador.
