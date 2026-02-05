# goal

## Description

Manage focus and goals

## CLI Usage

```text
Usage: nooa goal <subcommand> [flags]

Manage focus and prevent scope creep.

Subcommands:
  set <goal>     Set the current goal.
  status         Show current goal.
  clear          Clear the current goal.

Flags:
  --json         Output as JSON.
  -h, --help     Show help.

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  goal.missing_goal: Goal text required
  goal.invalid_command: Unknown subcommand
  goal.runtime_error: Operation failed
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="goal">
  <purpose>Manage focus and goals</purpose>
  <usage>
    <cli>nooa goal &lt;subcommand&gt; [flags]</cli>
    <sdk>await goal.run({ action: "status" })</sdk>
    <tui>GoalPanel()</tui>
  </usage>
  <contract>
    <input>
      <field name="action" type="string" required="true" />
      <field name="goal" type="string" required="false" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="mode" type="string" />
      <field name="goal" type="string" />
      <field name="message" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa goal set Ship it</input>
      <output>Goal set</output>
    </example>
    <example>
      <input>nooa goal status</input>
      <output>Current goal</output>
    </example>
  </examples>
  <errors>
    <error code="goal.missing_goal">Goal text required.</error>
    <error code="goal.invalid_command">Unknown subcommand.</error>
    <error code="goal.runtime_error">Operation failed.</error>
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
  await goal.run({ action: "set", goal: "Ship it" });
  const result = await goal.run({ action: "status" });
```

## Changelog

  1.0.0: Initial release