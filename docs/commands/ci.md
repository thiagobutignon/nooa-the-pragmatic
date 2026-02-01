# nooa ci

Run the local CI pipeline to ensure code quality and contract adherence before pushing.

## Usage

```bash
nooa ci [flags]
```

## Flags

- `--json`: Output results as a structured JSON object.
- `-h, --help`: Show the help message.

## Pipeline Stages

1. **Test**: Runs `bun test` to verify logic.
2. **Lint**: Runs `bun run check` (Biome) to ensure style and consistency.
3. **Check**: Runs the internal `nooa check` to audit Zero-Preguiça policies.

## Exit Codes

- `0`: All stages passed.
- `1`: One or more stages failed.

## Examples

```bash
nooa ci
nooa ci --json
```
