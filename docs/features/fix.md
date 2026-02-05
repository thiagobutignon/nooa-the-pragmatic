# fix

## Description

Autonomous bug fix loop

## CLI Usage

```text
Usage: nooa fix <issue> [flags]

Autonomous agent loop: worktree → context → patch → verify → commit.

Arguments:
  <issue>        A description or ID of the bug/feature to fix.

Flags:
  --dry-run      Analyze but do not perform changes.
  --json         Output results as JSON.
  -h, --help     Show help message.

Examples:
  nooa fix "fix logger typo"
  nooa fix "implement new auth flow" --dry-run

Exit Codes:
  0: Success
  1: Runtime Error (fix failed)
  2: Validation Error (missing issue)

Error Codes:
  fix.missing_issue: Issue description required
  fix.runtime_error: Fix failed
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="fix">
  <purpose>Autonomous bug fix loop</purpose>
  <usage>
    <cli>nooa fix &lt;issue&gt; [flags]</cli>
    <sdk>await fix.run({ issue: "fix logger typo" })</sdk>
    <tui>FixConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="issue" type="string" required="true" />
      <field name="dry-run" type="boolean" required="false" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="ok" type="boolean" />
      <field name="traceId" type="string" />
      <field name="stages" type="string" />
      <field name="error" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa fix "fix logger typo"</input>
      <output>Fix results</output>
    </example>
    <example>
      <input>nooa fix "auth flow" --dry-run</input>
      <output>Dry run</output>
    </example>
  </examples>
  <errors>
    <error code="fix.missing_issue">Issue description required.</error>
    <error code="fix.runtime_error">Fix failed.</error>
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
  const result = await fix.run({ issue: "fix logger typo", dryRun: true });
  if (result.ok) console.log(result.data.traceId);
```

## Changelog

  1.0.0: Initial release