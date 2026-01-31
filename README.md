# NOOA The Pragmatic

NOOA The Pragmatic is a **CLI-first Programming Agent** for **hypergrowth software development**. The goal is to outperform tools like Claude Code and Codex by delivering a personalized development experience with **active Markdown memory**, **deep codebase context**, and **disciplined, test-first execution**.

## Objective (OKR)

Be superior to Claude Code and Codex by delivering a personalized development experience:
- Reads `docs/` and code to understand the project deeply.
- Maintains **active memory between sessions in Markdown**.
- Understands the developer and the company context.
- **Auto-evolves** as the codebase evolves, including adjusting OKRs when justified.
- When a bug is found, it **creates a worktree, writes tests, implements, validates, and merges**.

Repository: [thiagobutignon/nooa-the-pragmatic](https://github.com/thiagobutignon/nooa-the-pragmatic)

## Commands

- **`message <text>`**: Send a message to the AI agent. See [message.md](docs/commands/message.md).
- **`read <path>`**: Read file contents from the local filesystem. See [read.md](docs/commands/read.md).
- **`code <write|patch>`**: Create, overwrite, or patch files. See [code.md](docs/commands/code.md).
- **`search <query> [path]`**: Fast codebase search using `ripgrep`. See [search.md](docs/commands/search.md).
- **`embed <text|file> <input>`**: Generate embeddings for text or files. See [embed.md](docs/commands/embed.md).
- **`worktree <branch>`**: Create a fresh git worktree for isolated development. See [worktree.md](docs/commands/worktree.md).
- **`commit -m <msg>`**: Commit staged changes with validation. See [commit.md](docs/commands/commit.md).
- **`push [remote] [branch]`**: Push committed changes to remote. See [push.md](docs/commands/push.md).
- **`ai <prompt>`**: Query the resilient AI engine with fallback and retries. See [ai.md](docs/commands/ai.md).
- **`run [-- flags] -- <cmd1> -- <cmd2>`**: Execute multiple commands in a pipeline. See [run.md](docs/commands/run.md).
- **`combine [flags] -- <cmd1> -- <cmd2>`**: Alias for `run`. See [combine.md](docs/commands/combine.md).
- **`review [path]`**: Perform an AI-powered code review. See [review.md](docs/commands/review.md).
- **`prompt <action>`**: Manage and render AI prompts. See [prompt.md](docs/commands/prompt.md).

Every project has **Objective, Cost, and Deadline**. The agent must keep the developer focused and engaged.

## Development Flywheel (The Golden Path)

NOOA is designed to accelerate your development cycle through a robust command pipeline. Use the delimiter mode (`--`) to chain commands in a single stroke:

```bash
nooa run -- \
  worktree create feat/new-feature \
  -- code write src/feature.ts --from spec.md \
  -- exec git add src/feature.ts \
  -- review src/feature.ts --fail-on high \
  -- commit -m "feat: implement new feature"
```

This ensures every change is isolated, documented, reviewed, and committed with zero friction.

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
    command.ts
    registry.ts
    telemetry.ts
    logger.ts
    event-bus.ts
  features/
    ai/
      engine.ts
      cli.ts
      types.ts
      providers/
    chat/
      cli.ts
      execute.ts
      types.ts
    code/
      cli.ts
      write.ts
      patch.ts
    combine/
      cli.ts
    commit/
      cli.ts
      guards.ts
    embed/
      cli.ts
      engine.ts
      types.ts
    prompt/
      cli.ts
      engine.ts
      templates/
    review/
      cli.ts
      execute.ts
    run/
      cli.ts
      executor.ts
      parser.ts
      types.ts
    push/
      cli.ts
      guards.ts
    read/
      cli.ts
    search/
      cli.ts
      engine.ts
    worktree/
      cli.ts
      git.ts
index.ts
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
