# Embed Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `nooa embed` to generate embeddings for text or files, with safe default output for CLI/agent usage.

**Architecture:** Implement `embed` under `src/features/embed/` with a provider abstraction. Default output returns metadata only; vectors are included only when explicitly requested. Provider selection via env/flags with a mock provider for tests.

**Tech Stack:** Bun, TypeScript, fetch, execa (if needed), SQLite (optional future), telemetry.

---

## Decision Checkpoint (Required)

**Provider choice for MVP (pick one):**
1) **Ollama local** (`http://localhost:11434`, model `nomic-embed-text`) via `/api/embeddings`.
2) **OpenAI-compatible** endpoint via `NOOA_EMBED_ENDPOINT` + `NOOA_EMBED_API_KEY`.
3) **Custom internal service** (specify URL + auth).

**If no choice yet:** implement provider selection with 1) as default and allow override via `--provider` + env vars.

---

### Task 1: Add CLI help contract for `nooa embed`

**Files:**
- Create: `src/features/embed/cli.test.ts`
- Create: `src/features/embed/cli.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test";
import { execa } from "execa";

const binPath = "./index.ts";

describe("nooa embed", () => {
  it("shows help", async () => {
    const res = await execa("bun", [binPath, "embed", "--help"], { reject: false });
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain("Usage: nooa embed <text|file>");
    expect(res.stdout).toContain("--include-embedding");
    expect(res.stdout).toContain("--out <file>");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/embed/cli.test.ts`  
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// src/features/embed/cli.ts
import type { Command, CommandContext } from "../../core/command";

const embedHelp = `
Usage: nooa embed <text|file> <input> [flags]

Arguments:
  text <string>     Embed a raw string
  file <path>       Embed file contents

Flags:
  --model <name>            Model name (default: nomic-embed-text)
  --provider <name>         Provider (default: ollama)
  --include-embedding       Include vector in output
  --out <file>              Write JSON output to file
  --json                    Output JSON (default)
  -h, --help                Show help
`;

const embedCommand: Command = {
  name: "embed",
  description: "Generate embeddings for text or files",
  execute: async ({ rawArgs }: CommandContext) => {
    const { parseArgs } = await import("node:util");
    const { values, positionals } = parseArgs({
      args: rawArgs,
      options: {
        model: { type: "string" },
        provider: { type: "string" },
        "include-embedding": { type: "boolean" },
        out: { type: "string" },
        json: { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
      strict: true,
      allowPositionals: true,
    }) as any;

    if (values.help) {
      console.log(embedHelp);
      return;
    }

    // TODO in later tasks: implement logic
    console.log(embedHelp);
  },
};

export default embedCommand;
```

**Step 4: Run test to verify it passes**

Run: `bun test src/features/embed/cli.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/embed/cli.ts src/features/embed/cli.test.ts
git commit -m "feat: add embed help"
```

---

### Task 2: Provider interface + mock provider for tests

**Files:**
- Create: `src/features/embed/engine.ts`
- Create: `src/features/embed/engine.test.ts`
- Modify: `src/features/embed/cli.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test";
import { embedText, resolveProvider } from "./engine";

process.env.NOOA_EMBED_PROVIDER = "mock";

it("selects mock provider", async () => {
  const provider = resolveProvider({ provider: "mock" });
  expect(provider.name).toBe("mock");
});

it("returns deterministic embedding from mock", async () => {
  const result = await embedText("hello", { provider: "mock", model: "mock" });
  expect(result.embedding.length).toBe(8);
  expect(result.dimensions).toBe(8);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/embed/engine.test.ts`  
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// src/features/embed/engine.ts
export type EmbedResult = {
  embedding: number[];
  dimensions: number;
  model: string;
  provider: string;
};

export type ProviderConfig = {
  provider?: string;
  model?: string;
};

const mockProvider = {
  name: "mock",
  embed: async (input: string) => {
    const embedding = Array.from({ length: 8 }, (_, i) => (input.length + i) % 7);
    return { embedding, dimensions: 8 };
  },
};

export function resolveProvider(config: ProviderConfig) {
  if ((config.provider ?? process.env.NOOA_EMBED_PROVIDER) === "mock") return mockProvider;
  throw new Error("No embed provider configured");
}

export async function embedText(input: string, config: ProviderConfig) {
  const provider = resolveProvider(config);
  const model = config.model ?? process.env.NOOA_EMBED_MODEL ?? "mock";
  const result = await provider.embed(input);
  return { ...result, model, provider: provider.name };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/features/embed/engine.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/embed/engine.ts src/features/embed/engine.test.ts src/features/embed/cli.ts
git commit -m "feat: add embed provider interface"
```

---

### Task 3: Implement `text` + `file` subcommands with safe output

**Files:**
- Modify: `src/features/embed/cli.ts`
- Modify: `src/features/embed/cli.test.ts`

**Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "bun:test";
import { execa } from "execa";
import { writeFile } from "node:fs/promises";

const binPath = "./index.ts";

it("embeds text and omits vector by default", async () => {
  const res = await execa("bun", [binPath, "embed", "text", "hello"], {
    reject: false,
    env: { ...process.env, NOOA_EMBED_PROVIDER: "mock" },
  });
  const json = JSON.parse(res.stdout);
  expect(json.model).toBeDefined();
  expect(json.embedding).toBeUndefined();
});

it("embeds file and includes vector when flag set", async () => {
  await writeFile("tmp-embed.txt", "hello");
  const res = await execa("bun", [binPath, "embed", "file", "tmp-embed.txt", "--include-embedding"], {
    reject: false,
    env: { ...process.env, NOOA_EMBED_PROVIDER: "mock" },
  });
  const json = JSON.parse(res.stdout);
  expect(Array.isArray(json.embedding)).toBe(true);
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/features/embed/cli.test.ts`  
Expected: FAIL

**Step 3: Implement minimal behavior**

- Parse subcommand: `text` or `file`
- Read file contents for `file`
- Call `embedText`
- Default output: JSON with `{ id, model, dimensions, provider, input }`
- If `--include-embedding`, include `embedding`
- If `--out <file>`, write JSON to file and keep stdout empty

**Step 4: Run tests to verify they pass**

Run: `bun test src/features/embed/cli.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/embed/cli.ts src/features/embed/cli.test.ts
git commit -m "feat: add embed text and file"
```

---

### Task 4: Add telemetry + errors

**Files:**
- Modify: `src/features/embed/cli.ts`
- Modify: `src/features/embed/cli.test.ts`

**Step 1: Write failing test**

```ts
// Verify telemetry is recorded for embed.success and embed.failure
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/embed/cli.test.ts`  
Expected: FAIL

**Step 3: Implement telemetry**

- Events: `embed.started`, `embed.success`, `embed.failure`
- Metadata: input type, bytes, model, provider, duration_ms

**Step 4: Run tests to verify they pass**

Run: `bun test src/features/embed/cli.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/embed/cli.ts src/features/embed/cli.test.ts
git commit -m "feat: add embed telemetry"
```

---

### Task 5: Docs

**Files:**
- Create: `docs/commands/embed.md`
- Modify: `README.md`

**Step 1: Write doc**

Include usage, flags, examples, exit codes, and note that vectors are **not** printed unless `--include-embedding` is set.

**Step 2: Commit**

```bash
git add docs/commands/embed.md README.md
git commit -m "docs: add embed command"
```

---

**Post-implementation:** Run full suite: `bun test --coverage`

