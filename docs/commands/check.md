# nooa check

The heart of the Zero-Preguiça (Zero Laziness) policy. It audits your code for incomplete work, bad patterns, or violations of the Project Constitution.

## Usage

```bash
nooa check [path] [flags]
```

## Flags

- `--staged`: Only audit files currently staged in Git (perfect for pre-commit).
- `--fix`: (Experimental) Attempt to automatically fix minor violations.
- `--json`: Output violations as structured JSON.
- `-h, --help`: Show help message.

## Policies Checked

- **no-todo**: Blocks `TODO`, `FIXME`, and `MOCK` strings.
- **no-debug**: Blocks accidental `console.log` or debug statements in production code.
- **identity-check**: Ensures files follow the branding and identity of the project.

## How it works

The engine reads `src/core/policy/rules/` and applies them to the target files. Use `.nooa-ignore` to intentionally bypass these rules.

## Examples

```bash
nooa check --staged
nooa check src/features/ --json
```
