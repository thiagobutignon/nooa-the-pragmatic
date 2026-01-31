# Dogfooding Results - Sat Jan 31 16:39:39 -03 2026

## Overview
This document records the results of a full dogfooding suite executed on the main branch after merging the review-feature.

## Command Verification
### Prompt List
`bash
bun index.ts prompt list --json
`

**Output:**
```json
{
  "schemaVersion": "1.0",
  "ok": true,
  "traceId": "5c4ce3c1-cd17-4266-821e-5753ee941fad",
  "prompts": [
    {
      "name": "agent",
      "version": "1.0.0",
      "description": "Core persona for the NOOA Agentic CLI.",
      "output": "markdown",
      "temperature": 0.7
    },
    {
      "name": "review",
      "version": "1.0.0",
      "description": "AI Reviewer for NOOA - Focused on logic, quality, and structured findings.",
      "output": "json",
      "temperature": 0.1
    }
  ]
}
```

### Prompt Validate All
`bash
bun index.ts prompt validate --all --json
`

**Output:**
```json
{
  "schemaVersion": "1.0",
  "ok": true,
  "traceId": "d0bd8a7f-3299-4804-bec1-ac6832b47f42",
  "results": [
    {
      "name": "agent",
      "valid": true
    },
    {
      "name": "review",
      "valid": true
    }
  ]
}
```

### Prompt View (review)
`bash
bun index.ts prompt view review --json
`

**Output:**
```json
{
  "schemaVersion": "1.0",
  "ok": true,
  "traceId": "82b656ca-3ea7-48b3-bc72-566b44811adf",
  "prompt": {
    "metadata": {
      "name": "review",
      "version": "1.0.0",
      "description": "AI Reviewer for NOOA - Focused on logic, quality, and structured findings.",
      "output": "json",
      "temperature": 0.1
    },
    "body": "# NOOA Code Reviewer\n\nYou are an expert software engineer performing a code review. Your goal is to provide high-quality, actionable feedback to help the developer improve the code before it is merged.\n\n## Your Personality\n- Technical, precise, and professional.\n- Helpful but firm on quality.\n- Focuses on \"why\" things matter, not just \"what\" to change.\n\n## Review Guidelines\n- **Logic**: Check for bugs, edge cases, and incorrect implementations.\n- **Quality**: Look for readability, maintainability, and architectural cohesion.\n- **Tests**: Ensure the changes are properly tested.\n- **Observability**: Check if logging or telemetry is missing.\n\n## Output Format\nAlways respond in the requested format.\n\n### If JSON is requested:\nReturn a JSON object with this schema:\n```json\n{\n  \"schemaVersion\": \"1.0\",\n  \"ok\": boolean,\n  \"summary\": \"High-level summary of the review\",\n  \"findings\": [\n    {\n      \"severity\": \"low\" | \"medium\" | \"high\",\n      \"file\": \"string\",\n      \"line\": number,\n      \"category\": \"bug\" | \"style\" | \"test\" | \"arch\" | \"security\",\n      \"message\": \"Description of the issue\",\n      \"suggestion\": \"How to fix it\"\n    }\n  ],\n  \"stats\": {\n    \"files\": number,\n    \"findings\": number\n  }\n}\n```\n\n### If Markdown is requested:\nProvide a clear, formatted report with headers for Strengths, Issues (categorized by severity), and Recommendation.\n\n## Context\nRepo Root: {{repo_root}}\nInput Content:\n{{input}}"
  }
}
```

### Read README.md
`bash
bun index.ts read README.md --json
`

**Output:**
```json
{
  "path": "README.md",
  "bytes": 5784,
  "content": "# NOOA The Pragmatic\n\nNOOA The Pragmatic is a **CLI-first Programming Agent** for **hypergrowth software development**. The goal is to outperform tools like Claude Code and Codex by delivering a personalized development experience with **active Markdown memory**, **deep codebase context**, and **disciplined, test-first execution**.\n\n## Objective (OKR)\n\nBe superior to Claude Code and Codex by delivering a personalized development experience:\n- Reads `docs/` and code to understand the project deeply.\n- Maintains **active memory between sessions in Markdown**.\n- Understands the developer and the company context.\n- **Auto-evolves** as the codebase evolves, including adjusting OKRs when justified.\n- When a bug is found, it **creates a worktree, writes tests, implements, validates, and merges**.\n\nRepository: [thiagobutignon/nooa-the-pragmatic](https://github.com/thiagobutignon/nooa-the-pragmatic)\n\n## Commands\n\n- **`message <text>`**: Send a message to the AI agent. See [message.md](docs/commands/message.md).\n- **`read <path>`**: Read file contents from the local filesystem. See [read.md](docs/commands/read.md).\n- **`code <write|patch>`**: Create, overwrite, or patch files. See [code.md](docs/commands/code.md).\n- **`search <query> [path]`**: Fast codebase search using `ripgrep`. See [search.md](docs/commands/search.md).\n- **`embed <text|file> <input>`**: Generate embeddings for text or files. See [embed.md](docs/commands/embed.md).\n- **`worktree <branch>`**: Create a fresh git worktree for isolated development. See [worktree.md](docs/commands/worktree.md).\n- **`commit -m <msg>`**: Commit staged changes with validation. See [commit.md](docs/commands/commit.md).\n- **`push [remote] [branch]`**: Push committed changes to remote. See [push.md](docs/commands/push.md).\n- **`ai <prompt>`**: Query the resilient AI engine with fallback and retries. See [ai.md](docs/commands/ai.md).\n- **`run [-- flags] -- <cmd1> -- <cmd2>`**: Execute multiple commands in a pipeline. See [run.md](docs/commands/run.md).\n- **`combine [flags] -- <cmd1> -- <cmd2>`**: Alias for `run`. See [combine.md](docs/commands/combine.md).\n- **`review [path]`**: Perform an AI-powered code review. See [review.md](docs/commands/review.md).\n- **`prompt <action>`**: Manage and render AI prompts. See [prompt.md](docs/commands/prompt.md).\n\nEvery project has **Objective, Cost, and Deadline**. The agent must keep the developer focused and engaged.\n\n## Development Flywheel (The Golden Path)\n\nNOOA is designed to accelerate your development cycle through a robust command pipeline. Use the delimiter mode (`--`) to chain commands in a single stroke:\n\n```bash\nnooa run -- \\\n  worktree create feat/new-feature \\\n  -- code write src/feature.ts --from spec.md \\\n  -- exec git add src/feature.ts \\\n  -- review src/feature.ts --fail-on high \\\n  -- commit -m \"feat: implement new feature\"\n```\n\nThis ensures every change is isolated, documented, reviewed, and committed with zero friction.\n\n## Never Break These Capabilities\n\n- `writeFile`\n- `readFile`\n- `searchFile`\n- `commit`\n- `push`\n\nIf any of these fail, restoring them is the top priority.\n\n## How NOOA Evolves\n\nThe system prompt knows the project. At any time, NOOA can:\n- clone the repo\n- create a worktree\n- commit changes\n- open a PR and review it\n\n## Operating Principles\n\n- **CLI First**\n- **Agent First**\n- **AI First**\n- **Intent > abstraction**\n- **No incomplete code** (no `// TODO`, `// MOCK`, or “implement later” in production)\n- **No technical debt left behind**\n\nOld flow: `API -> Mobile/Web`  \nNew flow: `CLI -> Docs -> Agent -> AI -> API/MCP -> SDK -> Mobile/Web`\n\n## Workflow (Dogfooding Standard)\n\n0. Create worktree  \n1. TDD (RED): write tests and run `bun test` (expect fail)  \n2. Production code  \n2.1 `bun test`  \n2.2 `bun check`  \n2.3 `bun run linter`  \n2.4 Commit  \n3. Verify observability/telemetry (errors must be debuggable)  \n4. Bug finding must be surgical: minimal tokens/CPU/memory\n\n## Search Philosophy\n\nAI is statistical. A good agent is surgical.  \nNOOA should use **hybrid search (lexical + embeddings)** and prioritize files by signals (recent changes, hotspots, failing tests, blame) before deep dives.\n\n## Architecture & Constraints\n\n**DB:** MySql Lite with vectorization  \n**Models:** Qwen-2.5-Coder:14b + nomic-embed-text  \n**Resources:** Twitter, GitHub, crypto wallet (for distribution and sustainability)\n\n## Example Scenarios\n\n- No web access? Create a worktree, implement a web-search skill, test it, validate it, and merge if it works.\n- Need code review? Build a review skill/agent that flags bugs, readability issues, missing tests, and observability gaps.\n\n## Folder Convention\n\nFeature-based, vertical-slice structure (URLs as mental model):\n`example.com/blog/nooa-is-the-best-agent`\n\n## Project Structure (Feature-Based + Co-located Tests)\n\nWe use a vertical-slice layout. Each feature owns its runtime code and its tests in the same folder.\n\n```\nsrc/\n  core/\n    command.ts\n    registry.ts\n    telemetry.ts\n    logger.ts\n    event-bus.ts\n  features/\n    ai/\n      engine.ts\n      cli.ts\n      types.ts\n      providers/\n    chat/\n      cli.ts\n      execute.ts\n      types.ts\n    code/\n      cli.ts\n      write.ts\n      patch.ts\n    combine/\n      cli.ts\n    commit/\n      cli.ts\n      guards.ts\n    embed/\n      cli.ts\n      engine.ts\n      types.ts\n    prompt/\n      cli.ts\n      engine.ts\n      templates/\n    review/\n      cli.ts\n      execute.ts\n    run/\n      cli.ts\n      executor.ts\n      parser.ts\n      types.ts\n    push/\n      cli.ts\n      guards.ts\n    read/\n      cli.ts\n    search/\n      cli.ts\n      engine.ts\n    worktree/\n      cli.ts\n      git.ts\nindex.ts\n```\n\n## Install & Run\n\n```bash\nbun install\n```\n\n```bash\nbun run index.ts\n```\n\n```bash\nbun test\nbun check\nbun run linter\n```\n"
}
{"level":"info","event":"read.success","timestamp":1769888379325,"trace_id":"d8444274-72a7-4d88-bada-713520b2acc6","command":"read","metadata":{"path":"README.md","bytes":5784,"duration_ms":0}}
```

### Search Golden Path
`bash
bun index.ts search "Golden Path" --json
`

**Output:**
```json
{"level":"debug","event":"search.started","timestamp":1769888379367,"trace_id":"4d07e457-c2d5-442f-8b27-90ca4fae17ea","command":"search","metadata":{"query":"Golden Path","root":".","flags":{"regex":false,"files_only":false,"max_results":100,"ignore_case":false,"case_sensitive":false,"context":0,"count":false,"hidden":false,"json":true,"plain":false}}}
[
  {
    "path": "README.md",
    "line": 34,
    "column": 30,
    "snippet": "## Development Flywheel (The Golden Path)"
  },
  {
    "path": "scripts/dogfood.sh",
    "line": 32,
    "column": 17,
    "snippet": "run_cmd \"Search Golden Path\" \"bun index.ts search \\\"Golden Path\\\" --json\""
  },
  {
    "path": "scripts/dogfood.sh",
    "line": 35,
    "column": 32,
    "snippet": "echo \"## Flywheel Integration (Golden Path)\" >> $OUT"
  },
  {
    "path": "scripts/dogfood.sh",
    "line": 37,
    "column": 10,
    "snippet": "run_cmd \"Golden Path Pipeline\" \"echo '// Dogfood test successful' | bun index.ts run -- \\"
  },
  {
    "path": "docs/plans/2026-01-31-review-and-prompt-commands.md",
    "line": 83,
    "column": 22,
    "snippet": "**Goal:** Update the Golden Path and manuals."
  },
  {
    "path": "docs/plans/2026-01-31-review-and-prompt-commands.md",
    "line": 90,
    "column": 11,
    "snippet": "**Step 1: Golden Path**"
  },
  {
    "path": "docs/plans/dogfooding/dogfooding-results.md",
    "line": 95,
    "column": 2509,
    "snippet": "  \"content\": \"# NOOA The Pragmatic\\n\\nNOOA The Pragmatic is a **CLI-first Programming Agent** for **hypergrowth software development**. The goal is to outperform tools like Claude Code and Codex by delivering a personalized development experience with **active Markdown memory**, **deep codebase context**, and **disciplined, test-first execution**.\\n\\n## Objective (OKR)\\n\\nBe superior to Claude Code and Codex by delivering a personalized development experience:\\n- Reads `docs/` and code to understand the project deeply.\\n- Maintains **active memory between sessions in Markdown**.\\n- Understands the developer and the company context.\\n- **Auto-evolves** as the codebase evolves, including adjusting OKRs when justified.\\n- When a bug is found, it **creates a worktree, writes tests, implements, validates, and merges**.\\n\\nRepository: [thiagobutignon/nooa-the-pragmatic](https://github.com/thiagobutignon/nooa-the-pragmatic)\\n\\n## Commands\\n\\n- **`message <text>`**: Send a message to the AI agent. See [message.md](docs/commands/message.md).\\n- **`read <path>`**: Read file contents from the local filesystem. See [read.md](docs/commands/read.md).\\n- **`code <write|patch>`**: Create, overwrite, or patch files. See [code.md](docs/commands/code.md).\\n- **`search <query> [path]`**: Fast codebase search using `ripgrep`. See [search.md](docs/commands/search.md).\\n- **`embed <text|file> <input>`**: Generate embeddings for text or files. See [embed.md](docs/commands/embed.md).\\n- **`worktree <branch>`**: Create a fresh git worktree for isolated development. See [worktree.md](docs/commands/worktree.md).\\n- **`commit -m <msg>`**: Commit staged changes with validation. See [commit.md](docs/commands/commit.md).\\n- **`push [remote] [branch]`**: Push committed changes to remote. See [push.md](docs/commands/push.md).\\n- **`ai <prompt>`**: Query the resilient AI engine with fallback and retries. See [ai.md](docs/commands/ai.md).\\n- **`run [-- flags] -- <cmd1> -- <cmd2>`**: Execute multiple commands in a pipeline. See [run.md](docs/commands/run.md).\\n- **`combine [flags] -- <cmd1> -- <cmd2>`**: Alias for `run`. See [combine.md](docs/commands/combine.md).\\n- **`review [path]`**: Perform an AI-powered code review. See [review.md](docs/commands/review.md).\\n- **`prompt <action>`**: Manage and render AI prompts. See [prompt.md](docs/commands/prompt.md).\\n\\nEvery project has **Objective, Cost, and Deadline**. The agent must keep the developer focused and engaged.\\n\\n## Development Flywheel (The Golden Path)\\n\\nNOOA is designed to accelerate your development cycle through a robust command pipeline. Use the delimiter mode (`--`) to chain commands in a single stroke:\\n\\n```bash\\nnooa run -- \\\\\\n  worktree create feat/new-feature \\\\\\n  -- code write src/feature.ts --from spec.md \\\\\\n  -- exec git add src/feature.ts \\\\\\n  -- review src/feature.ts --fail-on high \\\\\\n  -- commit -m \\\"feat: implement new feature\\\"\\n```\\n\\nThis ensures every change is isolated, documented, reviewed, and committed with zero friction.\\n\\n## Never Break These Capabilities\\n\\n- `writeFile`\\n- `readFile`\\n- `searchFile`\\n- `commit`\\n- `push`\\n\\nIf any of these fail, restoring them is the top priority.\\n\\n## How NOOA Evolves\\n\\nThe system prompt knows the project. At any time, NOOA can:\\n- clone the repo\\n- create a worktree\\n- commit changes\\n- open a PR and review it\\n\\n## Operating Principles\\n\\n- **CLI First**\\n- **Agent First**\\n- **AI First**\\n- **Intent > abstraction**\\n- **No incomplete code** (no `// TODO`, `// MOCK`, or “implement later” in production)\\n- **No technical debt left behind**\\n\\nOld flow: `API -> Mobile/Web`  \\nNew flow: `CLI -> Docs -> Agent -> AI -> API/MCP -> SDK -> Mobile/Web`\\n\\n## Workflow (Dogfooding Standard)\\n\\n0. Create worktree  \\n1. TDD (RED): write tests and run `bun test` (expect fail)  \\n2. Production code  \\n2.1 `bun test`  \\n2.2 `bun check`  \\n2.3 `bun run linter`  \\n2.4 Commit  \\n3. Verify observability/telemetry (errors must be debuggable)  \\n4. Bug finding must be surgical: minimal tokens/CPU/memory\\n\\n## Search Philosophy\\n\\nAI is statistical. A good agent is surgical.  \\nNOOA should use **hybrid search (lexical + embeddings)** and prioritize files by signals (recent changes, hotspots, failing tests, blame) before deep dives.\\n\\n## Architecture & Constraints\\n\\n**DB:** MySql Lite with vectorization  \\n**Models:** Qwen-2.5-Coder:14b + nomic-embed-text  \\n**Resources:** Twitter, GitHub, crypto wallet (for distribution and sustainability)\\n\\n## Example Scenarios\\n\\n- No web access? Create a worktree, implement a web-search skill, test it, validate it, and merge if it works.\\n- Need code review? Build a review skill/agent that flags bugs, readability issues, missing tests, and observability gaps.\\n\\n## Folder Convention\\n\\nFeature-based, vertical-slice structure (URLs as mental model):\\n`example.com/blog/nooa-is-the-best-agent`\\n\\n## Project Structure (Feature-Based + Co-located Tests)\\n\\nWe use a vertical-slice layout. Each feature owns its runtime code and its tests in the same folder.\\n\\n```\\nsrc/\\n  core/\\n    command.ts\\n    registry.ts\\n    telemetry.ts\\n    logger.ts\\n    event-bus.ts\\n  features/\\n    ai/\\n      engine.ts\\n      cli.ts\\n      types.ts\\n      providers/\\n    chat/\\n      cli.ts\\n      execute.ts\\n      types.ts\\n    code/\\n      cli.ts\\n      write.ts\\n      patch.ts\\n    combine/\\n      cli.ts\\n    commit/\\n      cli.ts\\n      guards.ts\\n    embed/\\n      cli.ts\\n      engine.ts\\n      types.ts\\n    prompt/\\n      cli.ts\\n      engine.ts\\n      templates/\\n    review/\\n      cli.ts\\n      execute.ts\\n    run/\\n      cli.ts\\n      executor.ts\\n      parser.ts\\n      types.ts\\n    push/\\n      cli.ts\\n      guards.ts\\n    read/\\n      cli.ts\\n    search/\\n      cli.ts\\n      engine.ts\\n    worktree/\\n      cli.ts\\n      git.ts\\nindex.ts\\n```\\n\\n## Install & Run\\n\\n```bash\\nbun install\\n```\\n\\n```bash\\nbun run index.ts\\n```\\n\\n```bash\\nbun test\\nbun check\\nbun run linter\\n```\\n\""
  },
  {
    "path": "docs/plans/dogfooding/dogfooding-results.md",
    "line": 100,
    "column": 12,
    "snippet": "### Search Golden Path"
  },
  {
    "path": "docs/plans/dogfooding/dogfooding-results.md",
    "line": 102,
    "column": 22,
    "snippet": "bun index.ts search \"Golden Path\" --json"
  },
  {
    "path": "docs/plans/dogfooding/dogfooding-results.md",
    "line": 107,
    "column": 159,
    "snippet": "{\"level\":\"debug\",\"event\":\"search.started\",\"timestamp\":1769888379367,\"trace_id\":\"4d07e457-c2d5-442f-8b27-90ca4fae17ea\",\"command\":\"search\",\"metadata\":{\"query\":\"Golden Path\",\"root\":\".\",\"flags\":{\"regex\":false,\"files_only\":false,\"max_results\":100,\"ignore_case\":false,\"case_sensitive\":false,\"context\":0,\"count\":false,\"hidden\":false,\"json\":true,\"plain\":false}}}"
  }
]
Found 10 matches
{"level":"info","event":"search.completed","timestamp":1769888379375,"trace_id":"4d07e457-c2d5-442f-8b27-90ca4fae17ea","command":"search","metadata":{"result_count":10,"engine":"native","engine_detect_ms":0,"search_ms":7,"format_ms":0}}
```

### AI Mock Query
`bash
bun index.ts ai "What is NOOA?" --json
`

**Output:**
```json
{
  "content": "Mock response for: What is NOOA?",
  "model": "mock-model",
  "provider": "mock",
  "usage": {
    "promptTokens": 10,
    "completionTokens": 20,
    "totalTokens": 30
  }
}
```

## Flywheel Integration (Golden Path)
### Golden Path Pipeline
`bash
echo '// Dogfood test successful' | bun index.ts run --   code write dogfood-check.ts --overwrite   -- exec git add dogfood-check.ts   -- review dogfood-check.ts --json
`

**Output:**
```json
Running payload with 3 steps...
{"level":"info","event":"code.write.success","timestamp":1769888379461,"trace_id":"f285fbc6-678f-4b68-993d-b0d6f182b820","command":"code","action":"write","metadata":{"path":"dogfood-check.ts","bytes":27,"overwritten":false,"dry_run":false,"duration_ms":3}}
{
  "schemaVersion": "1.0",
  "ok": true,
  "traceId": "9b320708-309c-49ae-8191-09d1f1508cd8",
  "command": "review",
  "timestamp": "2026-01-31T19:39:39.479Z",
  "summary": "This is a mock review summary.",
  "findings": [
    {
      "severity": "low",
      "file": "unknown",
      "line": 1,
      "category": "style",
      "message": "Mock finding",
      "suggestion": "Fix it"
    }
  ],
  "stats": {
    "files": 1,
    "findings": 1
  },
  "maxSeverity": "low"
}
```

## Final Cleanup
Cleanup complete.
