# NOOA Guardrail System: Auditor Integration Plan (v3)

> **Goal**: Integrate TheAuditor's artifacts into NOOA for deterministic guardrails.  
> **Principle**: *"Copy YAML/templates only, clean-room for code (AGPL-safe)"*

---

## Critical Fixes (v3)

### ✅ Fix 1: Determinism Mode

**Problem**: `traceId` and `timestamp` break byte-identical JSON.

**Solution**: `--deterministic` flag (or `--json` implies it):
- No timestamps in findings
- `traceId` optional or fixed via `--trace-id <value>`
- Findings sorted by: rule → file → line → column

```typescript
// In deterministic mode:
findings.sort((a, b) => 
  a.rule.localeCompare(b.rule) ||
  a.file.localeCompare(b.file) ||
  a.line - b.line ||
  (a.column ?? 0) - (b.column ?? 0)
);
```

---

### ✅ Fix 2: Auditor-Compatible YAML Schema

**Problem**: Auditor uses `match.identifiers`, we proposed `match.anyOf`.

**Solution**: Loader accepts BOTH and normalizes internally:

```typescript
// Auditor-style (copy-first compatible)
match:
  identifiers: ["User", "Account"]
  expressions: ["jwt\\.sign"]

// NOOA-style (v2 proposed)  
match:
  anyOf:
    - { type: "literal", value: "User" }
    - { type: "regex", value: "jwt\\.sign" }

// Internal canonical form (after normalization)
interface CanonicalPattern {
  patterns: Array<{ type: "literal" | "regex"; value: string }>;
  logic: "anyOf" | "allOf";
}
```

---

### ✅ Fix 3: Exit Codes Scoped to Guardrail Only

**Problem**: Global 0-4 might break existing commands.

**Solution**: Apply only to `check`/`guardrail`:

| Code | Meaning | Scope |
|------|---------|-------|
| 0 | Success | all |
| 1 | Runtime error | all (unchanged) |
| 2 | Validation error | all (unchanged) |
| 3 | Blocking findings (critical/high) | check/guardrail only |
| 4 | Warning findings (medium/low) | check/guardrail only |

---

### ✅ Fix 4: Deterministic File Set

**Problem**: `rg .` respects `.gitignore` inconsistently.

**Solution**: Use `git ls-files` pipeline:

```typescript
// Default: tracked files only (deterministic)
const files = await execa("git", ["ls-files"], { cwd });
const fileList = files.stdout.split("\n").filter(Boolean);

// Pass to ripgrep via stdin
await execa("rg", [...args, "--files-from", "-"], {
  input: fileList.join("\n"),
  cwd,
});
```

Optional `--include-untracked` for exploration mode.

---

### ✅ Fix 5: AGPL License Safety

**Problem**: Auditor is AGPL-3.0; copying code contaminates NOOA.

**Solution**: Strict separation:

| Type | Action | Risk |
|------|--------|------|
| YAML templates | ✅ Copy 1:1 | Safe (config/data) |
| JSON examples | ✅ Copy 1:1 | Safe (config/data) |
| Python code | ❌ Clean-room reimpl | AGPL risk |
| CLI behavior | ✅ Spec from README | Safe (behavior, not code) |

---

## Updated Copy Map

### COPY 1:1 (Safe - Templates/Config)

| Auditor Source | NOOA Target |
|----------------|-------------|
| `theauditor/refactor/yaml_rules/profile.yaml` | `.nooa/guardrails/templates/profile.yaml` |
| `theauditor/context/semantic_rules/template.yaml` | `.nooa/guardrails/templates/semantic-context.yaml` |
| `theauditor/planning/examples/auth_migration.yaml` | `.nooa/guardrails/examples/auth-migration.yaml` |
| `theauditor/planning/examples/jwt_migration.yaml` | `.nooa/guardrails/examples/jwt-migration.yaml` |
| `theauditor/planning/examples/model_rename.yaml` | `.nooa/guardrails/examples/model-rename.yaml` |

### CLEAN-ROOM REIMPL (AGPL-Safe)

| Auditor Behavior | NOOA Implementation |
|------------------|---------------------|
| `base.py` Severity/Confidence enums | `contracts.ts` (from spec) |
| `profiles.py` YAML loading | `profiles.ts` (Zod + js-yaml) |
| `RefactorRuleEngine` pattern matching | `engine.ts` (ripgrep-based) |

---

## Directory Structure

```
.nooa/guardrails/              # User configs (copied from Auditor)
├── templates/                 # YAML templates
├── examples/                  # Migration examples
└── profiles/                  # User-defined profiles

src/features/guardrail/        # Clean-room TypeScript
├── contracts.ts               # Types (from spec)
├── schemas.ts                 # Zod validation
├── profiles.ts                # Auditor + NOOA format loader
├── engine.ts                  # Deterministic pattern engine
├── cli.ts                     # Façade command
└── *.test.ts                  # TDD tests
```

---

## Verification

```bash
# Determinism test (must pass)
nooa check --profile test.yaml --json --deterministic > /tmp/r1.json
nooa check --profile test.yaml --json --deterministic > /tmp/r2.json
diff /tmp/r1.json /tmp/r2.json  # Empty = pass

# Full suite
bun test && bun check && bun lint
```

---

## DeepResearch Prompt

The user provided a comprehensive Perplexity prompt that enforces:
- Copy-first for YAML/templates only
- Clean-room reimplementation for any logic
- AGPL license awareness
- Determinism requirements
- TDD + worktree workflow

Saved to: `docs/plans/2026-02-02-auditor-guardrail-deepresearch-prompt.md`
