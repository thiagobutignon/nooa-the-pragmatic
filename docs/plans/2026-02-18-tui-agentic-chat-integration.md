# TUI Agentic Chat Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Entregar uma tela de chat agentic na TUI conectada ao gateway/event bus (CLI-only channel).

**Architecture:** Criar `ChatScreen` + componentes de lista/input e um hook `useAgentGatewayChat` que publica inbound no `EventBus` e escuta outbound. O `features/tui/cli.ts` ganha opção para abrir a tela de chat.

**Dependências existentes que DEVEM ser reusadas:**
- `src/runtime/gateway/messages.ts` — `GATEWAY_INBOUND_EVENT`, `GATEWAY_OUTBOUND_EVENT`, `GatewayInboundMessage`, `GatewayOutboundMessage` já definidos
- `src/core/event-bus.ts` — `EventBus` com `.on()`, `.off()`, `.emit()` já existe
- `src/features/gateway/engine.ts` — `run({ runner })` já conecta `Gateway + CliChannel + EventBus`; o hook deve usar a mesma instância
- `src/features/tui/cli.ts` — usa `CommandBuilder`; adicionar `--chat` ao schema existente (já tem `--dashboard` e `--tail`)
- `src/tui/hooks/` — 32 hooks existentes; o novo hook segue o mesmo padrão
- **`AgentLoop` já registra `spawn` e `subagent` automaticamente** em `registerBuiltInTools()` — não precisa fazer nada

**Tech Stack:** TypeScript, React/Ink, EventBus, Gateway runtime, bun:test.

---

### Task 1: Base de estado/hook de chat

**Files:**
- Create: `src/tui/hooks/useAgentGatewayChat.ts`
- Create: `src/tui/hooks/useAgentGatewayChat.test.ts`

**Ponto exato de integração:**  
O hook deve usar `GATEWAY_INBOUND_EVENT` e `GATEWAY_OUTBOUND_EVENT` de `src/runtime/gateway/messages.ts`.  
O `EventBus` é injetado como depêndencia (não singleton global) para facilitar testes.

**Step 1: Write failing tests**

```typescript
// src/tui/hooks/useAgentGatewayChat.test.ts
import { describe, expect, it, mock } from "bun:test";
import { EventBus } from "../../core/event-bus";
import {
  GATEWAY_INBOUND_EVENT,
  GATEWAY_OUTBOUND_EVENT,
  type GatewayOutboundMessage,
} from "../../runtime/gateway/messages";
import { createAgentGatewayChatState } from "./useAgentGatewayChat";

describe("createAgentGatewayChatState", () => {
  it("publishes user message as GATEWAY_INBOUND_EVENT", () => {
    const bus = new EventBus();
    const emitSpy = mock((event: string, data: unknown) => bus.emit(event, data));
    const state = createAgentGatewayChatState(bus);

    state.sendMessage("hello agent");

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({ role: "user", content: "hello agent" });
  });

  it("appends assistant message on GATEWAY_OUTBOUND_EVENT", () => {
    const bus = new EventBus();
    const state = createAgentGatewayChatState(bus);

    const outbound: GatewayOutboundMessage = {
      channel: "cli",
      chatId: "cli:direct",
      content: "Hello! I can help.",
    };
    bus.emit(GATEWAY_OUTBOUND_EVENT, outbound);

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({ role: "assistant", content: "Hello! I can help." });
  });

  it("tracks status as 'thinking' while waiting for response", () => {
    const bus = new EventBus();
    const state = createAgentGatewayChatState(bus);

    state.sendMessage("do something");
    expect(state.status).toBe("thinking");

    const outbound: GatewayOutboundMessage = { channel: "cli", chatId: "cli:direct", content: "Done." };
    bus.emit(GATEWAY_OUTBOUND_EVENT, outbound);
    expect(state.status).toBe("idle");
  });
});
```

**Step 2: Verify RED**
Run: `bun test ./src/tui/hooks/useAgentGatewayChat.test.ts`
Expected: FAIL — `Cannot find module "./useAgentGatewayChat"`

**Step 3: Minimal implementation**

```typescript
// src/tui/hooks/useAgentGatewayChat.ts
import { useEffect, useReducer } from "react";
import type { EventBus } from "../../core/event-bus";
import {
  GATEWAY_INBOUND_EVENT,
  GATEWAY_OUTBOUND_EVENT,
  type GatewayInboundMessage,
  type GatewayOutboundMessage,
} from "../../runtime/gateway/messages";

export type MessageRole = "user" | "assistant" | "system";
export interface ChatMessage { role: MessageRole; content: string; ts: number; }
export type ChatStatus = "idle" | "thinking" | "error";

export interface ChatState {
  messages: ChatMessage[];
  status: ChatStatus;
  sendMessage: (text: string) => void;
  dispose: () => void;
}

// Pure state factory (testable without React)
export function createAgentGatewayChatState(bus: EventBus): ChatState {
  const messages: ChatMessage[] = [];
  let status: ChatStatus = "idle";

  function sendMessage(text: string) {
    messages.push({ role: "user", content: text, ts: Date.now() });
    status = "thinking";
    const inbound: GatewayInboundMessage = {
      channel: "cli",
      chatId: "cli:direct",
      senderId: "tui:user",
      content: text,
    };
    bus.emit(GATEWAY_INBOUND_EVENT, inbound);
  }

  function onOutbound(msg: GatewayOutboundMessage) {
    messages.push({ role: "assistant", content: msg.content, ts: Date.now() });
    status = "idle";
  }

  bus.on(GATEWAY_OUTBOUND_EVENT, onOutbound);

  return {
    get messages() { return [...messages]; },
    get status() { return status; },
    sendMessage,
    dispose: () => bus.off(GATEWAY_OUTBOUND_EVENT, onOutbound),
  };
}

// React hook wrapper
export function useAgentGatewayChat(bus: EventBus) {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const state = createAgentGatewayChatState(bus);

  useEffect(() => {
    return () => state.dispose();
  }, [bus]);

  return state;
}
```

**Step 4: Verify GREEN**
Run: `bun test ./src/tui/hooks/useAgentGatewayChat.test.ts`
Expected: PASS (3 tests)

**Step 5: Lint**
Run: `bun run check`
Expected: Sem erros.

**Step 6: Commit**
`git add src/tui/hooks/useAgentGatewayChat.ts src/tui/hooks/useAgentGatewayChat.test.ts`
`git commit -m "feat(tui): add gateway-driven agent chat hook"`

---

### Task 2: Chat UI components

**Files:**
- Create: `src/tui/screens/chat/ChatScreen.tsx`
- Create: `src/tui/screens/chat/MessageList.tsx`
- Create: `src/tui/screens/chat/InputBar.tsx`
- Test: `src/tui/screens/chat/ChatScreen.test.tsx`

**Ponto exato de integração:**  
O `ChatScreen` recebe `bus: EventBus` como prop e usa `useAgentGatewayChat(bus)`.  
O `bus` é criado no `tui/cli.ts` junto com `Gateway + CliChannel` (mesma instância).

**Step 1: Write failing render tests**

```typescript
// src/tui/screens/chat/ChatScreen.test.tsx
import { render } from "ink-testing-library";
import React from "react";
import { EventBus } from "../../../core/event-bus";
import { ChatScreen } from "./ChatScreen";

it("renders empty state with prompt", () => {
  const bus = new EventBus();
  const { lastFrame } = render(React.createElement(ChatScreen, { bus }));
  expect(lastFrame()).toContain(">"); // input prompt
});

it("renders user message with role label", () => {
  const bus = new EventBus();
  const { lastFrame, stdin } = render(React.createElement(ChatScreen, { bus }));
  stdin.write("hello\n");
  expect(lastFrame()).toContain("you:");
  expect(lastFrame()).toContain("hello");
});
```

**Step 2: Verify RED**
Run: `bun test ./src/tui/screens/chat/ChatScreen.test.tsx`
Expected: FAIL — `Cannot find module "./ChatScreen"`

**Step 3: Minimal implementation**

```tsx
// src/tui/screens/chat/MessageList.tsx
import { Box, Text } from "ink";
import React from "react";
import type { ChatMessage } from "../../hooks/useAgentGatewayChat";

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <Box flexDirection="column">
      {messages.map((msg, i) => (
        <Box key={i}>
          <Text color={msg.role === "user" ? "cyan" : "green"}>
            {msg.role === "user" ? "you" : "nooa"}: {msg.content}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

// src/tui/screens/chat/InputBar.tsx
import { Box, Text, useInput } from "ink";
import React, { useState } from "react";

export function InputBar({ onSubmit, disabled }: { onSubmit: (text: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState("");
  useInput((input, key) => {
    if (disabled) return;
    if (key.return) { onSubmit(value); setValue(""); return; }
    if (key.backspace || key.delete) { setValue(v => v.slice(0, -1)); return; }
    setValue(v => v + input);
  });
  return (
    <Box>
      <Text color="yellow">&gt; </Text>
      <Text>{value}{!disabled ? "▌" : ""}</Text>
    </Box>
  );
}

// src/tui/screens/chat/ChatScreen.tsx
import { Box, Text } from "ink";
import React from "react";
import type { EventBus } from "../../../core/event-bus";
import { useAgentGatewayChat } from "../../hooks/useAgentGatewayChat";
import { InputBar } from "./InputBar";
import { MessageList } from "./MessageList";

export function ChatScreen({ bus }: { bus: EventBus }) {
  const { messages, status, sendMessage } = useAgentGatewayChat(bus);
  return (
    <Box flexDirection="column" height="100%">
      <Box flexGrow={1} flexDirection="column">
        <MessageList messages={messages} />
        {status === "thinking" && <Text color="gray">nooa is thinking...</Text>}
      </Box>
      <InputBar onSubmit={sendMessage} disabled={status === "thinking"} />
    </Box>
  );
}
```

**Step 4: Verify GREEN**
Run: `bun test ./src/tui/screens/chat/ChatScreen.test.tsx`
Expected: PASS

**Step 5: Commit**
`git add src/tui/screens/chat/`
`git commit -m "feat(tui): add ChatScreen components for agentic conversation"`

---

### Task 3: Wire command entrypoint

**Files:**
- Modify: `src/features/tui/cli.ts`
- Modify: `src/features/tui/cli.test.ts`

**Ponto exato de integração:**  
`src/features/tui/cli.ts` usa `CommandBuilder` com schema `{ dashboard, tail }`.  
Adicionar `chat: { type: "boolean", required: false }` ao schema existente.  
O `run()` precisa criar `EventBus + Gateway + CliChannel` e passar o `bus` para `ChatScreen`.

```typescript
// Dentro de run() em cli.ts, novo branch:
if (input.chat) {
  const { EventBus } = await import("../../core/event-bus");
  const { Gateway } = await import("../../runtime/gateway/gateway");
  const { CliChannel } = await import("../../runtime/channels/cli-channel");
  const { run: runAgent } = await import("../agent/engine");
  const { ChatScreen } = await import("../../tui/screens/chat/ChatScreen");

  const bus = new EventBus();
  const runner = async (sessionKey: string, content: string) => {
    const result = await runAgent({ prompt: content, sessionKey });
    return { forLlm: result.ok ? result.data.content : result.error.message };
  };
  const gateway = new Gateway(bus, runner);
  const cliChannel = new CliChannel(bus);
  gateway.registerChannel(cliChannel);
  await gateway.start();

  render(React.createElement(ChatScreen, { bus }));
  return { ok: true, data: undefined };
}
```

**Step 1: Write failing tests**

```typescript
// src/features/tui/cli.test.ts
it("--chat flag is accepted and parsed", async () => {
  // Test that parseInput maps --chat to input.chat = true
  const result = await parseInput(["--chat"]);
  expect(result.chat).toBe(true);
});
```

**Step 2: Verify RED**
Run: `bun test ./src/features/tui/cli.test.ts`
Expected: FAIL — `--chat` não existe no schema.

**Step 3: Minimal implementation**
- Adicionar `chat: { type: "boolean", required: false }` ao `tuiSchema`.
- Adicionar `--chat` ao `tuiHelp`.
- Adicionar `chat?: boolean` ao `TuiInput`.
- Adicionar branch `if (input.chat)` no `run()` conforme acima.

**Step 4: Verify GREEN**
Run: `bun test ./src/features/tui/cli.test.ts`
Expected: PASS

**Step 5: Lint e full test suite**
Run: `bun run check && bun test`
Expected: Sem erros, todos os testes passam.

**Step 6: Commit**
`git add src/features/tui/cli.ts src/features/tui/cli.test.ts`
`git commit -m "feat(tui): expose --chat mode wired to gateway chat screen"`

---

### Task 4: Dogfooding end-to-end

**Step 1:** `bun index.ts tui --help` — verificar que `--chat` aparece
**Step 2:** `bun index.ts tui --chat` — abrir a tela de chat
**Step 3:** Digitar uma mensagem e verificar resposta do agente
**Step 4:** Pressionar `Ctrl+C` para sair

