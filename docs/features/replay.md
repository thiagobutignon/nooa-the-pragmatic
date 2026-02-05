# replay

## Description

Track agent steps as a replayable graph

## CLI Usage

```text
Usage: nooa replay <subcommand> [args] [flags]

Track a step graph and fixes for agent workflows.

Subcommands:
  add <label>                Create a step node.
  link <from> <to>           Create a next edge.
  fix <targetId> <label>     Create a fix node and impact edges.
  show [id]                  Show graph summary or node details.

Flags:
  --json      Output result as JSON.
  --root      Override repository root (default: cwd).
  -h, --help  Show help message.

Examples:
  nooa replay add A
  nooa replay link node_a node_b
  nooa replay fix node_b "Fix B"
  nooa replay show --json

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="replay">
  <purpose>Track agent steps as a replayable graph</purpose>
  <usage>
    <cli>nooa replay &lt;subcommand&gt; [args] [--json]</cli>
    <sdk>await replay.run({ action: "add", label: "A" })</sdk>
    <tui>ReplayDialog()</tui>
  </usage>
  <contract>
    <input>
      <field name="action" type="string" required="true" />
      <field name="label" type="string" required="false" />
      <field name="from" type="string" required="false" />
      <field name="to" type="string" required="false" />
      <field name="targetId" type="string" required="false" />
      <field name="id" type="string" required="false" />
      <field name="root" type="string" required="false" />
      <field name="json" type="boolean" required="false" default="false" />
    </input>

    <output>
      <field name="ok" type="boolean" />
      <field name="traceId" type="string" />
      <field name="node" type="string" />
      <field name="edge" type="string" />
      <field name="summary" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa replay add A</input>
      <output>Creates a node</output>
    </example>
    <example>
      <input>nooa replay link node_a node_b</input>
      <output>Creates an edge</output>
    </example>
    <example>
      <input>nooa replay fix node_b "Fix B"</input>
      <output>Creates a fix node</output>
    </example>
    <example>
      <input>nooa replay show --json</input>
      <output>{ ... }</output>
    </example>
  </examples>
  <errors>
    <error code="replay.missing_action">Action is required.</error>
    <error code="replay.missing_input">Input is required.</error>
    <error code="replay.missing_from">From id is required.</error>
    <error code="replay.missing_to">To id is required.</error>
    <error code="replay.missing_target">Target id is required.</error>
    <error code="replay.not_found">Node not found.</error>
    <error code="replay.cycle_detected">Cycle detected.</error>
    <error code="replay.runtime_error">Unexpected error.</error>
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
  const result = await replay.run({ action: "add", label: "A" });
  if (result.ok) {
    console.log(result.data.node);
  }
```

## Changelog

  1.0.0: Initial release