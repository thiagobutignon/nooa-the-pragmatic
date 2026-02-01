# nooa index

Semantic indexing for code and memory. This command scans your repository, chunks the files, generates embeddings using AI, and stores them in a local SQLite database for later retrieval.

## Usage

```bash
nooa index <subcommand> [flags]
```

## Subcommands

- `repo`: Index all TypeScript (`.ts`) and Markdown (`.md`) files in the repository.

## Flags

- `--json`: Output results as a structured JSON object.
- `-h, --help`: Show the help message.

## How it works

1. **Scan**: Crawls the directory tree, skipping `node_modules`, `.git`, `.worktrees`, and `dist`.
2. **Chunk**: Splits file content into semantic chunks (currently paragraph-based).
3. **Embed**: Calls the configured AI Provider (OpenAI or Ollama) to generate vector embeddings.
4. **Store**: Saves chunks and vectors in `nooa.db` using a deterministic hash as the ID.

## Examples

```bash
# Index the entire repository
nooa index repo

# Index and get JSON output
nooa index repo --json
```

---

> [!NOTE]
> Indexing requires an active AI provider. Use `NOOA_AI_PROVIDER=mock` for testing without API calls.
