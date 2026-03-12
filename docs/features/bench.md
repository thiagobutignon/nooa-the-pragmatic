# bench

## Description

Capture benchmark repeated command execution for local commands

## CLI Usage

```text
Usage: nooa bench <subcommand> [flags] -- <command...>

Capture benchmark repeated command execution for local commands.

Subcommands:
  inspect              Run a command repeatedly and summarize duration statistics.

Flags:
  --runs <n>           Number of runs to execute (default: 3).
  --json               Output structured JSON.
  -h, --help           Show help message.

Examples:
  nooa bench inspect --runs 3 -- node script.js
  nooa bench inspect -- bun test src/features/debug

Exit Codes:
  0: Success
  1: Runtime error
  2: Validation error

Error Codes:
  bench.missing_subcommand: Missing subcommand.
  bench.invalid_target: Unsupported or missing runtime command.
  bench.runtime_error: Bench capture failed.
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="bench">
  <purpose>Capture benchmark repeated command execution for local commands</purpose>
  <usage>
    <cli>nooa bench &lt;subcommand&gt; [flags] -- &lt;command...&gt;</cli>
    <sdk>await bench.run({ action: "inspect", runs: 3, command: ["node", "script.js"] })</sdk>
    <tui>BenchConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="action" type="string" required="true" />
      <field name="command" type="array" required="false" />
      <field name="runs" type="number" required="false" default="3" />
      <field name="json" type="boolean" required="false" default="false" />
    </input>

    <output>
      <field name="mode" type="string" />
      <field name="benchId" type="string" />
      <field name="runs" type="number" />
      <field name="traceIds" type="array" />
      <field name="durationStats" type="object" />
      <field name="successRate" type="number" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa bench inspect --runs 3 -- node script.js</input>
      <output>Run a command repeatedly and summarize duration statistics.</output>
    </example>
  </examples>
  <errors>
    <error code="bench.missing_subcommand">Missing subcommand.</error>
    <error code="bench.invalid_target">Unsupported or missing runtime command.</error>
    <error code="bench.runtime_error">Bench capture failed.</error>
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
  const result = await bench.run({ action: "inspect", runs: 3, command: ["node", "script.js"] });
  if (result.ok) console.log(result.data.benchId);
```

## Changelog

  1.0.0: Initial release