# Read Feature Refactor + Docs Generation Plan (Revised)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the `read` feature into a single source of truth (without deleting `cli.ts`), add SDK `json` flag parity, and generate docs/agent manifest at build time.

**Architecture:** `src/features/read/index.ts` becomes canonical for metadata, help text, agent XML, SDK types/logic, and CLI handler. `src/features/read/cli.ts` remains as a thin re-export for the registry loader. The SDK delegates to the feature implementation without introducing circular dependencies. A build-time script (`scripts/generate-docs.ts`) generates `docs/commands/*`, `docs/sdk/*`, and `.nooa/AGENT_MANIFEST.json` from feature exports.

**Tech Stack:** Bun + TypeScript, existing command registry loader, Bun test, Node fs/path utilities.

---

### Task 1: Create feature index (source of truth) + tests

**Files:**
- Create: `src/features/read/index.ts`
- Create: `src/features/read/index.test.ts`
- Modify: `src/features/read/execute.test.ts` (rename content to `index.test.ts`, then remove this file)

**Step 1: Write the failing test**

Create `src/features/read/index.test.ts`:

```ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { run, readMeta, readAgentDoc } from "./index";

const TMP_DIR = join(import.meta.dir, "tmp-test-read");

describe("read feature", () => {
  beforeEach(async () => {
    await mkdir(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  test("run accepts json flag for CLI parity", async () => {
    const testFile = join(TMP_DIR, "test.txt");
    await writeFile(testFile, "hello world");

    const result = await run({ path: testFile, json: true });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.content).toBe("hello world");
      expect(result.data.bytes).toBe(11);
    }
  });

  test("readMeta exposes name and version", () => {
    expect(readMeta.name).toBe("read");
    expect(readMeta.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("readAgentDoc embeds instruction and version", () => {
    expect(readAgentDoc).toContain("<instruction");
    expect(readAgentDoc).toContain(`version="${readMeta.version}"`);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/read/index.test.ts`
Expected: FAIL (module not found or missing exports).

**Step 3: Write minimal implementation**

Create `src/features/read/index.ts` containing:
- `readMeta`, `readHelp`, `readAgentDoc` (XML schema per your spec)
- `ReadRunInput` with `json?: boolean` (parity only, no change in return)
- `ReadRunResult`
- `run()` using existing read logic
- `executeCli()` using `readHelp` + `run()`
- default export `{ name, description, options, execute, agentDoc }`

**Step 4: Run test to verify it passes**

Run: `bun test src/features/read/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/read/index.ts src/features/read/index.test.ts
# remove the old execute.test.ts after content is migrated
rm src/features/read/execute.test.ts
# then
git add src/features/read/execute.test.ts

git commit -m "refactor(read): consolidate feature source of truth"
```

---

### Task 2: Keep `cli.ts` as re-export

**Files:**
- Modify: `src/features/read/cli.ts`

**Step 1: No new test**

**Step 2: Implement**

```ts
// src/features/read/cli.ts
export { default } from "./index";
```

**Step 3: Run existing tests**

Run: `bun test src/features/read/index.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/read/cli.ts
git commit -m "refactor(read): cli re-export"
```

---

### Task 3: Update SDK to delegate to feature index (no circular deps)

**Files:**
- Modify: `src/sdk/read.ts`

**Step 1: Write failing test (if needed)**

Existing SDK tests will cover this. No new test required.

**Step 2: Implement**

```ts
// src/sdk/read.ts
export { run } from "../features/read/index";
export const read = { run };
```

**Step 3: Run test**

Run: `bun test src/sdk/read.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/sdk/read.ts
git commit -m "refactor(sdk): read delegates to feature"
```

---

### Task 4: Build-time docs + agent manifest generator (unit-tested)

**Files:**
- Create: `scripts/generate-docs.ts`
- Create: `tests/scripts/generate-docs.test.ts`
- Modify: `package.json`

**Step 1: Write failing tests**

```ts
import { describe, test, expect } from "bun:test";
import { generateMarkdownDoc, generateManifest } from "../../scripts/generate-docs";

describe("docs generator", () => {
  const mockFeature = {
    readMeta: { name: "read", version: "1.2.0", description: "Read file contents" },
    readHelp: "Usage: nooa read <path>",
    readAgentDoc: "<instruction version=\"1.2.0\" name=\"read\">...</instruction>",
  };

  test("generateMarkdownDoc creates markdown", () => {
    const md = generateMarkdownDoc(mockFeature);
    expect(md).toContain("# read");
    expect(md).toContain("Usage: nooa read");
    expect(md).toContain("```xml");
  });

  test("generateManifest creates manifest JSON", () => {
    const manifest = generateManifest([mockFeature]);
    expect(manifest.features).toHaveLength(1);
    expect(manifest.features[0].name).toBe("read");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/scripts/generate-docs.test.ts`
Expected: FAIL (module not found).

**Step 3: Implement generator**

Implement `scripts/generate-docs.ts` exporting:
- `generateMarkdownDoc(feature)`
- `generateManifest(features)`

`main()` scans `src/features/*/index.ts`, imports with Bun `import(featurePath)`, and writes:
- `docs/commands/<name>.md`
- `docs/sdk/<name>.md`
- `.nooa/AGENT_MANIFEST.json`

**Step 4: Run tests**

Run: `bun test tests/scripts/generate-docs.test.ts`
Expected: PASS

**Step 5: Add script + commit**

Add to `package.json`:

```json
"scripts": {
  "docs": "bun run scripts/generate-docs.ts"
}
```

Then:

```bash
bun run docs

git add scripts/generate-docs.ts tests/scripts/generate-docs.test.ts package.json docs/ .nooa/AGENT_MANIFEST.json

git commit -m "feat: generate docs and agent manifest"
```

---

### Task 5: Validate changes

**Step 1: Run targeted tests**

```bash
bun test src/features/read/index.test.ts
bun test src/sdk/read.test.ts
bun test tests/scripts/generate-docs.test.ts
```

**Step 2: Run full suite (optional)**

```bash
bun test
```

**Step 3: Commit (if needed)**

```bash
git add -A
git commit -m "chore: validate read refactor"
```
