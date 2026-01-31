# nooa code

Code operations to create, overwrite, or patch files. This command supports both direct writes and unified diff patching.

## Usage

```bash
nooa code <write|patch> <path> [flags]
```

## Arguments

- `<path>` - Destination file path (required)

## Subcommands (Inferred)

- `write`: Create or overwrite a file with provided content.
- `patch`: Apply a unified diff to an existing file.

## Flags

- `--from <path>` - Read content from a file (if not provided, `stdin` is used)
- `--patch` - Apply a unified diff from `stdin`
- `--patch-from <path>` - Apply a unified diff from a file
- `--overwrite` - Overwrite destination if it already exists
- `--json` - Output result as JSON
- `--dry-run` - Simulate the operation without writing to disk
- `-h, --help` - Show help message

## Examples

### Write a file from template
```bash
nooa code write app.ts --from template.ts
```

### Apply a patch from stdin
```bash
nooa code patch styles.css < fix.patch
```

### Force overwrite with JSON output
```bash
nooa code write config.json --overwrite --json
```

## Exit Codes

- `0` - Success
- `1` - Runtime Error (failed execution, e.g., patch failed to apply)
- `2` - Validation Error (invalid path or conflicting flags)

## Notes

- `--patch` and `--patch-from` are mutually exclusive with `--from`.
- Using the `patch` subcommand implicitly enables the `--patch` logic.
- The command generates a telemetry trace ID for every operation.

## Troubleshooting

### "File already exists"
If the destination file exists, you must use the `--overwrite` flag to replace it.

### "Patch failed to apply"
Ensure the unified diff is compatible with the current content of the file. You can use `--dry-run` to test the patch before applying it.
