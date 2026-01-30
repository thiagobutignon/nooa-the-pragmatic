# NOOA CLI v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a single `nooa` CLI (v0.0.1) that absorbs the current `resume2md` behaviors under `nooa resume`, plus `nooa jobs` and `nooa bridge`, with `--json` output support.

**Architecture:** Keep `index.ts` as the thin CLI adapter; move/route logic into feature handlers (resume/jobs/bridge). Replace the existing `resume2md` surface with `nooa` command tree while preserving core logic in `src/`. Add a small EventBus for internal eventing.

**Tech Stack:** Bun, TypeScript, Node stdlib, Vitest.

---

### Task 1: Add CLI help spec + version wiring (RED)

**Files:**
- Modify: `index.ts`
- Test: `tests/cli-nooa.test.ts`

**Step 1: Write the failing test**

```ts
import { execa } from "execa";

const run = (args: string[]) =>
  execa("bun", ["index.ts", ...args], { reject: false });

test("nooa --help shows root usage and subcommands", async () => {
  const res = await run(["--help"]);
  expect(res.exitCode).toBe(0);
  expect(res.stdout).toContain("Usage: nooa");
  expect(res.stdout).toContain("resume");
  expect(res.stdout).toContain("jobs");
  expect(res.stdout).toContain("bridge");
});

test("nooa --version prints 0.0.1", async () => {
  const res = await run(["--version"]);
  expect(res.exitCode).toBe(0);
  expect(res.stdout.trim()).toBe("nooa v0.0.1");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/cli-nooa.test.ts`
Expected: FAIL (help/version not present)

**Step 3: Write minimal implementation**

Update `index.ts` to:
- Rename program usage to `nooa`
- Add `--version` output `nooa v0.0.1`
- Root help includes subcommands

**Step 4: Run test to verify it passes**

Run: `bun test tests/cli-nooa.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/cli-nooa.test.ts index.ts
git commit -m "feat: add nooa root help and version"
```

---

### Task 2: Route resume subcommands (RED)

**Files:**
- Modify: `index.ts`
- Create: `src/cli/resume.ts`
- Test: `tests/cli-resume.test.ts`

**Step 1: Write the failing test**

```ts
import { execa } from "execa";

const run = (args: string[]) =>
  execa("bun", ["index.ts", ...args], { reject: false });

test("nooa resume --help shows resume usage", async () => {
  const res = await run(["resume", "--help"]);
  expect(res.exitCode).toBe(0);
  expect(res.stdout).toContain("Usage: nooa resume");
  expect(res.stdout).toContain("--to-pdf");
  expect(res.stdout).toContain("--to-json-resume");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/cli-resume.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- Create `src/cli/resume.ts` exporting `runResumeCommand(args, options)`
- Move existing resume conversion logic out of `index.ts` into this module
- `index.ts` routes `resume` subcommand to the handler

**Step 4: Run test to verify it passes**

Run: `bun test tests/cli-resume.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/cli/resume.ts index.ts tests/cli-resume.test.ts
git commit -m "feat: add nooa resume subcommand"
```

---

### Task 3: Route jobs subcommands (RED)

**Files:**
- Modify: `index.ts`
- Create: `src/cli/jobs.ts`
- Test: `tests/cli-jobs.test.ts`

**Step 1: Write the failing test**

```ts
import { execa } from "execa";

const run = (args: string[]) =>
  execa("bun", ["index.ts", ...args], { reject: false });

test("nooa jobs --help shows jobs usage", async () => {
  const res = await run(["jobs", "--help"]);
  expect(res.exitCode).toBe(0);
  expect(res.stdout).toContain("Usage: nooa jobs");
  expect(res.stdout).toContain("--search");
  expect(res.stdout).toContain("--provider");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/cli-jobs.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- Create `src/cli/jobs.ts` exporting `runJobsCommand(args, options)`
- Move existing jobs logic from `index.ts` into this module
- `index.ts` routes `jobs` subcommand to the handler

**Step 4: Run test to verify it passes**

Run: `bun test tests/cli-jobs.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/cli/jobs.ts index.ts tests/cli-jobs.test.ts
git commit -m "feat: add nooa jobs subcommand"
```

---

### Task 4: Route bridge subcommands (RED)

**Files:**
- Modify: `index.ts`
- Create: `src/cli/bridge.ts`
- Test: `tests/cli-bridge.test.ts`

**Step 1: Write the failing test**

```ts
import { execa } from "execa";

const run = (args: string[]) =>
  execa("bun", ["index.ts", ...args], { reject: false });

test("nooa bridge --help shows bridge usage", async () => {
  const res = await run(["bridge", "--help"]);
  expect(res.exitCode).toBe(0);
  expect(res.stdout).toContain("Usage: nooa bridge");
  expect(res.stdout).toContain("--op");
  expect(res.stdout).toContain("--param");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/cli-bridge.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- Create `src/cli/bridge.ts` exporting `runBridgeCommand(args, options)`
- Move existing bridge logic out of `index.ts` into this module
- `index.ts` routes `bridge` subcommand to the handler

**Step 4: Run test to verify it passes**

Run: `bun test tests/cli-bridge.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/cli/bridge.ts index.ts tests/cli-bridge.test.ts
git commit -m "feat: add nooa bridge subcommand"
```

---

### Task 5: Add internal EventBus and emit events (RED)

**Files:**
- Create: `src/core/event-bus.ts`
- Modify: `src/cli/resume.ts`, `src/cli/jobs.ts`, `src/cli/bridge.ts`
- Test: `tests/event-bus.test.ts`

**Step 1: Write the failing test**

```ts
import { EventBus } from "../src/core/event-bus";

test("EventBus publishes events to subscribers", () => {
  const bus = new EventBus();
  const events: string[] = [];
  bus.on("test.event", (payload) => events.push(payload.id));
  bus.emit("test.event", { id: "1" });
  expect(events).toEqual(["1"]);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/event-bus.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- Implement `EventBus` with `on(event, handler)` and `emit(event, payload)`
- Inject a bus instance into CLI handlers and emit events on success/failure

**Step 4: Run test to verify it passes**

Run: `bun test tests/event-bus.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/event-bus.ts src/cli/*.ts tests/event-bus.test.ts
git commit -m "feat: add internal event bus"
```

---

### Task 6: Update package.json bin to `nooa` (RED)

**Files:**
- Modify: `package.json`
- Test: `tests/cli-nooa.test.ts`

**Step 1: Write the failing test**

Add a test to `tests/cli-nooa.test.ts`:

```ts
test("package.json exposes nooa bin", async () => {
  const pkg = await Bun.file("package.json").json();
  expect(pkg.bin.nooa).toBe("index.ts");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/cli-nooa.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- Replace `bin.resume2md` with `bin.nooa`

**Step 4: Run test to verify it passes**

Run: `bun test tests/cli-nooa.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json tests/cli-nooa.test.ts
git commit -m "chore: expose nooa bin"
```

---

### Task 7: Final verification and cleanup

**Files:**
- Modify: `README.md` (optional name update)

**Step 1: Run full test suite**

Run: `bun test`
Expected: FAIL (known pre-existing failures). Record baseline.

**Step 2: Run lint/check (optional if noisy)**

Run: `bun check`
Expected: Might fail; record output.

**Step 3: Summarize changes and known test failures**

Document remaining failing tests as pre-existing baseline in final response.

**Step 4: Commit final doc updates if any**

```bash
git add README.md
git commit -m "docs: mention nooa cli"
```
