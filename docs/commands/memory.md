# nooa memory

Manage the persistent memory of the agent. This command allows you to explicitly record facts, decisions, and reflections to ensure the agent maintains long-term context.

## Usage

```bash
nooa memory [subcommand] [args] [flags]
```

## Subcommands

- `add <message>`: Manually record a fact or decision.
- `list`: Show recent memory entries.
- `reflect`: Trigger the Reflection Engine to analyze recent changes and auto-generate summaries.

## Flags

- `--type <type>`: Categorize the memory (e.g., `fact`, `decision`, `lesson`).
- `--confidence <level>`: Set the confidence level (low, medium, high).
- `--json`: Output results as JSON.

## How it works

Memory is stored in `nooa.db` (SQLite) and version-controlled. The **Reflection Engine** runs periodically to compress multiple entries into high-density "Simbionte" layers.

## Examples

```bash
nooa memory add "Decided to use Bun.sqlite for vector storage" --type decision
nooa memory reflect
```
