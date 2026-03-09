# NOOA Desktop Template

Tauri 2 desktop shell for a local NOOA coding agent, built with Bun, React, and TypeScript.

## What this template includes

- Chat-first desktop UI with a ChatGPT-like timeline
- Permanent workspace selector in the sidebar
- Two permission modes:
  - `Full Access`
  - `Ask First`
- Inline approval cards for filesystem actions
- Polished markdown rendering with custom code blocks, tables, and file path chips
- Real local bridge to NOOA's AI engine and file operations

## Current runtime contract

The desktop bridge currently supports three file actions inside the selected workspace:

- `read`
- `write`
- `delete`

All requested paths are normalized and rejected if they escape the chosen workspace root.

## Run it

From the repository root:

```bash
bun install
bun run desktop:dev
```

For a production build:

```bash
bun run desktop:build
```

## Notes

- The Tauri backend spawns `bun src/runtime/desktop/bridge.ts`.
- The bridge persists chat state under `<workspace>/.nooa/desktop/`.
- For real model responses, configure the same NOOA provider environment variables you already use in the repo.
