# Guardrail Spec Commands Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add guardrail spec show/init and profile add/remove commands with tests.

**Architecture:** Extend guardrail CLI with subcommands for spec show/init and profile add/remove. Keep file operations scoped to `.nooa/guardrails` and reuse existing profile loader for normalization. Use simple file ops and yaml serialization.

**Tech Stack:** Bun test, TypeScript, yaml.

### Task 1: Add failing tests for `guardrail spec show`

**Files:**
- Modify: `src/features/guardrail/cli.test.ts`

**Step 1: Write the failing test**
```typescript
it("shows spec summary", async () => {
  consoleLogSpy.mockClear();
  process.chdir(tempDir);

  const guardrailMd = `
# GUARDRAIL.md

## Enabled Profiles

- zero-preguica
- security
`;
  await writeFile(join(tempDir, ".nooa/guardrails/GUARDRAIL.md"), guardrailMd);

  await guardrailCli(["spec", "show"]);

  const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
  expect(output).toContain("zero-preguica");
  expect(output).toContain("security");
});
```

**Step 2: Run test to verify it fails**
Run: `bun test src/features/guardrail/cli.test.ts`
Expected: FAIL (spec show missing).

**Step 3: Write minimal implementation**
Implement `guardrail spec show` in `src/features/guardrail/cli.ts` to print enabled profiles in order.

**Step 4: Run test to verify it passes**
Run: `bun test src/features/guardrail/cli.test.ts`
Expected: PASS.

### Task 2: Add failing tests for `guardrail spec init`

**Files:**
- Modify: `src/features/guardrail/cli.test.ts`

**Step 1: Write the failing test**
```typescript
it("initializes GUARDRAIL.md when missing", async () => {
  consoleLogSpy.mockClear();
  process.chdir(tempDir);

  await guardrailCli(["spec", "init"]);

  const content = await Bun.file(join(tempDir, ".nooa/guardrails/GUARDRAIL.md")).text();
  expect(content).toContain("Enabled Profiles");
  expect(content).toContain("zero-preguica");
});
```

**Step 2: Run test to verify it fails**
Run: `bun test src/features/guardrail/cli.test.ts`
Expected: FAIL (spec init missing).

**Step 3: Write minimal implementation**
Implement `guardrail spec init` to create GUARDRAIL.md with a minimal template.

**Step 4: Run test to verify it passes**
Run: `bun test src/features/guardrail/cli.test.ts`
Expected: PASS.

### Task 3: Add failing tests for `guardrail add/remove`

**Files:**
- Modify: `src/features/guardrail/cli.test.ts`

**Step 1: Write the failing test**
```typescript
it("adds and removes a profile", async () => {
  consoleLogSpy.mockClear();
  process.chdir(tempDir);

  await guardrailCli(["add", "my-profile"]);
  const added = await Bun.file(join(tempDir, ".nooa/guardrails/profiles/my-profile.yaml")).text();
  expect(added).toContain("refactor_name: my-profile");

  await guardrailCli(["remove", "my-profile", "--force"]);
  const exists = await Bun.file(join(tempDir, ".nooa/guardrails/profiles/my-profile.yaml")).exists();
  expect(exists).toBe(false);
});
```

**Step 2: Run test to verify it fails**
Run: `bun test src/features/guardrail/cli.test.ts`
Expected: FAIL (add/remove missing).

**Step 3: Write minimal implementation**
Implement `guardrail add <name>` to create a YAML profile skeleton in `.nooa/guardrails/profiles`. Implement `guardrail remove <name> --force` to delete that file.

**Step 4: Run test to verify it passes**
Run: `bun test src/features/guardrail/cli.test.ts`
Expected: PASS.

### Task 4: Update help text

**Files:**
- Modify: `src/features/guardrail/cli.ts`

**Step 1: Write failing test**
Update help test to assert `spec show`, `spec init`, `add`, and `remove` are present.

**Step 2: Run test to verify it fails**
Run: `bun test src/features/guardrail/cli.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**
Update `HELP_TEXT` with new commands and examples.

**Step 4: Run test to verify it passes**
Run: `bun test src/features/guardrail/cli.test.ts`
Expected: PASS.

