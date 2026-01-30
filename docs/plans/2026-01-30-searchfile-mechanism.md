# SearchFile Mechanism (nooa search) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Add a dedicated `nooa search` command (non-negotiable) that performs fast file/content search with structured output, stderr diagnostics, telemetry, and trace IDs.

**Architecture:** Implement a `search` feature under `src/features/search/` that uses ripgrep (`rg`) when available for speed and falls back to a JS file-walk + regex search. Expose structured JSON output with match metadata, and integrate logger + telemetry. Use CLI-first contract (`--help` as spec).

**Tech Stack:** Bun, TypeScript, EventBus, `rg` (optional), built-in fs APIs.

---

## CLI Spec (Create-CLI + Agent-CLI-First)

**Name:** `nooa search`

**One-liner:** Search files and file contents with structured output and optional JSON.

**USAGE:**
- `nooa search <query> [path] [flags]`

**Args:**
- `<query>` required: search term or regex (see `--regex`)
- `[path]` optional: root directory (default: `.`)

**Flags:**
- `--regex` treat query as regex
- `--case-sensitive` disable case-insensitive search
- `--files-only` list matching files only (no content matches)
- `--max-results <n>` limit results (default: 100)
- `--include <glob>` include pattern (repeatable)
- `--exclude <glob>` exclude pattern (repeatable)
- `--json` output structured JSON
- `--plain` output stable line format
- `--no-color` disable color output
- `--context <n>` show n lines of context around matches (default: 0)
- `--ignore-case` / `-i` enable case-insensitive search (alias)
- `--count` / `-c` show only count of matches per file
- `--hidden` include hidden files in search
- `-h, --help` show help

**I/O contract:**
- stdout: results only (plain or JSON)
- stderr: diagnostics, telemetry logs, warnings

**Exit codes:**
- `0` success (matches or no matches)
- `1` runtime error
- `2` invalid usage

**Env:**
- `NOOA_SEARCH_ENGINE` force engine: 'rg' or 'native'
- `NOOA_SEARCH_MAX_RESULTS` overrides default max results

---

### Task 1: Add Search Command Skeleton + Help Text (TDD)

**Files:**
- Create: `src/features/search/cli.ts`
- Test: `src/features/search/cli.test.ts`

**Step 1: Write failing test**
```ts
import { describe, expect, it } from "bun:test";
import { execa } from "execa";

const binPath = "./index.ts";

describe("nooa search", () => {
  it("shows help", async () => {
    const res = await execa("bun", [binPath, "search", "--help"], { reject: false });
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain("Usage: nooa search");
    expect(res.stdout).toContain("<query>");
    expect(res.stdout).toContain("--json");
  });
});
```

**Step 2: Run test (RED)**
```bash
bun test src/features/search/cli.test.ts
```
Expected: FAIL (command not found)

**Step 3: Implement minimal command with proper error handling**
- Export `Command` with name `search`
- `--help` prints usage string

**Step 4: Run test (GREEN)**
```bash
bun test src/features/search/cli.test.ts
```
Expected: PASS

**Step 5: Commit**
```bash
# Verificar se existem arquivos relacionados antes do commit
git status

# Adicionar e commitar
git add src/features/search/cli.ts src/features/search/cli.test.ts
git commit -m "feat: add search command skeleton"
```

---

### Task 2: Core Search Engine (rg-first, fallback) (TDD)

**Files:**
- Create: `src/features/search/engine.ts`
- Test: `src/features/search/engine.test.ts`

**Step 1: Write failing test**
```ts
import { describe, expect, it } from "bun:test";
import { runSearch } from "./engine";

describe("runSearch engine", () => {
  it("detects rg availability", async () => {
    const { hasRipgrep } = await import("./engine");
    expect(typeof hasRipgrep).toBe("function");
  });

  it("handles empty results", async () => {
    const results = await runSearch({ 
      query: "NONEXISTENT_PATTERN_XYZ123", 
      root: ".", 
      maxResults: 5 
    });
    expect(results).toEqual([]);
  });

  it("returns matches with metadata", async () => {
    const results = await runSearch({ query: "TODO", root: ".", maxResults: 5 });
    expect(Array.isArray(results)).toBe(true);
  });

  it("respects maxResults limit", async () => {
    const results = await runSearch({ 
      query: "import", 
      root: ".", 
      maxResults: 3 
    });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("handles regex patterns", async () => {
    const results = await runSearch({ 
      query: "\\bTODO\\b", 
      root: ".", 
      regex: true,
      maxResults: 5 
    });
    expect(Array.isArray(results)).toBe(true);
  });

  it("applies include/exclude patterns", async () => {
    const results = await runSearch({ 
      query: "test", 
      root: ".", 
      include: ["*.ts"],
      exclude: ["*.test.ts"],
      maxResults: 10 
    });
    results.forEach(r => {
      expect(r.path).toMatch(/\.ts$/);
      expect(r.path).not.toMatch(/\.test\.ts$/);
    });
  });
});
```

**Step 2: Run test (RED)**
```bash
bun test src/features/search/engine.test.ts
```
Expected: FAIL (module missing)

**Step 3: Implement engine**
- **Engine detection logic:**
  - Check env `NOOA_SEARCH_ENGINE` for forced choice
  - Detect `rg` in PATH (best-effort via `which rg` or `where rg`)
  - Cache detection result during process lifetime
- **Ripgrep implementation:**
  - Run `rg --json --line-number --column` with appropriate flags
  - Parse JSON stream properly (handle newline-delimited JSON)
  - Handle stderr for errors/warnings
  - Respect timeout (5s default)
- **Native fallback:**
  - Use `fs.readdir` recursively with async iteration
  - Apply glob patterns for include/exclude
  - Read files line-by-line with streaming
  - Support both string and regex matching
  - Handle binary files gracefully (skip)
  - Respect file size limits (skip files >10MB by default)
- **Return normalized result:** `{ path, line, column, snippet, matchCount? }`

**Step 4: Run test (GREEN)**
```bash
bun test src/features/search/engine.test.ts
```
Expected: PASS

**Step 5: Commit**
```bash
# Validar código antes do commit
bun check src/features/search/engine.ts

git add src/features/search/engine.ts src/features/search/engine.test.ts
git commit -m "feat: add search engine"
```

---

### Task 3: Wire CLI to Engine + Output Formats (TDD)

**Files:**
- Modify: `src/features/search/cli.ts`
- Test: `src/features/search/cli.test.ts`

**Step 1: Write failing tests**
- `--json` outputs structured array
  ```ts
  it("outputs JSON format", async () => {
    const res = await execa("bun", [binPath, "search", "TODO", ".", "--json"], { reject: false });
    expect(res.exitCode).toBe(0);
    const data = JSON.parse(res.stdout);
    expect(Array.isArray(data)).toBe(true);
  });
  ```
- `--plain` outputs stable lines with format: `path:line:column:snippet`
  ```ts
  it("outputs plain format", async () => {
    const res = await execa("bun", [binPath, "search", "TODO", ".", "--plain"], { reject: false });
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toMatch(/^[\w\/.-]+:\d+:\d+:/m);
  });
  ```
- `--files-only` omits content matches
  ```ts
  it("lists files only", async () => {
    const res = await execa("bun", [binPath, "search", "TODO", ".", "--files-only"], { reject: false });
    expect(res.exitCode).toBe(0);
    const lines = res.stdout.split("\n").filter(Boolean);
    lines.forEach(line => {
      expect(line).not.toContain(":");
    });
  });
  ```

**Step 2: Run test (RED)**
```bash
bun test src/features/search/cli.test.ts
```
Expected: FAIL

**Step 3: Implement minimal wiring**
- Parse flags from CommandContext with validation
- Build options object from flags
- Call `runSearch` with error handling
- Format results based on output mode:
  - JSON: `JSON.stringify(results, null, 2)`
  - Plain: `${r.path}:${r.line}:${r.column}:${r.snippet}`
  - Default: colored output with context
  - Files-only: unique file paths only
- Print results to stdout (no extra whitespace)
- Print summary to stderr: "Found X matches in Y files"
- Errors to stderr

**Step 4: Run test (GREEN)**
```bash
bun test src/features/search/cli.test.ts
```
Expected: PASS

**Step 5: Commit**
```bash
git add src/features/search/cli.ts src/features/search/cli.test.ts
git commit -m "feat: wire search cli outputs"
```

---

### Task 4: Telemetry + Logger Integration (TDD)

**Files:** 
- Modify: `src/features/search/cli.ts`
- Test: `src/features/search/cli.test.ts`

**Step 1: Write failing test**
- Ensure telemetry row exists for search execution (use temp DB via `NOOA_DB_PATH`)

**Step 2: Run test (RED)**
```bash
bun test src/features/search/cli.test.ts
```
Expected: FAIL

**Step 3: Implement telemetry**
- Generate trace ID: `const traceId = createTraceId()`
- Start telemetry: `telemetry.track({ event: "search.started", traceId, metadata: { query, flags } })`
- Track success/failure:
  - `telemetry.track({ event: "search.success", traceId, metadata: { resultCount, duration, engine } })`
  - `telemetry.track({ event: "search.failure", traceId, metadata: { error, duration } })`
- Logger integration:
  - `logger.debug("Search started", { query, root, traceId })`
  - `logger.info("Search completed", { resultCount, duration, traceId })`
  - `logger.error("Search failed", { error, traceId })`
- EventBus integration:
  - `bus?.emit("search.completed", { traceId, results, duration })`
  - `bus?.emit("search.failed", { traceId, error })`
- Performance tracking:
  - Track engine detection time
  - Track search execution time
  - Track result formatting time

**Step 4: Run test (GREEN)**
```bash
bun test src/features/search/cli.test.ts
```
Expected: PASS

**Step 5: Commit**
```bash
git add src/features/search/cli.ts src/features/search/cli.test.ts
git commit -m "feat: add search telemetry"
```

---

### Task 5: Documentation + Examples (TDD)

**Files:**
- Create: `docs/commands/search.md`
- Create: `examples/search-usage.sh`

**Step 1: Write documentation**
- Full command reference
- Usage examples with real scenarios
- Performance tips (when to use rg vs native)
- Troubleshooting section

**Step 2: Create example scripts**
```bash
#!/usr/bin/env bash
# Search usage examples

# Basic search
nooa search "TODO"

# Search with regex
nooa search "\\bfunction\\s+\\w+" --regex

# JSON output for scripting
nooa search "error" --json | jq '.[] | .path'

# Search specific file types
nooa search "import" --include "*.ts" --exclude "*.test.ts"
```

**Step 3: Commit**
```bash
git add docs/commands/search.md examples/search-usage.sh
git commit -m "docs: add search command documentation"
```

---

### Task 6: Final Verification + Integration

**Step 1: Run full suite**
```bash
# Run all tests
bun test

# Run linters and type checks
bun check
bun run linter

# Test in real environment
bun run index.ts search "TODO" --json
bun run index.ts search "import" . --files-only
```

**Step 2: Performance benchmark**
```bash
# Create benchmark script
time bun run index.ts search "function" src/

# Compare rg vs native
NOOA_SEARCH_ENGINE=rg time bun run index.ts search "function" src/
NOOA_SEARCH_ENGINE=native time bun run index.ts search "function" src/
```

**Step 3: Commit any fixes**
```bash
git add -A
git commit -m "chore: finalize search feature with benchmarks"
```

**Step 4: Create PR checklist**
- [ ] All tests passing
- [ ] Type checking passing
- [ ] Linter passing
- [ ] Documentation complete
- [ ] Examples tested
- [ ] Telemetry verified
- [ ] Performance acceptable (< 500ms for typical repo)
- [ ] Error messages clear and helpful
- [ ] Help text comprehensive

---

## Additional Improvements

### Error Handling Strategy

1. **Validation errors** (exit code 2):
   - Missing required arguments
   - Invalid flag combinations
   - Invalid regex patterns

2. **Runtime errors** (exit code 1):
   - File system access denied
   - Search timeout
   - Engine execution failure

3. **User-friendly messages**:
   - Suggest corrections for typos
   - Provide next steps for failures
   - Include trace ID in all error messages

### Performance Optimizations

1. **Smart engine selection**:
   - Use rg for large codebases (>1000 files)
   - Use native for small projects or when rg unavailable
   - Cache engine detection result

2. **Result streaming**:
   - Stream results as they're found (for interactive mode)
   - Buffer results for JSON output

3. **Resource limits**:
   - Max file size: 10MB
   - Search timeout: 30s
   - Max results: configurable (default 100)

### Testing Strategy

1. **Unit tests**: Each function in isolation
2. **Integration tests**: CLI end-to-end
3. **Performance tests**: Benchmark on large repos
4. **Edge cases**:
   - Binary files
   - Symbolic links
   - Permission issues
   - Empty directories
   - Large files
   - Unicode content

### Future Enhancements (Not in scope)

- Interactive mode with fuzzy matching
- Watch mode for continuous search
- Export to different formats (CSV, XML)
- Integration with IDE/editor
- Syntax highlighting in output
