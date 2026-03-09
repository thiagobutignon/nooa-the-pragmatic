---
name: fetch-ai-papers
description: Use when you need to fetch the latest AI research papers from arXiv. Returns structured paper data (title, authors, abstract, URL, published date).
---

# Fetch AI Papers

## Overview

This skill uses the `nooa papers` command to retrieve the latest research papers on Artificial Intelligence (or any arXiv category) directly from arXiv's public API — no API key required.

## When to Use

- User asks for "latest AI papers", "recent research", "what's new in ML", etc.
- You need to ground a response in fresh academic literature.
- You want to summarize, compare, or analyze recent papers in a pipeline.

## Commands

### Basic Usage

```bash
# Latest 5 AI papers (default)
nooa papers

# As JSON (for programmatic use)
nooa papers --json

# Custom limit (1-20)
nooa papers --limit 10

# Different arXiv category
nooa papers --topic cs.LG    # Machine Learning
nooa papers --topic cs.CV    # Computer Vision
nooa papers --topic cs.CL    # Computation & Language (NLP)
nooa papers --topic cs.RO    # Robotics
nooa papers --topic stat.ML  # Statistics - Machine Learning
```

### Pipeline Example

```bash
# Fetch and summarize with AI
nooa papers --json | nooa ai "Summarize each paper in one sentence"

# Fetch, review and save
nooa papers --json > papers.json && nooa read papers.json
```

## Output Schema (JSON)

```json
{
  "papers": [
    {
      "title": "Advances in Large Language Models for Code Generation",
      "authors": ["Alice Smith", "Bob Jones"],
      "abstract": "This paper presents...",
      "url": "https://arxiv.org/abs/2502.00001",
      "published": "2026-02-24T12:00:00Z"
    }
  ],
  "count": 5,
  "source": "arxiv"
}
```

## arXiv Category Reference

| Category   | Description                        |
|------------|------------------------------------|
| `cs.AI`    | Artificial Intelligence (default)  |
| `cs.LG`    | Machine Learning                   |
| `cs.CL`    | Computation & Language (NLP)       |
| `cs.CV`    | Computer Vision                    |
| `cs.RO`    | Robotics                           |
| `cs.NE`    | Neural and Evolutionary Computing  |
| `stat.ML`  | Statistics - Machine Learning      |

## Error Handling

| Error Code              | Meaning                        | Action                        |
|-------------------------|--------------------------------|-------------------------------|
| `papers.fetch_failed`   | Network or HTTP error          | Check internet connection     |
| `papers.parse_failed`   | Unexpected arXiv response      | Retry or check arXiv status   |
| `papers.invalid_limit`  | Limit out of range (1–20)      | Use a value between 1 and 20  |

## Tips

- arXiv submissions are highest on Mondays (weekend batch). Results may be sparse on weekends.
- Use `--topic cs.CL` for NLP/LLM-specific papers.
- Pipe `--json` output into `nooa ai` for instant summaries.
- The `published` field is ISO 8601 — slice with `.slice(0, 10)` for date-only display.
