# record

## Description

Capture agent-first raw execution records for local commands

## CLI Usage

```text
Usage: nooa record <subcommand> [flags] -- <command...>

Capture agent-first raw execution records for local commands.

Subcommands:
  inspect              Run a command and persist a raw execution record.

Flags:
  --json               Output structured JSON.
  -h, --help           Show help message.

Examples:
  nooa record inspect -- node script.js
  nooa record inspect -- bun test src/features/debug

Exit Codes:
  0: Success
  1: Runtime error
  2: Validation error

Error Codes:
  record.missing_subcommand: Missing subcommand.
  record.invalid_target: Unsupported or missing runtime command.
  record.runtime_error: Record capture failed.
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="record">
  <purpose>Capture agent-first raw execution records for local commands</purpose>
  <usage>
    <cli>nooa record &lt;subcommand&gt; [flags] -- &lt;command...&gt;</cli>
    <sdk>await record.run({ action: "inspect", command: ["node", "script.js"] })</sdk>
    <tui>RecordConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="action" type="string" required="true" />
      <field name="command" type="array" required="false" />
      <field name="json" type="boolean" required="false" default="false" />
    </input>

    <output>
      <field name="mode" type="string" />
      <field name="recordId" type="string" />
      <field name="traceId" type="string" />
      <field name="command" type="array" />
      <field name="cwd" type="string" />
      <field name="stdout" type="string" />
      <field name="stderr" type="string" />
      <field name="filesTouched" type="array" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa record inspect -- node script.js</input>
      <output>Run a command and persist a raw execution record.</output>
    </example>
  </examples>
  <errors>
    <error code="record.missing_subcommand">Missing subcommand.</error>
    <error code="record.invalid_target">Unsupported or missing runtime command.</error>
    <error code="record.runtime_error">Record capture failed.</error>
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
  const result = await record.run({ action: "inspect", command: ["node", "script.js"] });
  if (result.ok) console.log(result.data.recordId);
```

## Changelog

  1.0.0: Initial release