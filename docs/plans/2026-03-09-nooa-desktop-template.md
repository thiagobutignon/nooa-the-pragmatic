# NOOA Desktop Template Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an initial cross-platform desktop template using Tauri 2 + React + TypeScript + Bun with a ChatGPT-style chat UI that talks to the real NOOA runtime, scoped to a user-selected workspace.

**Architecture:** Add a desktop app shell under `apps/desktop/` with a Tauri backend that owns workspace selection, permission policy, and the NOOA bridge. Reuse NOOA runtime primitives where possible (`runtime/agent`, `tool-registry`, `features/code`) and expose structured desktop events to a polished React chat client with markdown rendering and custom event cards.

**Tech Stack:** Tauri 2, Rust command bridge, React 19, TypeScript, Bun, existing NOOA runtime/modules, markdown renderer, Biome.

---

### Task 1: Scaffold the desktop app shell

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/src/main.tsx`
- Create: `apps/desktop/src/app.tsx`
- Create: `apps/desktop/src/index.css`
- Create: `apps/desktop/index.html`
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src-tauri/src/main.rs`
- Modify: `package.json`

**Step 1: Write the failing shell smoke test**

Create a small test proving the desktop frontend state model can render an empty chat shell:

```ts
test("desktop shell renders workspace placeholder", () => {
  const state = createInitialDesktopState();
  expect(state.workspacePath).toBeNull();
});
```

**Step 2: Run test to verify it fails**

Run: `bun test apps/desktop/src/app.test.tsx`
Expected: FAIL because the desktop app files do not exist yet.

**Step 3: Add the Tauri + React scaffold**

Create a minimal React app and Tauri config under `apps/desktop/`, using Bun scripts from the repo root to run/build it.

**Step 4: Run test to verify it passes**

Run: `bun test apps/desktop/src/app.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json apps/desktop
git commit -m "feat(desktop): scaffold tauri desktop shell"
```

### Task 2: Define the desktop domain contract

**Files:**
- Create: `apps/desktop/src/lib/contracts.ts`
- Create: `apps/desktop/src/lib/contracts.test.ts`
- Create: `apps/desktop/src/lib/state.ts`
- Create: `apps/desktop/src/lib/state.test.ts`

**Step 1: Write failing contract tests**

Define the desktop event model before implementation:

```ts
test("approval events require request id and action payload", () => {
  const result = desktopApprovalEventSchema.safeParse({
    type: "approval_requested",
  });
  expect(result.success).toBe(false);
});
```

Also cover message blocks for markdown, file actions, and approval state.

**Step 2: Run tests to verify they fail**

Run: `bun test apps/desktop/src/lib/contracts.test.ts apps/desktop/src/lib/state.test.ts`
Expected: FAIL because the schemas/state do not exist yet.

**Step 3: Implement schema-driven desktop contracts**

Add typed schemas for:
- chat messages
- markdown segments / code blocks
- file operation events (`read`, `write`, `delete`)
- approval requests/results
- workspace state
- mode state (`full_access`, `ask_first`)

**Step 4: Run tests to verify they pass**

Run: `bun test apps/desktop/src/lib/contracts.test.ts apps/desktop/src/lib/state.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/desktop/src/lib
git commit -m "feat(desktop): add desktop state and event contracts"
```

### Task 3: Add the markdown rendering pipeline

**Files:**
- Create: `apps/desktop/src/components/markdown/MarkdownRenderer.tsx`
- Create: `apps/desktop/src/components/markdown/MarkdownRenderer.test.tsx`
- Create: `apps/desktop/src/components/markdown/markdown.css`
- Modify: `apps/desktop/package.json`

**Step 1: Write failing markdown rendering tests**

Cover:
- headings and lists
- fenced code blocks
- file path chips
- diff/code styling hooks

```tsx
test("renders fenced code blocks with language header", () => {
  render(<MarkdownRenderer markdown={"```ts\nconst x = 1;\n```"} />);
  expect(screen.getByText("ts")).toBeInTheDocument();
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test apps/desktop/src/components/markdown/MarkdownRenderer.test.tsx`
Expected: FAIL

**Step 3: Implement polished markdown rendering**

Use a markdown pipeline that supports custom renderers. Add components for headings, lists, inline code, fenced code, links, and file path chips.

**Step 4: Run tests to verify they pass**

Run: `bun test apps/desktop/src/components/markdown/MarkdownRenderer.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/desktop/src/components/markdown apps/desktop/package.json
git commit -m "feat(desktop): add polished markdown renderer"
```

### Task 4: Build the liquid metal / glassmorphism chat UI

**Files:**
- Create: `apps/desktop/src/components/layout/DesktopShell.tsx`
- Create: `apps/desktop/src/components/chat/ChatThread.tsx`
- Create: `apps/desktop/src/components/chat/Composer.tsx`
- Create: `apps/desktop/src/components/chat/EventCard.tsx`
- Create: `apps/desktop/src/components/chat/ApprovalCard.tsx`
- Create: `apps/desktop/src/components/sidebar/Sidebar.tsx`
- Create: `apps/desktop/src/components/design/tokens.css`
- Create: `apps/desktop/src/components/design/motion.css`
- Create: `apps/desktop/src/app.test.tsx`
- Modify: `apps/desktop/src/app.tsx`
- Modify: `apps/desktop/src/index.css`

**Step 1: Write failing UI tests**

Cover:
- empty workspace state
- sidebar shows mode toggle
- approval card renders inline in chat
- markdown assistant message renders through `MarkdownRenderer`

**Step 2: Run tests to verify they fail**

Run: `bun test apps/desktop/src/app.test.tsx`
Expected: FAIL

**Step 3: Implement the desktop interface**

Build a ChatGPT-like layout with:
- persistent sidebar with workspace selector
- centered chat thread
- inline approval cards
- liquid-metal/glassmorphism design tokens
- responsive layout for desktop and narrow widths

**Step 4: Run tests to verify they pass**

Run: `bun test apps/desktop/src/app.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/desktop/src/components apps/desktop/src/app.tsx apps/desktop/src/index.css
git commit -m "feat(desktop): build glassmorphism chat interface"
```

### Task 5: Create the desktop-side NOOA bridge contract

**Files:**
- Create: `src/runtime/desktop/contracts.ts`
- Create: `src/runtime/desktop/contracts.test.ts`
- Create: `src/runtime/desktop/session.ts`
- Create: `src/runtime/desktop/session.test.ts`

**Step 1: Write failing runtime bridge tests**

Cover:
- workspace confinement metadata
- approval queue state
- event translation from runtime output to desktop events

**Step 2: Run tests to verify they fail**

Run: `bun test src/runtime/desktop/contracts.test.ts src/runtime/desktop/session.test.ts`
Expected: FAIL

**Step 3: Implement runtime bridge types**

Add schemas and helper functions for:
- desktop session ids
- permission mode
- workspace root policy
- approval queue entries
- stream/event payloads sent to the desktop client

**Step 4: Run tests to verify they pass**

Run: `bun test src/runtime/desktop/contracts.test.ts src/runtime/desktop/session.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/runtime/desktop
git commit -m "feat(runtime): add desktop bridge contracts"
```

### Task 6: Implement workspace-scoped file tools and approval gate

**Files:**
- Create: `src/runtime/desktop/workspace-policy.ts`
- Create: `src/runtime/desktop/workspace-policy.test.ts`
- Create: `src/runtime/desktop/tools.ts`
- Create: `src/runtime/desktop/tools.test.ts`
- Modify: `src/runtime/tool-registry.ts`
- Modify: `src/features/code/cli.ts`

**Step 1: Write failing tests**

Cover:
- disallow paths outside selected workspace
- in `full_access`, actions run immediately
- in `ask_first`, file-mutating actions emit approval request and do not execute
- read actions follow the chosen policy you want for the template: in `ask_first`, they also request approval

**Step 2: Run tests to verify they fail**

Run: `bun test src/runtime/desktop/workspace-policy.test.ts src/runtime/desktop/tools.test.ts`
Expected: FAIL

**Step 3: Implement the policy + gated tool wrappers**

Wrap real file operations with:
- path normalization against workspace root
- action metadata (`read`, `write`, `delete`)
- approval hold/resume flow

Prefer adapting existing NOOA code operations instead of duplicating filesystem logic.

**Step 4: Run tests to verify they pass**

Run: `bun test src/runtime/desktop/workspace-policy.test.ts src/runtime/desktop/tools.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/runtime/desktop src/runtime/tool-registry.ts src/features/code/cli.ts
git commit -m "feat(runtime): add workspace-scoped approval gate"
```

### Task 7: Connect the real NOOA agent loop to desktop events

**Files:**
- Create: `src/runtime/desktop/agent-bridge.ts`
- Create: `src/runtime/desktop/agent-bridge.test.ts`
- Modify: `src/runtime/agent/loop.ts`
- Modify: `src/runtime/types.ts`
- Modify: `src/runtime/context/builder.ts`

**Step 1: Write failing tests**

Cover:
- user prompt enters NOOA loop
- tool calls are converted to desktop event stream entries
- assistant text is preserved as markdown content
- approval pending state pauses tool execution and resumes after approval

**Step 2: Run tests to verify they fail**

Run: `bun test src/runtime/desktop/agent-bridge.test.ts`
Expected: FAIL

**Step 3: Implement the bridge**

Do not fork a separate agent implementation. Reuse `AgentLoop`, but add hooks/callbacks so desktop can observe assistant turns and tool execution.

**Step 4: Run tests to verify they pass**

Run: `bun test src/runtime/desktop/agent-bridge.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/runtime/desktop src/runtime/agent/loop.ts src/runtime/types.ts src/runtime/context/builder.ts
git commit -m "feat(runtime): bridge nooa agent loop to desktop events"
```

### Task 8: Expose Tauri commands for workspace, chat, and approvals

**Files:**
- Create: `apps/desktop/src-tauri/src/commands/mod.rs`
- Create: `apps/desktop/src-tauri/src/commands/chat.rs`
- Create: `apps/desktop/src-tauri/src/commands/workspace.rs`
- Create: `apps/desktop/src-tauri/src/commands/approval.rs`
- Create: `apps/desktop/src/lib/tauri.ts`
- Create: `apps/desktop/src/lib/tauri.test.ts`
- Modify: `apps/desktop/src-tauri/src/main.rs`

**Step 1: Write failing tests**

Cover frontend wrappers and command payload normalization. If Rust unit tests are practical, add narrow tests for command input validation.

**Step 2: Run tests to verify they fail**

Run: `bun test apps/desktop/src/lib/tauri.test.ts`
Expected: FAIL

**Step 3: Implement the Tauri command surface**

Expose:
- `select_workspace`
- `send_chat_message`
- `approve_action`
- `deny_action`
- `set_permission_mode`
- `get_session_snapshot`

**Step 4: Run tests to verify they pass**

Run: `bun test apps/desktop/src/lib/tauri.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/desktop/src-tauri apps/desktop/src/lib/tauri.ts apps/desktop/src/lib/tauri.test.ts
git commit -m "feat(desktop): expose tauri command bridge"
```

### Task 9: Wire the React app to the live backend

**Files:**
- Create: `apps/desktop/src/hooks/useDesktopSession.ts`
- Create: `apps/desktop/src/hooks/useDesktopSession.test.ts`
- Modify: `apps/desktop/src/app.tsx`
- Modify: `apps/desktop/src/components/chat/ChatThread.tsx`
- Modify: `apps/desktop/src/components/chat/Composer.tsx`
- Modify: `apps/desktop/src/components/sidebar/Sidebar.tsx`

**Step 1: Write failing integration-style UI tests**

Cover:
- selecting workspace updates sidebar
- sending prompt appends user message and shows agent response
- approval card action updates state
- permission toggle changes current mode label

**Step 2: Run tests to verify they fail**

Run: `bun test apps/desktop/src/hooks/useDesktopSession.test.ts apps/desktop/src/app.test.tsx`
Expected: FAIL

**Step 3: Implement the live wiring**

Use Tauri invoke/listen bindings so the UI consumes the real event stream and renders the correct cards inline.

**Step 4: Run tests to verify they pass**

Run: `bun test apps/desktop/src/hooks/useDesktopSession.test.ts apps/desktop/src/app.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/desktop/src/hooks apps/desktop/src/app.tsx apps/desktop/src/components
git commit -m "feat(desktop): wire live nooa session into chat ui"
```

### Task 10: Add docs and verification commands

**Files:**
- Modify: `README.md`
- Create: `docs/features/desktop-template.md`
- Create: `apps/desktop/README.md`

**Step 1: Document how to run the template**

Include:
- prerequisites (Rust + Tauri deps)
- Bun commands
- permission modes
- workspace scoping model
- known limitations of the initial template

**Step 2: Run repo verification**

Run:
- `bun test`
- `bun run check:changed`

Expected:
- all tests pass
- changed-file check passes

**Step 3: Dogfood the template**

Run the desktop app locally and verify:
- selecting a workspace works
- NOOA can read/edit/delete inside that workspace
- `Ask First` produces inline approval cards
- markdown/code blocks render cleanly

**Step 4: Commit**

```bash
git add README.md docs/features/desktop-template.md apps/desktop/README.md
git commit -m "docs(desktop): document nooa desktop template"
```
