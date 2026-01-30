# NOOA The Pragmatic

NOOA The Pragmatic is a **CLI-first Programming Agent** for **hypergrowth software development**. The goal is to outperform tools like Claude Code and Codex by delivering a personalized development experience with **active Markdown memory**, **deep codebase context**, and **disciplined, test-first execution**.

## Objective (OKR)

Be superior to Claude Code and Codex by delivering a personalized development experience:
- Reads `docs/` and code to understand the project deeply.
- Maintains **active memory between sessions in Markdown**.
- Understands the developer and the company context.
- **Auto-evolves** as the codebase evolves, including adjusting OKRs when justified.
- When a bug is found, it **creates a worktree, writes tests, implements, validates, and merges**.

Repository: https://github.com/thiagobutignon/nooa-the-pragmatic

## Focus Rules (Non-negotiable)

Every project has **Objective, Cost, and Deadline**. The agent must keep the developer focused and engaged, provide support, and explain difficult topics. If needed, it should build small interactive HTML/CSS/JS examples to clarify concepts.

## Never Break These Capabilities

- `writeFile`
- `readFile`
- `searchFile`
- `commit`
- `push`

If any of these fail, restoring them is the top priority.

## How NOOA Evolves

The system prompt knows the project. At any time, NOOA can:
- clone the repo
- create a worktree
- commit changes
- open a PR and review it

## Operating Principles

- **CLI First**
- **Agent First**
- **AI First**
- **Intent > abstraction**
- **No incomplete code** (no `// TODO`, `// MOCK`, or “implement later” in production)
- **No technical debt left behind**

Old flow: `API -> Mobile/Web`  
New flow: `CLI -> Docs -> Agent -> AI -> API/MCP -> SDK -> Mobile/Web`

## Workflow (Dogfooding Standard)

0. Create worktree  
1. TDD (RED): write tests and run `bun test` (expect fail)  
2. Production code  
2.1 `bun test`  
2.2 `bun check`  
2.3 `bun run linter`  
2.4 Commit  
3. Verify observability/telemetry (errors must be debuggable)  
4. Bug finding must be surgical: minimal tokens/CPU/memory

## Search Philosophy

AI is statistical. A good agent is surgical.  
NOOA should use **hybrid search (lexical + embeddings)** and prioritize files by signals (recent changes, hotspots, failing tests, blame) before deep dives.

## Architecture & Constraints

**DB:** MySql Lite with vectorization  
**Models:** Qwen-2.5-Coder:14b + nomic-embed-text  
**Resources:** Twitter, GitHub, crypto wallet (for distribution and sustainability)

## Example Scenarios

- No web access? Create a worktree, implement a web-search skill, test it, validate it, and merge if it works.
- Need code review? Build a review skill/agent that flags bugs, readability issues, missing tests, and observability gaps.

## Folder Convention

Feature-based, vertical-slice structure (URLs as mental model):
`example.com/blog/nooa-is-the-best-agent`

## Project Structure (Feature-Based + Co-located Tests)

We use a vertical-slice layout. Each feature owns its runtime code and its tests in the same folder.

```
src/
  core/
    event-bus.ts
    event-bus.test.ts
  features/
    bridge/
      bridge.ts
      cli.ts
      bridge.test.ts
      cli.test.ts
    code/
      write.ts
      patch.ts
      cli-write.test.ts
      cli-patch.test.ts
      write.test.ts
      patch.test.ts
    jobs/
      jobs.ts
      db.ts
      matcher.ts
      github.ts
      automation.ts
      cli.ts
      db.test.ts
      matcher.test.ts
      cli.test.ts
    resume/
      converter.ts
      json-resume.ts
      pdf-generator.ts
      validator.ts
      cli.ts
      converter.test.ts
      json-resume.test.ts
      pdf-generator.test.ts
      validator.test.ts
      cli.test.ts
      cli-validate.test.ts
index.ts
index.main.test.ts
index.cli.test.ts
index.nooa.test.ts
index.read.test.ts
```

## Install & Run

```bash
bun install
```

```bash
bun run index.ts
```

```bash
bun test
bun check
bun run linter
```
