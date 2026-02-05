# worktree

## Description

Manage git worktrees for isolated development

## CLI Usage

```text
Usage: nooa worktree <subcommand> [args] [flags]

Manage git worktrees for isolated development.

Subcommands:
  create <branch>    Create a new worktree (default when no subcommand provided).
  list               List existing worktrees under .worktrees/.
  remove <branch>    Remove a managed worktree.
  prune              Clean up stale worktrees.
  lock <branch>      Lock a worktree before force pushes.
  unlock <branch>    Unlock a previously locked worktree.
  info <branch>      Show metadata for a managed worktree (JSON output available).

Flags:
  --base <branch>    Base branch to branch from (default: main).
  --no-install       Skip automatic dependency installation.
  --no-test          Skip automatic test verification.
  --json             Output results as JSON (supported by create/list).
  -h, --help         Show help message.

Examples:
  nooa worktree create feat/login
  nooa worktree list
  nooa worktree remove feat/login
  nooa worktree lock feat/login
  nooa worktree prune

Exit Codes:
  0: Success
  1: Runtime Error (git or install failure)
  2: Validation Error (invalid inputs or context)
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="worktree">
  <purpose>Manage git worktrees for isolated development</purpose>
  <usage>
    <cli>nooa worktree &lt;subcommand&gt; [args] [flags]</cli>
    <sdk>await worktree.run({ action: "create", branch: "feat/login" })</sdk>
    <tui>WorktreeConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="action" type="string" required="true" />
      <field name="branch" type="string" required="false" />
      <field name="base" type="string" required="false" />
      <field name="no-install" type="boolean" required="false" />
      <field name="no-test" type="boolean" required="false" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="mode" type="string" />
      <field name="branch" type="string" />
      <field name="base" type="string" />
      <field name="worktree_path" type="string" />
      <field name="skip_install" type="boolean" />
      <field name="skip_test" type="boolean" />
      <field name="entries" type="string" />
      <field name="path" type="string" />
      <field name="status" type="string" />
      <field name="duration_ms" type="number" />
      <field name="raw" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa worktree create feat/login</input>
      <output>Worktree created</output>
    </example>
    <example>
      <input>nooa worktree list --json</input>
      <output>{ worktrees: [...] }</output>
    </example>
  </examples>
  <errors>
    <error code="worktree.missing_action">Subcommand is required.</error>
    <error code="worktree.invalid_input">Invalid input.</error>
    <error code="worktree.runtime_error">Runtime error.</error>
  </errors>
  <changelog>
    <version number="1.0.0">
      <change>Initial release</change>
    </version>
  </changelog>
</instruction>
```

## SDK

```text
SDK Usage:
  await worktree.run({ action: "create", branch: "feat/login" });
  await worktree.run({ action: "list" });
```

## Changelog

  1.0.0: Initial release