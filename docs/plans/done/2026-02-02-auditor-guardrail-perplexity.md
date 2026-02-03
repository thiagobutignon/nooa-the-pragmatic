# ðŸ”¬ DEEP RESEARCH PROMPT: TheAuditorTool/Auditor â†’ NOOA The Pragmatic

**Version:** 1.0  
**Date:** February 2026  
**Audience:** Claude Opus / Perplexity (Staff Engineer Mode)  
**Goal:** Surgical port of Auditor deterministic guardrails + schemas into NOOA

---

## EXECUTIVE SUMMARY

**Mission:** Extract **100% reusable artifacts** (YAML, JSON, schemas, templates, policies, rulesets) from archived Auditor repo and integrate into NOOA as deterministic guardrail/audit CLI command.

**Principle:** *"Copy-first, generate-only-when-needed"*  
**Quality Bar:** All code TDD, green tests, zero TODOs, production-ready.

**Expected Output:**
1. Inventory of copiable artifacts + adaptation delta
2. Gap analysis (Auditor features vs NOOA current state)
3. Phased execution plans (P0-P3, TDD-first, worktree-based)
4. Final CLI command spec (`nooa audit` / `nooa guardrails check`)
5. Validation checklist

---

## PART 1: INVESTIGATION SCOPE

### Context

**Repo A (upstream):** [TheAuditorTool/Auditor](https://github.com/TheAuditorTool/Auditor)
- Status: Archived (read-only, 23 Jan 2026)
- Core: SAST + AI-generated code auditor
- Philosophy: Deterministic security rules, SQLite DB, graph analysis, offline-first

**Repo B (our project):** [thiagobutignon/nooa-the-pragmatic](https://github.com/thiagobutignon/nooa-the-pragmatic)
- Status: Active, hypergrowth mode
- Core: Agentic CLI, code generation + self-correction
- Philosophy: Autonomous agents, memory-driven, TDD-first
- Tech: Bun, TypeScript, Ink.js (TUI coming)

**Synergy:** Auditor's determinism + NOOA's autonomy = unhackable agentic CLI

---

## PART 2: AUDITOR INVENTORY (REPO A)

### Task 2.1: List all copiable artifacts

**You must:**
1. Clone `https://github.com/TheAuditorTool/Auditor.git`
2. Find **all** `.yaml/.yml/.json/.jsonc/.md` files in:
   - `/openspec` (if exists)
   - `/rules`
   - `/policies`
   - `/schemas`
   - `/templates`
   - `/workflows`
   - `/pipelines`
   - `/config`
   - root level (README, Architecture, etc.)

3. For each file, generate inventory entry:

```
### Artifact: <filename>
**Path:** <full-path-from-repo-root>
**Type:** [policy|schema|template|workflow|prompt|config|ruleset|report|spec]
**Size:** <lines-of-code>
**Function:** <1 sentence what it does>
**Usage:** <which modules reference it>
**Copy-readiness:** [1:1-ready|needs-min-adapt|not-applicable]
**Adaptation delta:** <specific changes needed>
**Priority:** [P0-critical|P1-important|P2-nice-to-have]
```

### Task 2.2: Extract core loop architecture

**You must analyze:**
1. How Auditor **defines rules** (syntax, structure, validation)
2. How it **executes checks** (rule engine logic, scoring)
3. How it **structures reports** (JSON schema, determinism guarantee)
4. How it **traces findings** (provenance, confidence, fix suggestions)

**Output format:**
```
## Auditor Core Loop

### Rule Definition Format
<example YAML/JSON of 1 rule with explanation>

### Check Execution Pattern
<pseudo-code or flow of how a rule â†’ check â†’ result>

### Report Schema
<JSON schema of final report>

### Determinism Guarantee
<how does Auditor ensure same input â†’ same output>

### Traceability Model
<how findings are traced to code, commits, AI providers>
```

### Task 2.3: CLI commands and UX patterns

**Extract:**
1. All CLI commands (`auditor --help`, `auditor run`, `auditor report`, etc.)
2. Flags: `--json`, `--profile`, `--output`, `--strict`, etc.
3. Exit codes used
4. Error handling patterns
5. Progress/logging output patterns

---

## PART 3: NOOA INVENTORY (REPO B)

### Task 3.1: Current guardrail/audit infrastructure

**Find and document:**
1. Where policy/guardrail logic exists today (search for "policy", "check", "guard", "rule")
2. Current JSON schemas (for what outputs?)
3. Current CLI commands related to checking/validation
4. Telemetry and traceability mechanisms
5. Test patterns for deterministic features

**Output:**
```
## NOOA Current State

### Existing Guardrail Infrastructure
- Location: <path>
- What it does: <1 sentence>
- Test coverage: <%>
- Extensibility: [easy|moderate|hard]

### JSON Schemas Already in Use
- Schema files: <paths>
- What they validate: <domain>

### Related CLI Commands
- `<command>`: <what it does>

### Gaps (vs Auditor)
- Missing: <list>
- Weak: <list>
```

### Task 3.2: Repo structure analysis

**Map:**
1. Feature-based folder structure (vertical slices, `src/features/`)
2. Where tests live (`tests/`, colocation, patterns)
3. Where configs/policies should live (`.nooa/`, `src/config/`)
4. CLI command registration (`src/commands/`, `registerCommand`, etc.)
5. Telemetry and logging setup

---

## PART 4: COMPARISON MATRIX

**Build a 3-column table:**

```
| Auditor Feature | NOOA Today | Status | Plan |
|---|---|---|---|
| Rule definition YAML/JSON format | ? | [missing/exists/weak] | [copy-1:1/adapt/skip] |
| Taint analysis | ? | ? | ? |
| Dependency graph | ? | ? | ? |
| SQLite code DB | ? | ? | ? |
| Deterministic output JSON schema | ? | ? | ? |
| Risk scoring model | ? | ? | ? |
| Fix recommendation engine | ? | ? | ? |
| Offline SAST | ? | ? | ? |
| CI/CD integration | ? | ? | ? |
| Telemetry/provenance | ? | ? | ? |
```

---

## PART 5: DELIVERABLES (WHAT YOU MUST PRODUCE)

### Deliverable 1: Copy-First Manifest

**Format:** Prioritized list, actionable

```
## COPY WITHOUT CHANGES (P0)
1. File: <path-in-auditor> â†’ <path-in-nooa>
   Reason: <why 1:1 copy is safe>
   Validation: <how to verify it works>

2. File: ...

## COPY + MINIMAL ADAPT (P1)
1. File: <path> â†’ <path>
   Changes:
   - Rename: <old> â†’ <new>
   - Update imports: <old-module> â†’ <new-module>
   - Update paths: <old-root> â†’ <new-root>
   Validation: <test to verify>

## SKIP (Reasons)
1. File: <path>
   Reason: <conflicts|desnecessÃ¡rio|out-of-scope>
```

### Deliverable 2: Feature Gap Analysis

```
## Feature Parity Matrix

| Feature | Auditor | NOOA | Gap | Priority | Plan |
|---------|---------|------|-----|----------|------|
| Taint analysis | âœ“ | âœ— | Full feature missing | P1 | Implement `src/features/guardrails/taint.ts` |
| ... | | | | | |

## Minimum Viable Set (MVP to copy)
The 3-5 features that, once ported, unlock **10x** audit capability:
1. <feature> (impact: <justification>)
2. <feature>
3. ...
```

### Deliverable 3: Execution Plans (TDD + Worktree)

**Format per plan:**
```
## PLAN P<N>: <Title>

**Objective:** <what feature/integration is done>
**Duration:** <estimate>
**Worktree:** `feat/auditor-p<n>`
**Dependency:** P<N-1> (or none)

### Tasks
- [ ] **Task 1:** <what>
  - Failing test: `src/features/guardrails/...test.ts`
  - Implementation: `src/features/guardrails/...ts`
  - Files copied: `<list>`
  - Commits: `feat: <title>`

- [ ] **Task 2:** ...

### Acceptance Criteria
- [ ] `bun test` passes
- [ ] No TODOs/MOCK/FIXME
- [ ] `bun check` clean
- [ ] `bun linter` clean
- [ ] JSON output matches schema
- [ ] Documentation updated

### Testing Strategy
- Unit: <test scope>
- Integration: <e2e scope>
- Property: <invariants>

### Risk / Mitigation
- Risk: <what could go wrong>
  Mitigation: <how to prevent>
```

### Deliverable 4: CLI Command Spec

**Example output:**
```
## Command: `nooa audit`

### Help Text
```
Usage: nooa audit [OPTIONS] [PATH]

Run deterministic audit on code (Auditor-style guardrails).

ARGUMENTS:
  [PATH]  File or directory to audit (default: .)

OPTIONS:
  --profile <NAME>      Rule profile: strict|standard|lenient (default: standard)
  --rules <FILE>        Custom rules YAML file
  --json                Output as JSON (parseable by agents/CI)
  --report <FILE>       Save report to file
  --fix                 Auto-fix issues where possible
  --confidence <FLOAT>  Min confidence level 0.0-1.0 (default: 0.5)
  --no-cache            Ignore cached results
  -v, --verbose         Detailed output
  -h, --help            Show this help
```

### Exit Codes
- 0: All clear
- 1: Issues found (no blockers)
- 2: Blocking issues (fix required)
- 64: Input error (bad path, bad rules, etc.)
- 69: Service unavailable (LLM/DB error)

### JSON Output Schema
```json
{
  "status": "pass|warning|fail",
  "issues": [
    {
      "id": "rule-id",
      "severity": "info|warn|error|blocker",
      "file": "path/to/file.ts",
      "line": 42,
      "message": "SQL injection risk detected",
      "fix": "use parameterized query",
      "confidence": 0.95,
      "trace": {
        "rule": "sql-injection-pattern",
        "provider": "auditor",
        "timestamp": "2026-02-08T20:56:00Z"
      }
    }
  ],
  "summary": {
    "files_scanned": 42,
    "issues_total": 3,
    "issues_by_severity": { "error": 2, "warn": 1 },
    "deterministic": true,
    "execution_ms": 234
  },
  "meta": {
    "command": "audit",
    "profile": "standard",
    "trace_id": "uuid-here"
  }
}
```

### Integration into CI
```bash
# .github/workflows/audit.yml
- run: bun index.ts audit . --profile strict --json --report audit.json
- if: failure()
  run: cat audit.json | jq '.summary'
```

---

## PART 6: VALIDATION CHECKLIST

**Before shipping Auditor port, verify:**

```
### Code Quality
- [ ] `bun test` passes (100%)
- [ ] Coverage: >80% on guardrails feature
- [ ] `bun check` clean (type errors = 0)
- [ ] `bun linter` clean
- [ ] No TODOs, FIXMEs, MOCKs in committed code
- [ ] Imports all resolve

### Determinism
- [ ] Same input file â†’ same JSON output (run 3x, diff = empty)
- [ ] Rules versioned (rules YAML has version field)
- [ ] Results traceable to rules and code line numbers
- [ ] Confidence scores consistent

### UX and CLI
- [ ] `--help` works
- [ ] `--json` outputs valid JSON per schema
- [ ] Exit codes correct
- [ ] Error messages actionable
- [ ] Works in CI (no TTY deps)

### Integration
- [ ] `nooa audit` discoverable (in `nooa --help` list)
- [ ] Plugs into `nooa ci` if needed
- [ ] Telemetry logged
- [ ] Documentation in `docs/commands/audit.md`

### Artifacts Copied
- [ ] All P0 artifacts copied 1:1
- [ ] All P1 artifacts copied + adapted
- [ ] Audit trail: which Auditor file â†’ which NOOA file
```

---

## PART 7: SUCCESS METRICS

**After this port, measure:**

1. **Coverage:** % of Auditor rule types implemented in NOOA
   - Target: 80%+ of OWASP Top 10 rules ported
   - Measurement: `audit --profile strict` on real codebase

2. **Determinism:** Reproducibility
   - Target: 100% deterministic (same commit â†’ same report)
   - Measurement: Run audit 10x on same commit, diffs

3. **Speed:** Latency
   - Target: <500ms for typical file
   - Measurement: `time nooa audit src/`

4. **Adoption:** Integration ease
   - Target: 1-liner for new projects
   - Measurement: `curl | sh` script that sets up audit in CI

5. **Quality:** Agent trust
   - Target: Agents pass guardrails on first try 90% of time
   - Measurement: eval metrics from `nooa eval` against pre/post-audit code

---

## PART 8: FINAL QUESTION (FOR RECOMMENDATION)

After analyzing both repos, answer:

**What is the minimal cut of Auditor features that, once ported to NOOA, transforms it from "code generation agent" into "unhackable + auditable agentic CLI" that competitors cannot match?**

Rank by impact/effort ratio and explain why.

---

## APPENDIX: Tools You'll Need

```bash
# Clone both repos locally
git clone https://github.com/TheAuditorTool/Auditor.git /tmp/auditor-research
git clone https://github.com/thiagobutignon/nooa-the-pragmatic.git /tmp/nooa-research

# Create worktree in NOOA
cd /tmp/nooa-research
nooa worktree create feat/auditor-port

# Search for patterns
cd .worktrees/feat-auditor-port
grep -r "policy\|guard\|rule\|check" src/
grep -r "\.json\|\.yaml" src/

# When ready to compare
diff -r /tmp/auditor-research/openspec src/features/guardrails/specs/
```

---

**Ready to execute?** Copy this entire prompt into **Claude Opus** or **Perplexity Deep Research** mode, then tag me with findings.

---

*Compiled by: NOOA Technical Architecture*  
*Date: February 8, 2026*