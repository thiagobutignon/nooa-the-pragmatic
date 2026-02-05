# Replay Buffer (Experience Replay) — Design

**Goal:** Provide a deterministic, CLI-first graph of agent steps (A→B→C→D→E) with the ability to record fixes (e.g., “fix B”) and mark downstream impact (C/D/E) without mutating historical nodes.

## Architecture Overview
- New self-evolving command: `nooa replay`
- Storage: `.nooa/replay.json` (project-local)
- Graph: DAG with two edge kinds
  - `next`: primary linear flow
  - `impact`: fix → downstream impact
- Nodes are immutable; fixes create new nodes referencing the target via `fixOf`.

## Data Model (Minimum)
```json
{
  "version": "1.0.0",
  "nodes": [
    {
      "id": "node_...",
      "label": "B",
      "type": "step|fix",
      "createdAt": "2026-02-05T12:00:00Z",
      "meta": {
        "command": "nooa code write ...",
        "files": ["src/index.ts"],
        "summary": "wrote initial handler",
        "tags": ["agent", "draft"]
      },
      "fixOf": "node_..."
    }
  ],
  "edges": [
    { "from": "node_a", "to": "node_b", "kind": "next" },
    { "from": "node_fix", "to": "node_c", "kind": "impact" }
  ]
}
```

## CLI Contract (Draft)
### Subcommands
1. `nooa replay add <label>`
   - Creates a `step` node.
   - Flags: `--command`, `--summary`, `--files`, `--tags`, `--json`, `--root`.

2. `nooa replay link <from> <to>`
   - Creates a `next` edge (validates IDs, prevents cycles).

3. `nooa replay fix <targetId> <label>`
   - Creates a `fix` node (`fixOf=targetId`).
   - Adds `impact` edges to all downstream `next` nodes by default.
   - Flags: `--impact <ids>`, `--no-auto-impact`.

4. `nooa replay show [id]`
   - No args: summary and recent steps.
   - With id: details + downstream path.
   - Flags: `--format <tree|list>`, `--json`.

### Global
- `--json` machine output
- `--root <path>` override storage root
- `-h, --help`

### Exit Codes
- `0` success
- `1` runtime error (I/O)
- `2` validation (missing args, invalid IDs, cycles)

### Error Codes (examples)
- `replay.missing_label`
- `replay.not_found`
- `replay.cycle_detected`
- `replay.runtime_error`

## Data Flow
- `add`: load file → append node → save
- `link`: validate IDs → cycle check → add edge → save
- `fix`: validate target → create fix node → compute downstream via `next` edges → add `impact` edges → save
- `show`: read → render

## TDD Targets
- `add` creates node
- `link` prevents cycles
- `fix` computes downstream impact
- `show` renders summary
- CLI `--json` output stable

## Notes
- CLI is source of truth (agent-first).
- No prompts. Deterministic output only.
- Storage is simple JSON for now; future migration possible.
