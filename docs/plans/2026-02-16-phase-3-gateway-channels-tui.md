# Phase 3: Gateway, Channels & TUI Integration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Conectar o runtime agentic a canais externos (Telegram/Discord) via gateway, integrar CLI-as-Provider, e wiring completo com a TUI Ink.js existente.

**Architecture:** Gateway é o control plane que recebe mensagens de múltiplos canais e roteia para o AgentLoop via MessageBus. A TUI ganha tela de chat agentic em tempo real. CLI-as-Provider wrapa `claude` como backend LLM alternativo. Ordem desta fase: **CLI First (gateway e provider) -> depois TUI**.

**Tech Stack:** TypeScript, Bun, Ink.js/React (TUI existente), node-telegram-bot-api, AgentLoop (Phase 1), bun:test

**Worktree:** `git worktree add ../nooa-phase-3 -b codex/phase-3-gateway`

**Dependência:** Phase 2 concluída e mergeada em main.

---

### Task 0: Preparar dependências de canais

**Step 1: Instalar dependências antes da implementação**

```bash
bun add node-telegram-bot-api
```

**Step 2: Commit**

```bash
git add package.json bun.lock
git commit -m "chore(gateway): add telegram channel dependency"
```

---

### Task 1: MessageBus (pub/sub interno)

**Files:**
- Create: `src/runtime/bus/message-bus.ts`
- Test: `src/runtime/bus/message-bus.test.ts`

**Step 1: Criar worktree**

```bash
git worktree add ../nooa-phase-3 -b codex/phase-3-gateway
cd ../nooa-phase-3
```

**Step 2: Escrever teste que falha**

```typescript
// src/runtime/bus/message-bus.test.ts
import { describe, expect, it, mock } from "bun:test";
import { MessageBus } from "./message-bus";

describe("MessageBus", () => {
  it("publishes and consumes inbound messages", async () => {
    const bus = new MessageBus();

    bus.publishInbound({
      channel: "telegram",
      chatId: "123456",
      senderId: "user1",
      content: "Hello NOOA",
    });

    const msg = bus.consumeInbound();
    expect(msg).toBeDefined();
    expect(msg!.content).toBe("Hello NOOA");
    expect(msg!.channel).toBe("telegram");
  });

  it("publishes outbound messages", () => {
    const bus = new MessageBus();
    const handler = mock(() => {});
    bus.onOutbound(handler);

    bus.publishOutbound({
      channel: "telegram",
      chatId: "123456",
      content: "Response from NOOA",
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("routes messages by channel", () => {
    const bus = new MessageBus();
    const telegramHandler = mock(() => {});
    const discordHandler = mock(() => {});

    bus.registerHandler("telegram", telegramHandler);
    bus.registerHandler("discord", discordHandler);

    bus.publishOutbound({ channel: "telegram", chatId: "1", content: "hi" });
    expect(telegramHandler).toHaveBeenCalledTimes(1);
    expect(discordHandler).not.toHaveBeenCalled();
  });

  it("returns undefined when no inbound messages", () => {
    const bus = new MessageBus();
    expect(bus.consumeInbound()).toBeUndefined();
  });
});
```

**Step 3: Implementar MessageBus**

```typescript
// src/runtime/bus/message-bus.ts
export interface InboundMessage {
  channel: string;
  chatId: string;
  senderId: string;
  content: string;
}

export interface OutboundMessage {
  channel: string;
  chatId: string;
  content: string;
}

type OutboundHandler = (msg: OutboundMessage) => void;

export class MessageBus {
  private inbound: InboundMessage[] = [];
  private outboundHandlers: OutboundHandler[] = [];
  private channelHandlers = new Map<string, OutboundHandler>();

  publishInbound(msg: InboundMessage): void {
    this.inbound.push(msg);
  }

  consumeInbound(): InboundMessage | undefined {
    return this.inbound.shift();
  }

  publishOutbound(msg: OutboundMessage): void {
    const handler = this.channelHandlers.get(msg.channel);
    if (handler) {
      handler(msg);
    }
    for (const h of this.outboundHandlers) {
      h(msg);
    }
  }

  onOutbound(handler: OutboundHandler): void {
    this.outboundHandlers.push(handler);
  }

  registerHandler(channel: string, handler: OutboundHandler): void {
    this.channelHandlers.set(channel, handler);
  }
}
```

**Step 4: Rodar teste, verificar, commit**

Run: `bun test src/runtime/bus/message-bus.test.ts`
Expected: PASS

```bash
git add src/runtime/bus/
git commit -m "feat(runtime): add MessageBus pub/sub for channel routing"
```

---

### Task 2: Channel Interface + CLI Channel

**Files:**
- Create: `src/runtime/channels/channel.ts`
- Create: `src/runtime/channels/cli-channel.ts`
- Test: `src/runtime/channels/cli-channel.test.ts`

**Step 1: Escrever teste**

```typescript
// src/runtime/channels/cli-channel.test.ts
import { describe, expect, it } from "bun:test";
import { CliChannel } from "./cli-channel";
import { MessageBus } from "../bus/message-bus";

describe("CliChannel", () => {
  it("has name 'cli'", () => {
    const channel = new CliChannel(new MessageBus());
    expect(channel.name).toBe("cli");
  });

  it("sends message to bus on input", () => {
    const bus = new MessageBus();
    const channel = new CliChannel(bus);
    channel.handleInput("hello");

    const msg = bus.consumeInbound();
    expect(msg).toBeDefined();
    expect(msg!.content).toBe("hello");
    expect(msg!.channel).toBe("cli");
  });
});
```

**Step 2: Implementar Channel interface e CLI channel**

```typescript
// src/runtime/channels/channel.ts
export interface Channel {
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

**Step 3: Commit**

```bash
git add src/runtime/channels/
git commit -m "feat(runtime): add Channel interface and CliChannel implementation"
```

---

### Task 3: Gateway (orchestrador de canais)

**Files:**
- Create: `src/runtime/gateway/gateway.ts`
- Test: `src/runtime/gateway/gateway.test.ts`

**Step 1: Escrever teste**

```typescript
// src/runtime/gateway/gateway.test.ts
import { describe, expect, it, mock } from "bun:test";
import { Gateway } from "./gateway";
import { MessageBus } from "../bus/message-bus";

describe("Gateway", () => {
  it("registers a channel", () => {
    const bus = new MessageBus();
    const gateway = new Gateway(bus);
    const mockChannel = { name: "test", start: mock(async () => {}), stop: mock(async () => {}) };

    gateway.registerChannel(mockChannel);
    expect(gateway.listChannels()).toContain("test");
  });

  it("starts all channels", async () => {
    const bus = new MessageBus();
    const gateway = new Gateway(bus);
    const mockChannel = { name: "test", start: mock(async () => {}), stop: mock(async () => {}) };

    gateway.registerChannel(mockChannel);
    await gateway.start();

    expect(mockChannel.start).toHaveBeenCalledTimes(1);
  });

  it("stops all channels", async () => {
    const bus = new MessageBus();
    const gateway = new Gateway(bus);
    const mockChannel = { name: "test", start: mock(async () => {}), stop: mock(async () => {}) };

    gateway.registerChannel(mockChannel);
    await gateway.start();
    await gateway.stop();

    expect(mockChannel.stop).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Implementar Gateway**

Gateway registra canais, inicia/para todos, e processa mensagens inbound via MessageBus → AgentLoop.

**Step 3: Commit**

```bash
git add src/runtime/gateway/
git commit -m "feat(runtime): add Gateway orchestrator for multi-channel management"
```

---

### Task 4: CLI-as-Provider (wrapa `claude` CLI como LLM backend)

**Files:**
- Create: `src/features/ai/providers/claude-cli.ts`
- Test: `src/features/ai/providers/claude-cli.test.ts`

**Step 1: Escrever teste**

```typescript
// src/features/ai/providers/claude-cli.test.ts
import { describe, expect, it } from "bun:test";
import { ClaudeCliProvider } from "./claude-cli";

describe("ClaudeCliProvider", () => {
  it("has name 'claude-cli'", () => {
    const provider = new ClaudeCliProvider();
    expect(provider.name).toBe("claude-cli");
  });

  it("builds correct command args", () => {
    const provider = new ClaudeCliProvider();
    const args = provider.buildArgs("test prompt", "system context");
    expect(args).toContain("-p");
    expect(args).toContain("--output-format");
    expect(args).toContain("json");
  });

  it("parses JSON response from claude CLI", () => {
    const provider = new ClaudeCliProvider();
    const mockOutput = JSON.stringify({
      type: "result",
      result: "Hello from Claude!",
      is_error: false,
    });

    const parsed = provider.parseResponse(mockOutput);
    expect(parsed.content).toBe("Hello from Claude!");
    expect(parsed.toolCalls).toHaveLength(0);
  });
});
```

**Step 2: Implementar ClaudeCliProvider**

Wrapa `claude -p --output-format json --no-chrome` como subprocess.

**Step 3: Commit**

```bash
git add src/features/ai/providers/claude-cli.ts src/features/ai/providers/claude-cli.test.ts
git commit -m "feat(ai): add ClaudeCliProvider - wraps claude CLI as LLM provider"
```

---

### Task 5: Comando `nooa gateway` (CLI First)

**Files:**
- Create: `src/features/gateway/cli.ts`
- Create: `src/features/gateway/engine.ts`
- Test: `src/features/gateway/cli.test.ts`

**Step 1: Criar comando usando CommandBuilder**

`nooa gateway` inicia o Gateway com canais configurados, MessageBus, AgentLoop, e SchedulerDaemon. Roda como daemon (long-running).

**Step 2: Commit**

```bash
git add src/features/gateway/
git commit -m "feat(gateway): add nooa gateway command for always-on agent daemon"
```

---

### Task 6: TUI Chat Screen (Ink.js)

**Files:**
- Create: `src/tui/screens/chat/ChatScreen.tsx`
- Create: `src/tui/screens/chat/MessageList.tsx`
- Create: `src/tui/screens/chat/InputBar.tsx`
- Modify: `src/tui/hooks/useAgent.ts`

**Step 1: Criar componentes React/Ink para chat (após gateway pronto)**

Seguir padrões da TUI existente (`src/tui/hooks/`, `src/tui/screens/`). Chat screen com:
- Lista de mensagens (user/assistant/tool)
- Input bar para digitar
- Status indicator (thinking, executing tool, idle)
- Scroll automático

**Step 2: Integrar com useAgent hook**

```typescript
// src/tui/hooks/useAgent.ts (atualizado)
// Hook que conecta a TUI ao AgentLoop via MessageBus
```

**Step 3: Commit**

```bash
git add src/tui/screens/chat/ src/tui/hooks/useAgent.ts
git commit -m "feat(tui): add ChatScreen with MessageList, InputBar for agent interaction"
```

---

### Task 7: Verificação final de Phase 3

**Step 1:** `bun test` — todos passam
**Step 2:** `bun run check` — sem erros
**Step 3:** `bun run linter` — sem erros (dogfooding)
**Step 4:** `bun test --coverage src/runtime/` — >80%
**Step 5:** `bun index.ts gateway --help` — mostra help
**Step 6:** `bun index.ts agent --help` — funciona com CLI-as-Provider
**Step 7:** `bun index.ts tui --help` — comando TUI disponível
**Step 8:** `bun test src/features/gateway/` — gateway testado
**Step 9:** Features existentes intactas: `bun test src/features/ src/core/`
