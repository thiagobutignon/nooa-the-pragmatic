# NOOA Code Write v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a CLI command `nooa code write` that writes a file from stdin or `--from` with safe overwrite rules.

**Architecture:** CLI subcommand parses args and delegates to a small writer module. Writer performs file existence checks, writes content, and returns a result object. Tests run the CLI with `execa` and assert stdout/stderr, exit codes, and file contents.

**Tech Stack:** Bun, TypeScript, execa, node:fs/promises, Biome.

---

### Task 1: Add CLI help contract for `nooa code write`

**Files:**
- Modify: `index.ts`
- Test: `tests/cli-code-write.test.ts`

**Step 1: Write the failing test**

Create `tests/cli-code-write.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { execa } from "execa";

const run = (args: string[]) =>
  execa("bun", ["index.ts", ...args], { reject: false });

describe("nooa code write", () => {
  test("nooa code write --help shows usage", async () => {
    const res = await run(["code", "write", "--help"]);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain("Usage: nooa code write <path>");
    expect(res.stdout).toContain("--from <path>");
    expect(res.stdout).toContain("--overwrite");
    expect(res.stdout).toContain("--json");
    expect(res.stdout).toContain("--dry-run");
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```
bun test tests/cli-code-write.test.ts
```
Expected: FAIL (unknown command or missing help text).

**Step 3: Write minimal implementation**

Update `index.ts` to include a `code` group with `write` subcommand help. Add a `printCodeWriteHelp()` function and route `code write --help` to it.

**Step 4: Run test to verify it passes**

Run:
```
bun test tests/cli-code-write.test.ts
```
Expected: PASS.

**Step 5: Commit**

```
git add index.ts tests/cli-code-write.test.ts
git commit -m "feat: add code write help"
```

---

### Task 2: Implement writer module (no CLI wiring yet)

**Files:**
- Create: `src/code/write.ts`
- Test: `tests/code-write.test.ts`

**Step 1: Write the failing test**

Create `tests/code-write.test.ts`:

```ts
import { afterEach, describe, expect, test } from "bun:test";
import { readFile, rm, writeFile } from "node:fs/promises";
import { writeCodeFile } from "../src/code/write";

const OUT = "tmp-code-write.txt";

afterEach(async () => {
  await rm(OUT, { force: true });
});

describe("writeCodeFile", () => {
  test("writes content when file does not exist", async () => {
    const result = await writeCodeFile({
      path: OUT,
      content: "hello",
      overwrite: false,
      dryRun: false,
    });

    expect(result.path).toBe(OUT);
    expect(result.bytes).toBe(5);
    expect(result.overwritten).toBe(false);
    const text = await readFile(OUT, "utf-8");
    expect(text).toBe("hello");
  });

  test("fails when file exists without overwrite", async () => {
    await writeFile(OUT, "existing");
    await expect(
      writeCodeFile({ path: OUT, content: "new", overwrite: false, dryRun: false })
    ).rejects.toThrow("already exists");
  });

  test("overwrites when overwrite is true", async () => {
    await writeFile(OUT, "existing");
    const result = await writeCodeFile({
      path: OUT,
      content: "new",
      overwrite: true,
      dryRun: false,
    });

    expect(result.overwritten).toBe(true);
    const text = await readFile(OUT, "utf-8");
    expect(text).toBe("new");
  });

  test("dry-run does not write file", async () => {
    const result = await writeCodeFile({
      path: OUT,
      content: "hello",
      overwrite: false,
      dryRun: true,
    });

    expect(result.bytes).toBe(5);
    await expect(readFile(OUT, "utf-8")).rejects.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```
bun test tests/code-write.test.ts
```
Expected: FAIL (module missing).

**Step 3: Write minimal implementation**

Create `src/code/write.ts`:

```ts
import { access, writeFile } from "node:fs/promises";

export type WriteCodeInput = {
  path: string;
  content: string;
  overwrite: boolean;
  dryRun: boolean;
};

export type WriteCodeResult = {
  path: string;
  bytes: number;
  overwritten: boolean;
};

export async function writeCodeFile(input: WriteCodeInput): Promise<WriteCodeResult> {
  const { path, content, overwrite, dryRun } = input;

  let exists = false;
  try {
    await access(path);
    exists = true;
  } catch {
    exists = false;
  }

  if (exists && !overwrite) {
    throw new Error(`File already exists: ${path}`);
  }

  if (!dryRun) {
    await writeFile(path, content, "utf-8");
  }

  return {
    path,
    bytes: Buffer.byteLength(content),
    overwritten: exists,
  };
}
```

**Step 4: Run test to verify it passes**

Run:
```
bun test tests/code-write.test.ts
```
Expected: PASS.

**Step 5: Commit**

```
git add src/code/write.ts tests/code-write.test.ts
git commit -m "feat: add code write core"
```

---

### Task 3: Wire CLI to writer module (stdin/--from)

**Files:**
- Modify: `index.ts`
- Test: `tests/cli-code-write.test.ts`

**Step 1: Write the failing test**

Append to `tests/cli-code-write.test.ts`:

```ts
import { readFile, rm, writeFile } from "node:fs/promises";

const OUT = "tmp-cli-write.txt";
const SRC = "tmp-cli-src.txt";

test("writes from --from file", async () => {
  await writeFile(SRC, "from-file");
  const res = await run(["code", "write", OUT, "--from", SRC]);
  expect(res.exitCode).toBe(0);
  const text = await readFile(OUT, "utf-8");
  expect(text).toBe("from-file");
});

test("fails if file exists without --overwrite", async () => {
  await writeFile(OUT, "existing");
  const res = await run(["code", "write", OUT, "--from", SRC]);
  expect(res.exitCode).toBe(1);
});

test("supports --overwrite", async () => {
  await writeFile(SRC, "new");
  await writeFile(OUT, "existing");
  const res = await run(["code", "write", OUT, "--from", SRC, "--overwrite"]);
  expect(res.exitCode).toBe(0);
  const text = await readFile(OUT, "utf-8");
  expect(text).toBe("new");
});

afterEach(async () => {
  await rm(OUT, { force: true });
  await rm(SRC, { force: true });
});
```

**Step 2: Run test to verify it fails**

Run:
```
bun test tests/cli-code-write.test.ts
```
Expected: FAIL (CLI not wired).

**Step 3: Write minimal implementation**

In `index.ts`, add `code write` branch:
- Parse `<path>` positional
- Read content from stdin if piped (`process.stdin.isTTY === false`)
- Else if `--from <file>` read that file
- Else error (exit code 2)
- Call `writeCodeFile({ path, content, overwrite, dryRun })`
- If `--json`, print JSON to stdout: `{ path, bytes, overwritten, dryRun }`
- Errors: log to stderr and set `process.exitCode = 1`

**Step 4: Run test to verify it passes**

Run:
```
bun test tests/cli-code-write.test.ts
```
Expected: PASS.

**Step 5: Commit**

```
git add index.ts tests/cli-code-write.test.ts
git commit -m "feat: wire code write command"
```

---

### Task 4: Add stdin support (pipe)

**Files:**
- Modify: `index.ts`
- Test: `tests/cli-code-write.test.ts`

**Step 1: Write the failing test**

Append to `tests/cli-code-write.test.ts`:

```ts
import { Readable } from "node:stream";

test("writes from stdin", async () => {
  const res = await execa("bun", ["index.ts", "code", "write", OUT], {
    input: "from-stdin",
    reject: false,
  });
  expect(res.exitCode).toBe(0);
  const text = await readFile(OUT, "utf-8");
  expect(text).toBe("from-stdin");
});
```

**Step 2: Run test to verify it fails**

Run:
```
bun test tests/cli-code-write.test.ts
```
Expected: FAIL (stdin not handled).

**Step 3: Write minimal implementation**

In `index.ts`, detect stdin:

```ts
const stdinText = await new Response(process.stdin).text();
```

Use `stdinText` if not empty and stdin is not TTY.

**Step 4: Run test to verify it passes**

Run:
```
bun test tests/cli-code-write.test.ts
```
Expected: PASS.

**Step 5: Commit**

```
git add index.ts tests/cli-code-write.test.ts
git commit -m "feat: support stdin for code write"
```

---

### Task 5: Add dry-run and json output

**Files:**
- Modify: `index.ts`
- Test: `tests/cli-code-write.test.ts`

**Step 1: Write the failing test**

Append to `tests/cli-code-write.test.ts`:

```ts
import { existsSync } from "node:fs";

test("dry-run reports without writing", async () => {
  const res = await execa("bun", ["index.ts", "code", "write", OUT, "--from", SRC, "--dry-run", "--json"], {
    reject: false,
  });
  expect(res.exitCode).toBe(0);
  const payload = JSON.parse(res.stdout);
  expect(payload.dryRun).toBe(true);
  expect(existsSync(OUT)).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run:
```
bun test tests/cli-code-write.test.ts
```
Expected: FAIL (dry-run/json not implemented).

**Step 3: Write minimal implementation**

In `index.ts`, add `--dry-run` and `--json` handling in `code write` branch.

**Step 4: Run test to verify it passes**

Run:
```
bun test tests/cli-code-write.test.ts
```
Expected: PASS.

**Step 5: Commit**

```
git add index.ts tests/cli-code-write.test.ts
git commit -m "feat: add dry-run and json output to code write"
```

---

### Task 6: Gates

**Files:**
- (none)

**Step 1: Run full tests**

Run:
```
bun test
```
Expected: PASS.

**Step 2: Run checks**

Run:
```
bun check
```
Expected: PASS.

**Step 3: Run linter**

Run:
```
bun run linter
```
Expected: PASS.

**Step 4: Commit any fixes**

```
git add -A
git commit -m "chore: finalize code write"
```

