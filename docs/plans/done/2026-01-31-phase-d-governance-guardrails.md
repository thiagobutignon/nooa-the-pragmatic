# Phase D: Governance & Hypergrowth Guardrails

Enforce high-quality standards (Zero Preguiça) and project policies through an automated auditing engine.

## 1. Objective
Ensure that no code enters the repository if it violates the "Hypergrowth" policy (e.g., TODOs, Mocks, lack of documentation).

## 2. Proposed Changes

### [NEW] `.nooa/POLICY.md` (or `.nooa/policy.json`)
- Define "LOCKED" rules for the project:
  - No `// TODO` in production files.
  - Every command must have `--json` support.
  - Every feature must have a corresponding test and doc file.

### [NEW] `src/features/check/`
- **`nooa check`**: Auditor command that scans changed files against the Policy.
- **Contract Enforcement**: Use AST parsers or regex-based rules to find "preguiça" (mocks, incomplete code).

### [MODIFY] `src/features/commit/` & `src/features/push/`
- **Pre-flight Check**: Automatically run `nooa check` before allowing a commit or push. Fail with Exit 2 if rules are violated.

## 3. Verification Plan
- **Blocking Test**: Insert a `// TODO` in a file and attempt `nooa commit`. Verify it is blocked.
- **Standards Test**: Create a command without a doc file and verify `nooa check` fails.
- **Enforcement Test**: Verify that `nooa commit --force` (or equivalent) is the only way to bypass if absolutely necessary.
