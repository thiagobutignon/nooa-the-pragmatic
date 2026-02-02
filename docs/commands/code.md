# nooa code

Code operations to create, overwrite, patch, or refactor files.

## Usage

```bash
nooa code <subcommand> [args] [flags]
```

## Subcommands

- `write <path>`: Create or overwrite a file.
- `patch <path>`: Apply a unified diff.
- `diff [path]`: Show git diff for path or all.
- `format <path>`: Format a file using biome.
- `refactor <path> "instruction"`: Refactor a file using AI.

## Flags

- `--from <path>`: Read content from a file (write mode).
- `--overwrite`: Overwrite destination if it exists (write mode).
- `--json`: Output result as JSON.
- `--dry-run`: Do not write the file.
- `-h, --help`: Show help message.

## Examples

```bash
# Write file from template
nooa code write app.ts --from template.ts

# Show diff
nooa code diff src/

# Format file
nooa code format src/index.ts

# Refactor code with AI
nooa code refactor src/utils.ts "Improve error handling"
```
