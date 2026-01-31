# Dogfooding Report: Embed Command

**Date:** 2026-01-31
**Environment:** `.worktrees/embed-command`
**Goal:** Validate `nooa embed` CLI behavior, output defaults, and telemetry.

## Summary

| Check | Result | Notes |
| --- | --- | --- |
| `nooa embed --help` | PASS | Help text includes usage + flags |
| `nooa embed text "hello"` | PASS | JSON output, no vector by default |
| `nooa embed file <path> --include-embedding` | PASS | Embedding array included |
| `--out <file>` | PASS | Writes JSON file, stdout empty |
| Telemetry (`embed.started/success/failure`) | PASS | Events recorded in local telemetry DB |

## Commands Executed

```bash
# help
bun index.ts embed --help

# text embedding (mock provider)
NOOA_EMBED_PROVIDER=mock bun index.ts embed text "hello"

# file embedding with vector included
echo "hello" > tmp-embed.txt
NOOA_EMBED_PROVIDER=mock bun index.ts embed file tmp-embed.txt --include-embedding
rm tmp-embed.txt

# file output only
NOOA_EMBED_PROVIDER=mock bun index.ts embed text "hello" --out embed.json
cat embed.json
rm embed.json
```

## Observations

- Default output **does not include vector** (safe for CLI usage).
- `--include-embedding` explicitly includes vector when requested.
- `--out` keeps stdout clean, useful for agent pipelines.
- Telemetry events recorded as expected for success and failure cases.

## Follow-ups (optional)

- Add `--provider=ollama` integration test behind an env guard.
- Consider `--format` (json vs binary) for large-scale usage.
