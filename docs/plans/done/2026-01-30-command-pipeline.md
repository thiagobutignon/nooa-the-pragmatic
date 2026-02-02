# Command Pipeline Feature Design

**Goal**: Enable users to chain multiple NOOA CLI commands in a single execution flow, allowing for powerful one-liners and automation macros.

## User Request
The user suggested a usage like:
`nooa run code "teste unitario" --from "path" lint commit --"test: message" message "create the production code for file path"`

## Architecture Decisions

### 1. Naming
- **Canonical Command**: `run` (e.g., `nooa run ...`). The duplicate `combine` alias was removed early in the rollout, so only `run` remains.

### 2. Syntax Modes

#### Mode A: Delimiter (Recommended / Default)
Uses `--` to separate steps. This is robust, avoids quoting issues, and requires no shell parsing guesswork.
```bash
nooa run -- \
  code write src/calc.ts --from specs/calc.md \
  -- exec bun run lint \
  -- commit -m "feat: calculator implementation" \
  -- push
```
*Note*: The `nooa` prefix is optional for internal commands in this mode.

#### Mode B: Array of Strings (Compatibility)
Uses standard shell quoting. Requires parsing internal strings (e.g., via `shell-quote`).
```bash
nooa run "code write test.ts" "exec bun run lint" "push"
```

### 3. Execution Policy (Safety First)
- **Internal Commands**: Dispatched directly via `CommandRegistry` (in-process) to check name and context. Faster and shares state.
- **External Commands**: Must be explicit using the `exec` prefix or enabled via `--allow-external`.
    - `nooa run -- exec bun run test` -> Allowed (explicit)
    - `nooa run -- bun run test` -> **Error** (unless `--allow-external` is set)

### 4. I/O Contract & Output
- **Fail-Fast**: Stops on first error (default).
- **Flags**:
    - `--continue-on-error`: Continue even if a step fails.
    - `--json`: Output aggregated results in JSON.
    - `--dry-run`: Don't execute, just show plan.
- **Output Structure**:
    ```json
    {
      "ok": false,
      "failedStep": 1,
      "steps": [
        { "name": "code write", "exitCode": 0, "durationMs": 100 },
        { "name": "lint", "exitCode": 1, "stderr": "..." }
      ]
    }
    ```

## Implementation Plan

### 1. Dependencies
- Install `shell-quote` for safe string parsing in Mode B.

### 2. Core Logic (`src/features/run/`)
- **`parser.ts`**:
    - `parseArgv(args)`: Splits by `--` delimiter.
    - `parseStrings(args)`: Uses `shell-quote` to parse string arguments.
    - Normalizes everything to `PipelineStep[]`.
- **`executor.ts`**:
    - Loop through steps.
    - If `kind === 'internal'`: Call `CommandRegistry.dispatch`.
    - If `kind === 'external'`: Call `execa`.
    - Handle failure logic (`process.exitCode`).
- **`cli.ts`**:
    - The main `run` command entry point.
    - Handles flags: `--json`, `--continue-on-error`, `--allow-external`.

### 3. Verification
- Test Mode A (delimiters).
- Test Mode B (strings).
- Test External Execution policies.
- Test Fail-Fast behavior.
