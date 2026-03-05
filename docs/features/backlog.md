# backlog

## Description

Generate and operate backlog PRDs and kanban state

## CLI Usage

```text
Usage: nooa backlog <subcommand> [args] [flags]

Generate and operate backlog PRDs and kanban state.

Subcommands:
  generate              Generate a PRD from a macro prompt.
  validate              Validate PRD schema compatibility.
  split                 Split large stories into smaller units.
  board                 Render board columns from PRD state.
  move                  Move one story between board columns.

Flags:
  --json                Output results as JSON.
  -h, --help            Show help message.
```

## SDK

```text
SDK Usage:
  const result = await backlog.run({ action: "help" });
  if (result.ok) console.log(result.data.mode);
```
