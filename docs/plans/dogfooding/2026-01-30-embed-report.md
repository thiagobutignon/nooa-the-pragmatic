# Dogfooding Report: Embed Command Refinement

**Date:** 2026-01-30
**Environment:** Main Branch
**Goal:** Validate `nooa embed` CLI behavior, output defaults, and telemetry after refinements.

## Summary

| Check | Result | Notes |
| --- | --- | --- |
| `nooa embed --help` | PASS | Help text includes usage + flags |
| `nooa embed text "Ola Mundo"` | PASS | JSON output, no vector by default (Ollama provider) |
| `nooa embed text "Ola Mundo" --include-embedding` | PASS | Embedding array included (768 dimensions for nomic) |
| `nooa embed file README.md` | PASS | Correctly reads file and generates embedding |
| `--model bge-m3` | PASS | Correctly overrides model (1024 dimensions) |
| `--out <file>` | PASS | Writes JSON file, stdout empty |
| Telemetry (`embed.started/success/failure`) | PASS | Events recorded in `nooa.db` table `telemetry` |
| Unit Tests | PASS | 7 pass, 0 fail in `src/features/embed/` |

## Commands Executed

```bash
# help
bun run index.ts embed --help

# text embedding (Ollama)
bun run index.ts embed text "Ola Mundo"

# model override
bun run index.ts embed text "Ola Mundo" --model bge-m3

# file output
bun run index.ts embed text "Ola Mundo" --out embed.json
cat embed.json

# failure telemetry
bun run index.ts embed text
sqlite3 nooa.db "SELECT * FROM telemetry WHERE event = 'embed.failure' LIMIT 1;"
```

## Observations

- **Default Model**: `nomic-embed-text` works as expected with Ollama.
- **Model Switch**: Switching to `bge-m3` correctly adjusted the output dimensions to 1024.
- **Telemetry**: Failure events correctly capture the `reason` (e.g., `missing_input`) in the JSON metadata column.
- **Exit Codes**: Returns `2` for validation errors and `0` for success.

## Final Result
**STATUS: PASS** ✅
The `embed` command is robust and correctly integrated with the telemetry and provider systems.
