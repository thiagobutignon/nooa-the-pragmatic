# NOOA Read CLI v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `nooa read <path>` to output file contents to stdout, with optional JSON and stdin path support.

**Architecture:** CLI subcommand parses args; reads file from path (positional or stdin), streams content to stdout, and uses stderr for errors. JSON output is optional for automation.

**Tech Stack:** Bun, TypeScript, execa, node:fs/promises, Biome.

---

### Task 1: Add help contract for `nooa read`

**Files:**
- Modify: `index.ts`
- Test: `tests/cli-read.test.ts`

**Step 1: Write the failing test**

Create `tests/cli-read.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { execa } from "execa";

const run = (args: string[], input?: string) =>
  execa("bun", ["index.ts", ...args], { reject: false, input });

describe("nooa read", () => {
  test("nooa read --help shows usage", async () => {
    const res = await run(["read", "--help"]);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain("Usage: nooa read <path>");
    expect(res.stdout).toContain("--json");
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```
bun test tests/cli-read.test.ts
```
Expected: FAIL (help missing).

**Step 3: Write minimal implementation**

Update `index.ts` to add a `read` subcommand help block (`nooa read <path>`) and route `read --help` to it.

**Step 4: Run test to verify it passes**

Run:
```
bun test tests/cli-read.test.ts
```
Expected: PASS.

**Step 5: Commit**

```
git add index.ts tests/cli-read.test.ts
git commit -m "feat: add read help"
```

---

### Task 2: Implement read command (positional path)

**Files:**
- Modify: `index.ts`
- Test: `tests/cli-read.test.ts`

**Step 1: Write the failing test**

Append to `tests/cli-read.test.ts`:

```ts
import { readFile, writeFile, rm } from "node:fs/promises";

const OUT = "tmp-read.txt";

afterEach(async () => {
  await rm(OUT, { force: true });
});

test("reads file content by path", async () => {
  await writeFile(OUT, "hello-read");
  const res = await run(["read", OUT]);
  expect(res.exitCode).toBe(0);
  expect(res.stdout).toBe("hello-read");
});

test("returns error when file does not exist", async () => {
  const res = await run(["read", "missing.txt"]);
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toContain("not found");
});
```

**Step 2: Run test to verify it fails**

Run:
```
bun test tests/cli-read.test.ts
```
Expected: FAIL.

**Step 3: Write minimal implementation**

In `index.ts`:
- Detect `subcommand === "read"`.
- Require `<path>` positional.
- Read file with `readFile(path, "utf-8")`.
- Write content to `stdout`.
- On missing path: exit code 2, stderr error.
- On read error: exit code 1, stderr error.

**Step 4: Run test to verify it passes**

Run:
```
bun test tests/cli-read.test.ts
```
Expected: PASS.

**Step 5: Commit**

```
git add index.ts tests/cli-read.test.ts
git commit -m "feat: add read command"
```

---

### Task 3: Add stdin path support

**Files:**
- Modify: `index.ts`
- Test: `tests/cli-read.test.ts`

**Step 1: Write the failing test**

Append to `tests/cli-read.test.ts`:

```ts
import { writeFile } from "node:fs/promises";

test("reads file path from stdin", async () => {
  await writeFile(OUT, "stdin-read");
  const res = await run(["read"], `${OUT}\n`);
  expect(res.exitCode).toBe(0);
  expect(res.stdout).toBe("stdin-read");
});
```

**Step 2: Run test to verify it fails**

Run:
```
bun test tests/cli-read.test.ts
```
Expected: FAIL.

**Step 3: Write minimal implementation**

In `index.ts`:
- If `<path>` is missing and `stdin` is not TTY, read path from stdin (`trim`).
- If still no path, exit code 2 with usage error.

**Step 4: Run test to verify it passes**

Run:
```
bun test tests/cli-read.test.ts
```
Expected: PASS.

**Step 5: Commit**

```
git add index.ts tests/cli-read.test.ts
git commit -m "feat: support read path via stdin"
```

---

### Task 4: Add JSON output

**Files:**
- Modify: `index.ts`
- Test: `tests/cli-read.test.ts`

**Step 1: Write the failing test**

Append to `tests/cli-read.test.ts`:

```ts
import { writeFile } from "node:fs/promises";

test("outputs json with metadata", async () => {
  await writeFile(OUT, "json-read");
  const res = await run(["read", OUT, "--json"]);
  expect(res.exitCode).toBe(0);
  const payload = JSON.parse(res.stdout);
  expect(payload.path).toBe(OUT);
  expect(payload.bytes).toBe(9);
  expect(payload.content).toBe("json-read");
});
```

**Step 2: Run test to verify it fails**

Run:
```
bun test tests/cli-read.test.ts
```
Expected: FAIL.

**Step 3: Write minimal implementation**

In `index.ts`:
- If `--json`, output `{ path, bytes, content }` as JSON.
- Otherwise stdout = raw content.

**Step 4: Run test to verify it passes**

Run:
```
bun test tests/cli-read.test.ts
```
Expected: PASS.

**Step 5: Commit**

```
git add index.ts tests/cli-read.test.ts
git commit -m "feat: add read json output"
```

---

### Task 5: Gates

**Step 1: Run full tests**

```
bun test
```
Expected: PASS.

**Step 2: Run checks**

```
bun check
```
Expected: PASS.

**Step 3: Run linter**

```
bun run linter
```
Expected: PASS.

**Step 4: Commit any fixes**

```
git add -A
git commit -m "chore: finalize read command"
```

