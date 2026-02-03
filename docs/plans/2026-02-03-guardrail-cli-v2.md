# Guardrail CLI V2 Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add essential guardrail profile/spec management commands and fix review findings (allOf semantics, spec parsing, thresholds/exclusions, non-git behavior) using TDD.

**Architecture:** Extend guardrail CLI subcommands with list/show/spec validate; keep engine deterministic but fix allOf to require AND semantics. Spec parsing should be ESM-safe and thresholds/exclusions should affect report and filtering. Guardrail should behave predictably in non-git repos.

**Tech Stack:** Bun test, TypeScript, existing guardrail modules, zod.

### Task 1: Add failing tests for allOf semantics

**Files:**
- Modify: `src/features/guardrail/engine.test.ts`

**Step 1: Write the failing test**
```typescript
it("requires all patterns in allOf within same file", async () => {
  const profile: RefactorProfile = {
    refactor_name: "allof-test",
    description: "allOf must require both patterns",
    rules: [
      {
        id: "allof",
        description: "both required",
        severity: "low",
        match: {
          allOf: [
            { type: "literal", value: "TODO" },
            { type: "literal", value: "FIXME" },
          ],
        },
      },
    ],
  };

  const engine = new GuardrailEngine(tempDir);
  const findings = await engine.evaluate(profile);

  // In our fixture, TODO and FIXME are in different files, so no match
  expect(findings.length).toBe(0);
});
```

**Step 2: Run test to verify it fails**
Run: `bun test src/features/guardrail/engine.test.ts`
Expected: FAIL with non-zero findings.

**Step 3: Write minimal implementation**
Update `src/features/guardrail/engine.ts` to enforce AND semantics by restricting results to files that contain all patterns in `allOf`.

**Step 4: Run test to verify it passes**
Run: `bun test src/features/guardrail/engine.test.ts`
Expected: PASS.

### Task 2: Add failing tests for spec custom rules ESM-safe parsing

**Files:**
- Modify: `src/features/guardrail/spec.test.ts`

**Step 1: Write the failing test**
```typescript
it("parses custom rules without require()", async () => {
  const specContent = `
## Custom Rules

\`\`\`yaml
rules:
  - id: custom-rule
    description: Custom test rule
    severity: high
    match:
      anyOf:
        - type: literal
          value: "DEPRECATED"
\`\`\`
`;
  await writeFile(join(tempDir, "custom-esm.md"), specContent);

  const spec = await parseGuardrailSpec(join(tempDir, "custom-esm.md"));
  expect(spec.customRules.length).toBe(1);
});
```

**Step 2: Run test to verify it fails**
Run: `bun test src/features/guardrail/spec.test.ts`
Expected: FAIL if require() breaks parsing.

**Step 3: Write minimal implementation**
Replace `require("yaml")` with ESM-safe import usage in `src/features/guardrail/spec.ts`.

**Step 4: Run test to verify it passes**
Run: `bun test src/features/guardrail/spec.test.ts`
Expected: PASS.

### Task 3: Add failing tests for thresholds/exclusions enforcement

**Files:**
- Modify: `src/features/guardrail/cli.test.ts`
- Modify: `src/features/guardrail/spec.test.ts`

**Step 1: Write the failing tests**
Add a spec with `Exclusions` and `Thresholds` and assert they affect report status and findings.

**Step 2: Run tests to verify they fail**
Run: `bun test src/features/guardrail/cli.test.ts src/features/guardrail/spec.test.ts`
Expected: FAIL (thresholds/exclusions ignored).

**Step 3: Write minimal implementation**
- Apply exclusions to findings in spec-based check.
- Apply thresholds to status calculation (block/warn/pass).

**Step 4: Run tests to verify they pass**
Run: `bun test src/features/guardrail/cli.test.ts src/features/guardrail/spec.test.ts`
Expected: PASS.

### Task 4: Add failing tests for guardrail list/show/spec validate commands

**Files:**
- Modify: `src/features/guardrail/cli.test.ts`

**Step 1: Write failing tests**
Add tests for:
- `guardrail list` shows built-in profiles in `.nooa/guardrails/profiles`
- `guardrail show <name>` outputs normalized YAML (after load/normalize)
- `guardrail spec validate` validates GUARDRAIL.md and referenced profiles

**Step 2: Run tests to verify they fail**
Run: `bun test src/features/guardrail/cli.test.ts`
Expected: FAIL (commands missing).

**Step 3: Write minimal implementation**
- Add CLI subcommands and handlers in `src/features/guardrail/cli.ts`.
- Add support functions in `src/features/guardrail/spec.ts` or new module as needed.

**Step 4: Run tests to verify they pass**
Run: `bun test src/features/guardrail/cli.test.ts`
Expected: PASS.

### Task 5: Handle non-git repo behavior deterministically

**Files:**
- Modify: `src/features/guardrail/engine.test.ts`
- Modify: `src/features/guardrail/engine.ts`

**Step 1: Write failing test**
Create a temp directory without git init and assert engine evaluates over files via fallback (or returns explicit warning status).

**Step 2: Run test to verify it fails**
Run: `bun test src/features/guardrail/engine.test.ts`
Expected: FAIL (currently returns empty).

**Step 3: Write minimal implementation**
Implement a deterministic fallback file list (e.g., recursive list) or explicit error propagated to CLI.

**Step 4: Run test to verify it passes**
Run: `bun test src/features/guardrail/engine.test.ts`
Expected: PASS.

### Task 6: Update CLI help and documentation

**Files:**
- Modify: `src/features/guardrail/cli.ts`

**Step 1: Write failing test**
Extend CLI tests to assert help includes new commands and spec usage.

**Step 2: Run test to verify it fails**
Run: `bun test src/features/guardrail/cli.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**
Update `HELP_TEXT` and help path to include new commands and examples.

**Step 4: Run test to verify it passes**
Run: `bun test src/features/guardrail/cli.test.ts`
Expected: PASS.

