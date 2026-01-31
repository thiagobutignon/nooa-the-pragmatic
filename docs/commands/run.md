# `run`

Execute multiple NOOA commands or external shell commands in a single pipeline. This command is designed for powerful one-liners, automation macros, and complex agentic workflows.

## Usage

### Delimiter Mode (Recommended)
Separate commands with the `--` delimiter. This mode is the most robust as it avoids shell quoting issues.

```bash
nooa run [flags] -- <cmd1> -- <cmd2> [args...]
```

### String Mode
Pass each command as a single quoted string. Useful for simple pipelines.

```bash
nooa run [flags] "<cmd1>" "<cmd2>"
```

## Arguments
- `[args...]`: Commands to execute, separated by `--` or as quoted strings.

## Flags
- `--continue-on-error`: Keep executing subsequent steps even if one fails. Default: stops on first error.
- `--json`: Output final execution results as structured JSON (includes `schemaVersion` and `runId`).
- `--capture-output`: Capture `stdout` and `stderr` for each step (external commands only). Requires `--json`.
- `--allow-external`: Allow executing any shell command without the `exec` prefix.
- `--dry-run`: Parse the pipeline and display the execution plan without running it.
- `-h, --help`: Show help message.

## Delimiter Escaping
If you need to pass a literal `--` as an argument to a command within the pipeline, escape it as `\--`. 

> [!TIP]
> Depending on your shell (zsh/bash), you may need to double-escape it: `\\--`.
> Example: `nooa run -- exec echo "abc \\-- def"` outputs `abc -- def`.

## Execution Policy (Safety)
To prevent accidental execution of harmful shell commands, `nooa run` follows a strict policy:

1. **NOOA Commands**: Commands known to the NOOA registry (like `code`, `commit`, `read`) are executed internally. The `nooa` prefix is optional (e.g., `nooa run -- commit` is same as `nooa run -- nooa commit`).
2. **Explicit External**: Commands prefixed with `exec` are always allowed to run in the shell (e.g., `nooa run -- exec npm test`).
3. **Implicit External**: Any command NOT in the NOOA registry and NOT using the `exec` prefix will fail unless the `--allow-external` flag is provided.

## Examples

### Standard TDD Loop
```bash
nooa run -- code write src/auth.ts -- exec bun test -- commit -m "feat: auth"
```

### Agentic Worktree Workflow
```bash
nooa run -- \\
  worktree create --name fix/bug-123 -- \\
  code write src/fix.ts -- \\
  exec bun test -- \\
  commit -m "fix: resolve bug-123" -- \\
  push -- \\
  worktree remove --name fix/bug-123
```

### Fail-Fast Analysis
```bash
nooa run --json -- "code write tmp.ts" "exec false" "commit -m 'this wont run'"
```

## Exit Codes
- **0**: Success. All steps in the pipeline completed successfully.
- **1**: Runtime Error. One or more steps failed, or the pipeline was interrupted.
- **2**: Validation Error. Invalid syntax, empty steps, or external command policy violation.
