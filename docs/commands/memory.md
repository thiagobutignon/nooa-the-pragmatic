# nooa memory

Manage the persistent memory of the agent. This command allows you to explicitly record facts, decisions, and reflections to ensure the agent maintains long-term context.

## Usage

```bash
nooa memory [subcommand] [args] [flags]
```

## Subcommands

- `add <message>`: Manually record a fact or decision.
- `delete <id>`: Deletes a specific memory entry.
- `update <id> <content>`: Updates the content of a memory entry.
- `clear`: Wipes all memory entries (requires `--force`).
- `export <path>`: Exports all memory to a JSON file.
- `import <path>`: Imports memory from a JSON file.
- `list`: Show recent memory entries (alias for search "").
- `search <query>`: Search memory entries.
- `reflect`: Trigger the Reflection Engine to analyze recent changes and auto-generate summaries.
- `promote <id>`: Move a daily entry to durable memory.
- `get <id>`: Show full details of a memory entry.

## Flags

- `--type <type>`: Categorize the memory (e.g., `fact`, `decision`, `lesson`).
- `--confidence <level>`: Set the confidence level (low, medium, high).
- `--json`: Output results as JSON.
- `--force`: Confirm destructive actions like `clear`.
- `--semantic`: Use semantic search.

## How it works

Memory is stored in `nooa.db` (SQLite) and version-controlled. The **Reflection Engine** runs periodically to compress multiple entries into high-density "Simbionte" layers.

## Examples

```bash
nooa memory add "Decided to use Bun.sqlite for vector storage" --type decision
nooa memory update <ID> "Actually, let's use a simple JSON file for now"
nooa memory delete <ID>
nooa memory export backup.json
nooa memory clear --force
nooa memory reflect
```
