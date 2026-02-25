# Plan: `nooa papers` Command

**Date:** 2026-02-25
**Status:** Done (v1.1.0)

## Goal

Add a `nooa papers` CLI command that fetches the **latest 5 papers related to Artificial Intelligence** using the free arXiv API. The result is shown as a formatted list or as JSON for downstream piping.

## Motivation

Agents and developers working in the AI space need quick access to recent research. A single CLI command (`nooa papers`) replaces manual browsing and integrates seamlessly into nooa pipelines (e.g., `nooa run -- papers -- ai "summarize this"`).

## Approach

- **Data source:** arXiv public API (`https://export.arxiv.org/api/query`), no authentication required.
- **Category:** `cs.AI` (Artificial Intelligence) – the canonical arXiv category.
- **Sorting:** `submittedDate` descending to get the truly latest submissions.
- **Parsing:** arXiv returns Atom XML; parse with `DOMParser` via `bun:dom` or a lightweight regex approach.

## File Layout

```
src/features/papers/
  cli.ts          # CommandBuilder implementation (single source of truth)
  cli.test.ts     # Unit tests for run() and integration tests
.agent/skills/
  fetch-ai-papers/
    SKILL.md      # Agent skill documentation
docs/plans/
  2026-02-25-papers-command.md  (this file)
```

## Schema

| Input        | Type    | Required | Default | Description                         |
|--------------|---------|----------|---------|-------------------------------------|
| `limit`      | number  | No       | `5`     | Number of papers to return (1–20)   |
| `topic`      | string  | No       | `cs.AI` | arXiv category or search query      |
| `json`       | boolean | No       | false   | Output structured JSON              |

## Output Shape

```json
{
  "ok": true,
  "papers": [
    {
      "title": "...",
      "authors": ["...", "..."],
      "abstract": "...",
      "url": "https://arxiv.org/abs/XXXX.XXXXX",
      "published": "2026-02-25T..."
    }
  ],
  "count": 5,
  "source": "arxiv"
}
```

## Error Codes

| Code                    | Exit | Description                   |
|-------------------------|------|-------------------------------|
| `papers.fetch_failed`   | 1    | HTTP request to arXiv failed  |
| `papers.parse_failed`   | 1    | arXiv XML could not be parsed |
| `papers.invalid_limit`  | 2    | Limit is not a valid integer  |

## Steps

1. **Write plan** (this file) ✅
2. **Implement `src/features/papers/cli.ts`** using CommandBuilder pattern ✅
3. **Write tests** in `src/features/papers/cli.test.ts` ✅ (20 tests)
4. **Create agent skill** in `.agent/skills/fetch-ai-papers/SKILL.md` ✅
5. **Dogfood** – run real commands, check help, test JSON output ✅
6. **Linter check** – `bun run check:changed` ✅
7. **Apply review (v1.1.0)** via TDD red→green cycle ✅
   - Renamed `--topic` → `--category`
   - Retry (2 attempts, 300ms/800ms backoff) + 10s timeout
   - User-Agent header (arXiv etiquette)
   - XML entity decoding
   - URL normalization (https + strip version)
   - `--no-abstract` and `--start` flags
   - JSON error contract in `--json` mode

## arXiv API Reference

```
GET https://export.arxiv.org/api/query
  ?search_query=cat:cs.AI
  &sortBy=submittedDate
  &sortOrder=descending
  &max_results=5
  &start=0
```

Returns Atom 1.0 XML. Key elements:
- `<entry>` → each paper
- `<title>` → paper title
- `<author><name>` → author names
- `<summary>` → abstract
- `<id>` → arXiv URL (use as-is)
- `<published>` → ISO 8601 date

## CLI Examples

```bash
# Default: latest 5 AI papers
nooa papers

# Limit and JSON for piping
nooa papers --limit 3 --json

# Different topic
nooa papers --topic cs.LG

# Pipe into AI for summary
nooa papers --json | nooa ai "summarize these papers in 3 bullets each"
```
