# Scaffold Templates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update scaffold templates to match the new CommandBuilder self-evolving module standard and remove outdated templates.

**Architecture:** Templates should generate a single `cli.ts` per feature using CommandBuilder (SSOT schema, meta, errors, docs) plus a CLI test. No separate `execute.ts` layer for scaffolded commands. Docs remain optional.

**Tech Stack:** Bun, TypeScript, CommandBuilder, scaffold engine.

### Task 1: Update command CLI template

**Files:**
- Modify: `src/features/scaffold/templates/command-cli.ts.tpl`
- Modify: `src/features/scaffold/templates/command-cli-test.ts.tpl`
- Modify: `src/features/scaffold/templates/command-docs.md.tpl`

**Step 1: Replace template with CommandBuilder SSOT structure**
- Add meta, help, usage, schema, output fields, errors, exit codes, examples.
- Implement `run()` returning `SdkResult`.
- Build CommandBuilder with `onSuccess/onFailure` and telemetry.

**Step 2: Align CLI test template with new output**
- Help test checks `Usage: nooa {{name}}`.
- JSON test runs `nooa {{name}} hello --json` and expects `ok`, `traceId`, `message`.

**Step 3: Update docs template**
- Reflect new JSON output shape and usage.

**Step 4: Verify template content by inspection**
- Ensure placeholders match `{{name}}`, `{{camelName}}`, `{{Command}}`.

**Step 5: Commit**
```
git add src/features/scaffold/templates/command-cli.ts.tpl src/features/scaffold/templates/command-cli-test.ts.tpl src/features/scaffold/templates/command-docs.md.tpl
```

---

### Task 2: Remove outdated templates and adjust scaffold execution

**Files:**
- Delete: `src/features/scaffold/templates/command-execute.ts.tpl`
- Delete: `src/features/scaffold/templates/command-execute-test.ts.tpl`
- Modify: `src/features/scaffold/execute.ts`

**Step 1: Remove execute template files**
- Delete both execute templates.

**Step 2: Update scaffold file list**
- Remove `execute.ts` and `execute.test.ts` from generated file list.

**Step 3: Commit**
```
git add src/features/scaffold/execute.ts
```

---

### Task 3: Optional quick validation

**Step 1: (Optional) Run tests for scaffold**
```
bun test src/features/scaffold
```

**Step 2: Commit**
```
git add docs/plans/2026-02-05-scaffold-templates.md
```
