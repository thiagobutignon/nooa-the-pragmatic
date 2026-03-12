# trace

## Description

Capture agent-first execution traces for local commands

## CLI Usage

```text
Usage: nooa trace <subcommand> [flags] -- <command...>

Capture agent-first execution traces for local commands.

Subcommands:
  inspect              Run a command and persist a compact execution trace.

Flags:
  --json               Output structured JSON.
  -h, --help           Show help message.

Examples:
  nooa trace inspect -- node script.js
  nooa trace inspect -- bun test src/features/debug

Exit Codes:
  0: Success
  1: Runtime error
  2: Validation error

Error Codes:
  trace.missing_subcommand: Missing subcommand.
  trace.invalid_target: Unsupported or missing runtime command.
  trace.runtime_error: Trace capture failed.
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="trace">
  <purpose>Capture agent-first execution traces for local commands</purpose>
  <usage>
    <cli>nooa trace &lt;subcommand&gt; [flags] -- &lt;command...&gt;</cli>
    <sdk>await trace.run({ action: "inspect", command: ["node", "script.js"] })</sdk>
    <tui>TraceConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="action" type="string" required="true" />
      <field name="command" type="array" required="false" />
      <field name="json" type="boolean" required="false" default="false" />
    </input>

    <output>
      <field name="mode" type="string" />
      <field name="traceId" type="string" />
      <field name="command" type="array" />
      <field name="cwd" type="string" />
      <field name="durationMs" type="number" />
      <field name="exitCode" type="number" />
      <field name="stdoutSummary" type="string" />
      <field name="stderrSummary" type="string" />
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
      <input>nooa trace inspect -- node script.js</input>
      <output>Run a command and persist a compact execution trace.</output>
    </example>
  </examples>
  <errors>
    <error code="trace.missing_subcommand">Missing subcommand.</error>
    <error code="trace.invalid_target">Unsupported or missing runtime command.</error>
    <error code="trace.runtime_error">Trace capture failed.</error>
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
  const result = await trace.run({ action: "inspect", command: ["node", "script.js"] });
  if (result.ok) console.log(result.data.traceId);
```

## Changelog

  1.0.0: Initial release