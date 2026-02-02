# Prompt Commands Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `create`, `edit`, `delete`, `publish` subcommands to `nooa prompt`, update help text and `docs/commands/prompt.md`, and ensure behavior is covered by TDD.

**Architecture:** Introduce a small service layer (`src/features/prompt/service.ts`) that performs filesystem I/O and uses `PromptEngine` for parsing/bumping, while the CLI remains a thin orchestrator. This keeps parsing/render logic in `PromptEngine` and puts side-effecting operations in a single testable module.

**Tech Stack:** Bun test runner, TypeScript, filesystem APIs, existing prompt engine.

---

### Task 1: Add prompt service for create

**Files:**
- Create: `src/features/prompt/service.ts`
- Test: `src/features/prompt/service.test.ts`

**Step 1: Write the failing test**

```ts
import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPrompt } from "./service";

test("createPrompt writes a new prompt file with frontmatter and body", async () => {
  const root = await mkdtemp(join(tmpdir(), "nooa-prompt-"));
  const templatesDir = join(root, "src/features/prompt/templates");
  await mkdir(templatesDir, { recursive: true });

  await createPrompt({
    templatesDir,
    name: "alpha",
    description: "Alpha",
    output: "markdown",
    body: "Hello {{world}}",
  });

  const content = await readFile(join(templatesDir, "alpha.md"), "utf8");
  expect(content).toContain("name: alpha");
  expect(content).toContain("version: 1.0.0");
  expect(content).toContain("description: \"Alpha\"");
  expect(content).toContain("output: markdown");
  expect(content).toContain("Hello {{world}}");

  await rm(root, { recursive: true, force: true });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/prompt/service.test.ts`
Expected: FAIL because `createPrompt` is missing.

**Step 3: Write minimal implementation**

Implement `createPrompt` in `src/features/prompt/service.ts`:
- Ensure templates directory exists
- Reject if file exists
- Write frontmatter with version `1.0.0`
- Append body after `---` delimiters

**Step 4: Run test to verify it passes**

Run: `bun test src/features/prompt/service.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/prompt/service.ts src/features/prompt/service.test.ts
git commit -m "feat: add prompt create service"
```

---

### Task 2: Add edit using patch

**Files:**
- Modify: `src/features/prompt/service.ts`
- Modify: `src/features/prompt/service.test.ts`

**Step 1: Write the failing test**

```ts
test("editPrompt applies a unified diff patch to a prompt file", async () => {
  const root = await mkdtemp(join(tmpdir(), "nooa-prompt-"));
  const templatesDir = join(root, "src/features/prompt/templates");
  await mkdir(templatesDir, { recursive: true });
  await writeFile(join(templatesDir, "beta.md"), "---\nname: beta\nversion: 1.0.0\ndescription: \"Beta\"\noutput: markdown\n---\n\nHello\n");

  await editPrompt({
    templatesDir,
    name: "beta",
    patch: "@@\n-Hello\n+Hello world\n",
  });

  const content = await readFile(join(templatesDir, "beta.md"), "utf8");
  expect(content).toContain("Hello world");

  await rm(root, { recursive: true, force: true });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/prompt/service.test.ts`
Expected: FAIL because `editPrompt` is missing.

**Step 3: Write minimal implementation**

Implement `editPrompt` in `src/features/prompt/service.ts`:
- Read file content
- Apply patch using the same patch helper as `code write --patch` (import from `src/features/code/patch`)
- Write updated content back

**Step 4: Run test to verify it passes**

Run: `bun test src/features/prompt/service.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/prompt/service.ts src/features/prompt/service.test.ts
git commit -m "feat: add prompt edit via patch"
```

---

### Task 3: Add delete

**Files:**
- Modify: `src/features/prompt/service.ts`
- Modify: `src/features/prompt/service.test.ts`

**Step 1: Write the failing test**

```ts
test("deletePrompt removes a prompt file", async () => {
  const root = await mkdtemp(join(tmpdir(), "nooa-prompt-"));
  const templatesDir = join(root, "src/features/prompt/templates");
  await mkdir(templatesDir, { recursive: true });
  await writeFile(join(templatesDir, "gamma.md"), "---\nname: gamma\nversion: 1.0.0\n---\n\nHello\n");

  await deletePrompt({ templatesDir, name: "gamma" });
  await expect(readFile(join(templatesDir, "gamma.md"), "utf8")).rejects.toThrow();

  await rm(root, { recursive: true, force: true });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/prompt/service.test.ts`
Expected: FAIL because `deletePrompt` is missing.

**Step 3: Write minimal implementation**

Implement `deletePrompt` in `src/features/prompt/service.ts`:
- Delete the file at `<templatesDir>/<name>.md`
- Throw a clear error if it doesn’t exist

**Step 4: Run test to verify it passes**

Run: `bun test src/features/prompt/service.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/prompt/service.ts src/features/prompt/service.test.ts
git commit -m "feat: add prompt delete"
```

---

### Task 4: Add publish with changelog

**Files:**
- Modify: `src/features/prompt/service.ts`
- Modify: `src/features/prompt/service.test.ts`
- Create: `src/features/prompt/CHANGELOG.md`

**Step 1: Write the failing test**

```ts
test("publishPrompt bumps version and appends to changelog", async () => {
  const root = await mkdtemp(join(tmpdir(), "nooa-prompt-"));
  const templatesDir = join(root, "src/features/prompt/templates");
  const changelogPath = join(root, "src/features/prompt/CHANGELOG.md");
  await mkdir(templatesDir, { recursive: true });
  await writeFile(join(templatesDir, "delta.md"), "---\nname: delta\nversion: 1.0.0\ndescription: \"Delta\"\noutput: markdown\n---\n\nHello\n");

  const next = await publishPrompt({
    templatesDir,
    name: "delta",
    level: "patch",
    changelogPath,
    note: "Initial publish",
  });

  const updated = await readFile(join(templatesDir, "delta.md"), "utf8");
  expect(updated).toContain("version: 1.0.1");
  expect(next).toBe("1.0.1");

  const changelog = await readFile(changelogPath, "utf8");
  expect(changelog).toContain("## delta");
  expect(changelog).toContain("### v1.0.1");
  expect(changelog).toContain("- Initial publish");

  await rm(root, { recursive: true, force: true });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/prompt/service.test.ts`
Expected: FAIL because `publishPrompt` is missing.

**Step 3: Write minimal implementation**

Implement `publishPrompt` in `src/features/prompt/service.ts`:
- Use `PromptEngine.bumpVersion` to update the file
- Return new version string
- Update `CHANGELOG.md`:
  - Ensure file exists, create if not
  - Add section `## <name>` if missing
  - Prepend entry `### v<version> - YYYY-MM-DD` with bullet note

**Step 4: Run test to verify it passes**

Run: `bun test src/features/prompt/service.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/prompt/service.ts src/features/prompt/service.test.ts src/features/prompt/CHANGELOG.md
git commit -m "feat: add prompt publish with changelog"
```

---

### Task 5: Wire CLI for new subcommands + help

**Files:**
- Modify: `src/features/prompt/cli.ts`
- Modify: `src/features/prompt/cli.test.ts`

**Step 1: Write failing tests**

Add tests to `src/features/prompt/cli.test.ts`:
- `prompt create` requires `--description` and body
- `prompt edit` requires patch input
- `prompt delete` requires name
- `prompt publish` requires name and level
- `--help` includes new subcommands

**Step 2: Run tests to verify failure**

Run: `bun test src/features/prompt/cli.test.ts`
Expected: FAIL for new cases.

**Step 3: Implement CLI plumbing**

- Extend `promptHelp` and usage
- Parse new flags: `--description`, `--output`, `--level`, `--note`, `--patch`
- Use `getStdinText` for `edit` and `publish` note if `--note` missing
- Call prompt service functions
- Respect `--json` output

**Step 4: Run tests to verify pass**

Run: `bun test src/features/prompt/cli.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/prompt/cli.ts src/features/prompt/cli.test.ts
git commit -m "feat: add prompt cli commands"
```

---

### Task 6: Update docs

**Files:**
- Modify: `docs/commands/prompt.md`

**Step 1: Update documentation**
- Document `create/edit/delete/publish`
- Add examples for patch edit and publish with changelog
- Mention changelog file `src/features/prompt/CHANGELOG.md`

**Step 2: Commit**

```bash
git add docs/commands/prompt.md
git commit -m "docs: update prompt command"
```

---

### Task 7: Verify full test suite

Run: `bun test`
Expected: All pass.

---

### Task 8: Open PR and dogfood

- Use `nooa pr create` to open PR with a comment in markdown
- Use `nooa pr comment` to add a second markdown comment
- Merge PR using **squash** or **rebase** (not merge)

---

### Task 9: Finish branch

Use **superpowers:finishing-a-development-branch** to merge/cleanup locally as requested.
