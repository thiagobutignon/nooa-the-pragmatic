# embed

Generate embeddings for text or files.

## Usage

```bash
nooa embed <text|file> <input> [flags]
```

## Arguments

- `text <string>`: Embed a raw string.
- `file <path>`: Embed file contents.

## Flags

- `--model <name>`: Model name (default: `nomic-embed-text`).
- `--provider <name>`: Provider (default: `ollama`).
- `--include-embedding`: Include vector in output.
- `--out <file>`: Write JSON output to file and keep stdout empty.
- `--json`: Output JSON (default).
- `-h, --help`: Show help.

## Environment Variables

- `NOOA_EMBED_PROVIDER`: Provider name (default: `ollama`).
- `NOOA_EMBED_MODEL`: Model name (default: `nomic-embed-text`).
- `NOOA_EMBED_ENDPOINT`: Provider base URL (default: `http://localhost:11434`).

## Output

By default, output includes metadata only (no vector). Use `--include-embedding` to include the embedding array.

## Exit Codes

- `0`: Success.
- `1`: Runtime error (provider/IO failure).
- `2`: Validation error (missing input / invalid action).

## Examples

```bash
nooa embed text "hello world"
nooa embed file README.md --include-embedding
nooa embed text "hello world" --out embed.json
```
