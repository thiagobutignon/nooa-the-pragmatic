# Agentic Evaluation Plan (NOOA-Grade)

Build the `nooa eval` quality system to systematically measure and improve AI prompts through deterministic scoring and versioned optimization.

## 1. Objective
Enable versioned improvement of prompts by evaluating outputs against repeatable datasets (**Suites**) and deterministic **Scorer** rules, with optional LLM critique.

## 2. CLI Contract (`nooa eval`)

### `nooa eval run <prompt_name> --suite <name>`
Evaluate a prompt against a specific suite.
- `--suite <name>`: (Required) Suite file in `src/features/eval/suites/`.
- `--judge <deterministic|llm>`: (Default: deterministic)
- `--baseline <version|latest>`: Compare against a version.
- `--fail-on-regression`: Exit 1 if score drops relative to baseline.
- `--json`: Output structured results.

### `nooa eval suggest <prompt_name> --suite <name>`
Use AI to suggest prompt improvements based on score failures.
- Returns a diff/patch for the prompt template.

### `nooa eval apply <prompt_name> --suite <name> --bump <patch|minor|major>`
Run evaluation, then bump the version ONLY if regression gate passes.

## 3. Architecture: The Quality Loop
- **Suites**: JSON/YAML fixtures in `src/features/eval/suites/` containing:
  - `id`, `vars`, `input` (file path or text).
  - `assertions`: (Deterministic rules) e.g., `is_valid_json`, `forbidden_regex`, `allowed_categories`, `max_findings`.
- **EvalEngine**:
  - `Scorer`: Executes deterministic checks (Primary gate).
  - `Judge`: Optional LLM-based critique (Secondary insights).
  - `Reporter`: Generates versioned history and telemetry (`eval.score`).
- **Optimization Flywheel**:
  - `apply` subcommand integrates with `PromptEngine` to increment version in frontmatter.

## 4. Feature Structure
Create `src/features/eval/`:
- `cli.ts`: Evaluation subcommands.
- `engine.ts`: Core logic for suite execution and scoring.
- `suites/`: Repository of test cases.
- `scorers/`: Hardened rules (deterministic).

## 5. Verification Plan
- **Cohesion**: Verify standard JSON envelope and exit codes (2 for validation err, 1 for regression/exec err).
- **Suites**: Create internal suite `review.instant-file` to test the reviewer.
- **Dogfooding**: Auto-bump the `review` prompt from v1.1.1 to v1.1.2 using `nooa eval apply`.
