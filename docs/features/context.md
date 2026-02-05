# context

## Description

Generate AI context pack

## CLI Usage

```text
Usage: nooa context <file|symbol> [flags]

Generate context pack for AI consumption.

Flags:
  --json         Output results as JSON.
  --include-mcp  Include MCP resource metadata.
  -h, --help     Show help message.

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error (missing target)

Error Codes:
  context.missing_target: File or symbol required
  context.runtime_error: Context build failed
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="context">
  <purpose>Generate AI context pack</purpose>
  <usage>
    <cli>nooa context &lt;file|symbol&gt; [flags]</cli>
    <sdk>await context.run({ target: "src/index.ts" })</sdk>
    <tui>ContextConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="target" type="string" required="true" />
      <field name="json" type="boolean" required="false" />
      <field name="include-mcp" type="boolean" required="false" />
    </input>

    <output>
      <field name="target" type="string" />
      <field name="related" type="string" />
      <field name="tests" type="string" />
      <field name="symbols" type="string" />
      <field name="recentCommits" type="string" />
      <field name="mcpResources" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa context src/index.ts</input>
      <output>Context summary</output>
    </example>
    <example>
      <input>nooa context SymbolName --json</input>
      <output>JSON output</output>
    </example>
  </examples>
  <errors>
    <error code="context.missing_target">File or symbol required.</error>
    <error code="context.runtime_error">Context build failed.</error>
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
  const result = await context.run({ target: "src/index.ts" });
  if (result.ok) console.log(result.data.target);
```

## Changelog

  1.0.0: Initial release