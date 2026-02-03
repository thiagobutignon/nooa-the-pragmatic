You are Claude Opus acting as a senior staff engineer and codebase auditor.

MISSION
Integrate the most valuable, COPYABLE artifacts from TheAuditorTool/Auditor into the NOOA project to create deterministic guardrail/auditability using YAML profiles, while generating new code ONLY when unavoidable.

REPOS
1) Auditor (source): https://github.com/TheAuditorTool/Auditor
2) NOOA (target): (use my local repo path or provided URL; if not given, assume it is already checked out in the current workspace)

NON-NEGOTIABLE PRINCIPLES
- Copy-first: Copy YAML/JSON/templates/examples 1:1 whenever possible.
- Generate-only-when-needed: Write TypeScript code only when there is no copyable artifact.
- Clean-room for code: DO NOT copy AGPL code into NOOA. You may copy CONFIG/TEMPLATES (YAML/JSON) but for any "logic", re-implement from behavior/spec only.
- Determinism: Same inputs must produce same JSON output (byte-identical) under deterministic mode.
- TDD: Write tests before implementation. All changes must pass: bun test, bun check (and any existing lint command).
- Worktree: All changes must be done inside a new git worktree created from NOOA (no changes on main).

SKILLS REQUIRED (must be used explicitly in the plan)
- writing plans
- create cli

STEP-BY-STEP EXECUTION (do exactly in this order)
1) Clone Auditor repo locally (read-only) and scan its structure:
   - Identify where YAML refactor profiles, semantic context templates, and examples live.
   - Extract a list of YAML/JSON assets that can be copied verbatim into NOOA.
   - Extract the YAML schemas implied by those files and by README examples.

2) Analyze NOOA repo structure:
   - Locate existing check/policy/ignore/reporting systems.
   - Identify existing JSON output patterns and telemetry constraints.
   - Identify how NOOA does CLI parsing, help text, exit codes, and tests.

3) Produce a "COPY MAP":
   - A table of [Auditor file] -> [NOOA destination path] with:
     (a) Copy 1:1? (b) Needs minor adaptation? (c) Cannot copy (license/logic) -> must re-implement.
   - For each YAML copied, provide a short note of how NOOA will load/validate it.

4) Produce a "COMPATIBILITY PLAN" for YAML:
   - Ensure NOOA can ingest both:
     (A) Auditor-style YAML (e.g., match.identifiers/expect.identifiers, scope.include/exclude)
     (B) NOOA v2 proposed pattern format (anyOf/allOf with literal/regex objects)
   - Implement a loader that normalizes both into a canonical internal representation.

5) Implementation Plan (TDD + worktree)
   - Create a new worktree inside NOOA:
     nooa worktree create feat/guardrail-profiles
   - Add feature directory: src/features/guardrail/
   - Add profile storage convention: .nooa/guardrails/{templates,examples,profiles}/
   - Implement:
     a) Zod schemas for profile validation
     b) YAML loader + compatibility normalization
     c) GuardrailEngine based on ripgrep, but deterministic:
        - stable file set (prefer git ls-files pipeline)
        - stable ordering of findings
        - deterministic JSON mode with no timestamps/random IDs
     d) Integrate into existing command:
        nooa check --profile <path>
     e) Add alias facade command:
        nooa guardrail check/validate/init (thin wrappers calling check or schema validation)

6) Determinism Requirements
   - Provide a CLI flag --deterministic (or ensure --json implies deterministic mode).
   - In deterministic mode, JSON output MUST be byte-identical across runs:
     - no timestamps
     - no random traceId unless provided as fixed input
     - stable ordering of findings and summary maps

7) Tests Required (write first)
   - profiles.test.ts: loads Auditor-style YAML and NOOA-style YAML and yields same normalized structure.
   - engine.test.ts: deterministic output ordering, scope include/exclude works.
   - check-profile.integration.test.ts: nooa check --profile merges with existing policy findings.
   - cli.guardrail.test.ts: facade maps to check correctly.

8) Deliverables (must output all)
A) "COPY MAP" table
B) "Implementation Plan" as numbered TDD steps
C) "File/Folder Patch Plan" listing exact new/modified paths
D) "Minimal Patch Set" (unified diffs) for all required NOOA changes
E) "Verification Commands" to run locally (bun test, bun check, etc.)
F) "Risks & Constraints" including AGPL implications and how we avoided copying code

IMPORTANT
- Prefer citing Auditor README behaviors as the "spec" for re-implementation (do not lift code).
- If the Auditor repo appears archived or its requirements are unusual (e.g., Python version constraints), note that and adapt the plan accordingly.
- Do not propose optional Phase 3 items unless you measure a bottleneck and justify with evidence.

Now begin.
