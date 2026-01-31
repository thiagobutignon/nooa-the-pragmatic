# nooa read

Read file contents from the local filesystem.

## Usage

```bash
nooa read <path> [flags]
```

## Arguments

- `<path>` - Path to the file to read (required)

## Flags

- `--json` - Output JSON with path, bytes, and content
- `-h, --help` - Show help message

## Examples

### Read a file
```bash
nooa read README.md
```

### Read a file as JSON
```bash
nooa read src/index.ts --json
```

## Exit Codes

- `0` - Success
- `1` - Runtime Error (failed execution)
- `2` - Validation Error (invalid path)

## Output Format

### Plain Text (default)
The command writes the raw file content directly to `stdout`.

### JSON (--json flag)
```json
{
  "path": "path/to/file",
  "bytes": 1234,
  "content": "file content here"
}
```

## Troubleshooting

### "Path is required"
You must provide the path to the file you want to read:
```bash
nooa read my-file.txt
```

### "File not found"
Ensure the path is correct and accessible from your current working directory.
