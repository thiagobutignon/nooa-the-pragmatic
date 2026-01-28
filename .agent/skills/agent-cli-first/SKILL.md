---
name: agent-cli-first
description: Use when starting a new project or feature, or when an agent is drifting into UI/API work before core behavior is testable and deterministic via command execution.
---

# Agent-CLI-First Development

## Overview

**The CLI is the agent’s interface contract.**

CLI-first is not a preference. It is a control system: it forces a tight, deterministic loop where an agent can run the product, observe stdout/stderr, and converge quickly.

If the agent can run the feature as a command, it can:
- test it
- debug it (stderr)
- iterate without “UI fog”
- verify outcomes deterministically

**UI/API/MCP come later as adapters.**

---

## When to Use

Use this whenever:
- Starting a greenfield project or a new feature
- Implementing “core logic” (rules, pricing, auth, payments, migrations, pipelines)
- Refactoring risky code (coupled, flaky, unclear boundaries)
- Integrations (before webhooks/controllers, build the CLI that exercises the behavior)

Do **not** use this for:
- Pure UI polish work (spacing, animations) that has no meaningful core logic
- Features that are inherently visual-first and cannot be validated via text output (rare)

---

## The Architecture (Mental Model)

The CLI is a **thin adapter** over stable boundaries.

```mermaid
flowchart LR
  A[Agent/Human] -->|invoke| B[CLI]
  B -->|parse args| C[Use-cases]
  C --> D[Domain/Core]
  D --> C
  C -->|result| B
  B -->|stdout/stderr + exit code| A

  subgraph Later (Adapters)
    E[MCP Server] -->|wrap| C
    F[REST/GraphQL] -->|wrap| C
    G[Frontend] -->|calls| F
  end
````

---

## Non-Negotiable Invariants (The Rules)

1. **Help is the spec.**
   `--help` is the design doc and the contract.

2. **No interaction by default.**
   Every input must be expressible via flags/env. If you support prompts, you MUST support `--no-interactive`.

3. **Machine output exists.**
   Always support `--json` (stable schema). Human output is optional.

4. **stdout vs stderr discipline.**

   * `stdout` = data (text or JSON)
   * `stderr` = logs, diagnostics, progress, warnings

5. **Exit codes are semantic.**

   * `0` success
   * non-zero failure (agents stop on failure)

6. **Side-effects require `--dry-run`.**
   If it mutates state / charges money / deletes files, it MUST support `--dry-run`.

7. **No UI/API until CLI passes gates.**
   If you need UI to “see if it works”, you’re drifting.

---

## The Workflow: Spec → RED → GREEN → Gates

### 1) Spec via `--help` (Write this first)

Write the help text before writing implementation code.

```bash
$ my-app users create --help

Usage:
  my-app users create <email> [options]

Options:
  --role <admin|editor>   User role (default: editor)
  --json                  Output as JSON (stable schema)
  --dry-run               Do not persist changes
  --no-interactive        Disable prompts; fail if missing required args
```

If you cannot write a clean `--help`, the feature is not understood.

---

### 2) RED: Test by executing the command

The test MUST invoke the CLI and assert on stdout/stderr/exit code.

```ts
import { execa } from "execa";

test("users create --json returns a user object", async () => {
  const res = await execa("bun", ["src/cli.ts", "users", "create", "test@example.com", "--role", "admin", "--json"], {
    reject: false,
  });

  expect(res.exitCode).toBe(0);
  const user = JSON.parse(res.stdout);
  expect(user.email).toBe("test@example.com");
  expect(user.role).toBe("admin");
  expect(user.id).toBeTruthy();
});
```

**Important:** RED must fail for the right reason (missing behavior), not because the test is broken.

---

### 3) GREEN: Minimal implementation behind the CLI

Implementation order:

1. command exists + parses args
2. calls a use-case boundary
3. returns structured output
4. only then refactor

Do not put business rules in CLI parsing.

---

### 4) Gates: Definition of Done (DoD)

A task is not “done” until these pass:

* `lint`
* `typecheck`
* `test` (including CLI tests)
* optional: `security audit`, `coverage`, `format`

If gates fail: attach outputs and go back to GREEN.

---

## Red Flags (STOP and Correct Course)

* “I’ll add a quick React form to test it.”
  → You just added a second system (UI state) to debug the first system (logic).

* “I need the browser to see the result.”
  → The agent can’t reliably “see” it. Add `--json` output.

* “The CLI needs an interactive prompt.”
  → Your automation just broke. Add flags/env equivalents and `--no-interactive`.

* “CLI parsing is boilerplate, I’ll do it later.”
  → You won’t. The logic will couple to UI/controllers and become hard to test.

---

## Common Rationalizations (And the Counter)

| Rationalization             | Counter                                                             |
| --------------------------- | ------------------------------------------------------------------- |
| “This is a visual app.”     | Visuals are a rendering. First prove the data flow and constraints. |
| “CLI is extra work.”        | It’s the cheapest test harness and the fastest agent loop.          |
| “We’ll add CLI later.”      | Later becomes never; coupling becomes permanent.                    |
| “The API is the interface.” | For agents, a command is the interface. APIs are wrappers.          |

---

## Agent-Ready Checklist

Your CLI is agent-ready when:

* [ ] `--help` matches real behavior and flags
* [ ] Runs fully non-interactively (`--no-interactive` supported)
* [ ] `--json` output exists with stable schema
* [ ] stdout is clean data; stderr is diagnostics
* [ ] exit codes are correct and consistent
* [ ] `--dry-run` exists for side-effect commands
* [ ] CLI tests exist and run in CI
* [ ] gates pass reliably

---

## Quick Reference

**Golden Rule:** If it’s not runnable as a command, it’s not ready for an agent.

**Phase order:**

1. CLI contract (`--help`)
2. CLI execution tests (RED)
3. minimal behavior (GREEN)
4. gates
5. then adapters (API/MCP/UI)

---

## Related Skills: **MUST READ**

* **REQUIRED:** `test-driven-development`
* **RECOMMENDED:** `create-cli`
* **REFERENCES** `cli-guidelines`