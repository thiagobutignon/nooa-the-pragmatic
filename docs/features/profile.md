# profile

## Description

Capture agent-first CPU hotspot summaries for commands

## CLI Usage

```text
Usage: nooa profile <subcommand> [flags] -- <command...>

Capture agent-first performance snapshots for a target command.

Subcommands:
  inspect              Run a command with CPU profiling enabled and summarize hotspots.

Flags:
  --json               Output structured JSON.
  -h, --help           Show help message.

Examples:
  nooa profile inspect -- node script.js
  nooa profile inspect --json -- bun run src/app.ts

Exit Codes:
  0: Success
  1: Runtime error
  2: Validation error

Error Codes:
  profile.invalid_action: Subcommand is required.
  profile.invalid_target: Unsupported or missing runtime command.
  profile.runtime_error: Profiling failed.
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="profile">
  <purpose>Capture agent-first CPU hotspot summaries for commands</purpose>
  <usage>
    <cli>nooa profile &lt;subcommand&gt; [flags] -- &lt;command...&gt;</cli>
    <sdk>await profile.run({ action: "inspect", command: ["node", "script.js"] })</sdk>
    <tui>ProfileConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="action" type="string" required="true" />
      <field name="command" type="string" required="true" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="mode" type="string" />
      <field name="traceId" type="string" />
      <field name="runtime" type="string" />
      <field name="exit_code" type="number" />
      <field name="duration_ms" type="number" />
      <field name="profile_path" type="string" />
      <field name="total_samples" type="number" />
      <field name="total_profiled_ms" type="number" />
      <field name="hotspots" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa profile inspect -- node script.js</input>
      <output>Profile a Node script and summarize hotspots.</output>
    </example>
    <example>
      <input>nooa profile inspect --json -- bun run src/app.ts</input>
      <output>Return a structured hotspot summary for an agent.</output>
    </example>
  </examples>
  <errors>
    <error code="profile.invalid_action">Subcommand is required.</error>
    <error code="profile.invalid_target">Unsupported or missing runtime command.</error>
    <error code="profile.runtime_error">Profiling failed.</error>
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
  const result = await profile.run({ action: "inspect", command: ["node", "script.js"] });
  if (result.ok) console.log(result.data.hotspots[0]);
```

## Changelog

  1.0.0: Initial release