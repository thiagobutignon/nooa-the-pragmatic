# AI Grounding and Precision Plan (2026-01-31)

Eliminate AI hallucinations in `review` and improve CLI robustness through "evidence-based" grounding and strict contract enforcement.

## 1. Prompt v1.1.0 (`src/features/prompt/templates/review.md`)
- **Golden Rules**:
  - Do NOT claim "no tests exist" without evidence.
  - Do NOT assume external API contracts.
- **Schema**: Include `observability` in categories.
- **Constraints**: Relative paths for `file`, hard limit `max_findings=7`.
- **New Fields**: `truncated`, `input_path`, `input_type`, `input_scope`, `test_grounding`.

## 2. CLI Context Injection (`review` command)
- Pass relative `input_path`, `input_type` (file|diff), and `input_scope` (single_file|diff).
- Pass `repo_root` (absolute).

## 3. Evidence-Based Test Discovery
Heuristic: For `foo.ts`, check for `foo.test.ts`, `foo.spec.ts`, or `tests/foo.test.ts`.
- **Pass to Prompt**: `tests.candidates: string[]` (paths found) + disclaimer.
- **Rule**: AI can mention candidates but cannot confirm coverage.

## 4. Strict AI Output Validation
If `--json` is enabled:
- Validate `JSON.parse`.
- Check required: `schemaVersion`, `ok`, `findings`, `stats`, `maxSeverity`.
- Ensure `file` paths are **relative**.
- On failure: Exit 1, telemetry `review.failure`, and log clear error.

## 5. Search CLI Precision
- Parse and validate `maxResults` as Integer inside the `search` command.
- Exit 2 on invalid input.

## 6. Verification
- `tests/core/cohesion.test.ts`: Verify JSON envelope + relative paths.
- Unit tests for discovery heuristic.
- Dogfooding with real files.
