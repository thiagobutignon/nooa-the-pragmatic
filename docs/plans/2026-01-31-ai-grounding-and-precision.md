# AI Grounding and Precision Plan (2026-01-31)

Eliminate AI hallucinations in `review` and improve CLI robustness through "evidence-based" grounding and strict contract enforcement.

## 1. Prompt v1.1.1 (`src/features/prompt/templates/review.md`)
- **Strict Categories**: Explicitly map `maintainability` to `arch` or `style`.
- **Severity Evidence**: For medium/high severity, REQUIRE evidence (identifier name + concrete failure mode). Prohibit generic "may cause runtime errors" phrases.
- **Project Conventions**: Respect `{{project_conventions}}` injected context.

## 2. CLI Context & Validation
- **Convention Injection**: Pass `project_conventions` (e.g., dynamic imports preferred for performance).
- **Category Normalization**: Convert `maintainability` to `arch` in the validator.
- **File Fallback**: If `file` is null, default to `input_path`.

## 3. Verification
- `tests/core/cohesion.test.ts`: Verify `maintainability` is normalized to `arch`.

## 5. Search CLI Precision
- Parse and validate `maxResults` as Integer inside the `search` command.
- Exit 2 on invalid input.

## 6. Verification
- `tests/core/cohesion.test.ts`: Verify JSON envelope + relative paths.
- Unit tests for discovery heuristic.
- Dogfooding with real files.
