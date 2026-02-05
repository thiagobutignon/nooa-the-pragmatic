# ai

## Description

Query the AI engine

## CLI Usage

```text
Usage: nooa ai <prompt> [flags]

Directly query the AI engine.

Arguments:
  <prompt>       The prompt text (required).

Flags:
  --provider <name>   Provider name (default: ollama, fallback: openai).
  --model <name>      Model name override.
  --json              Output as JSON.
  --stream            Stream output tokens to stdout (CLI).
  --mcp-source <name> MCP server to execute a tool.
  --mcp-tool <name>   Tool name exposed by the MCP server.
  --mcp-args <json>   Arguments to pass to the MCP tool (JSON).
  -h, --help          Show help.

Examples:
  nooa ai "Who are you?"
  nooa ai "Explain TDD" --provider openai
  nooa ai "Tell a joke" --json
```

## Agent Instructions

```xml
<instruction version="1.1.0" name="ai">
  <purpose>Query the AI engine</purpose>
  <usage>
    <cli>nooa ai &lt;prompt&gt; [flags]</cli>
    <sdk>await ai.run({ prompt: "Hello" })</sdk>
    <tui>AiConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="prompt" type="string" required="true" />
      <field name="provider" type="string" required="false" />
      <field name="model" type="string" required="false" />
      <field name="json" type="boolean" required="false" />
      <field name="stream" type="boolean" required="false" since="1.1.0" />
      <field name="mcp-source" type="string" required="false" />
      <field name="mcp-tool" type="string" required="false" />
      <field name="mcp-args" type="string" required="false" />
    </input>

    <output>
      <field name="mode" type="string" />
      <field name="content" type="string" />
      <field name="provider" type="string" />
      <field name="model" type="string" />
      <field name="usage" type="string" />
      <field name="server" type="string" />
      <field name="tool" type="string" />
      <field name="result" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa ai "Who are you?"</input>
      <output>AI response text</output>
    </example>
    <example>
      <input>nooa ai "Tell a joke" --json</input>
      <output>{ ... }</output>
    </example>
  </examples>
  <errors>
    <error code="ai.missing_prompt">Prompt is required.</error>
    <error code="ai.mcp_invalid_args">MCP args must be valid JSON.</error>
    <error code="ai.mcp_error">Error invoking MCP tool.</error>
    <error code="ai.runtime_error">AI execution failed.</error>
  </errors>
  <changelog>
    <version number="1.1.0">
      <change>Added streaming support</change>
    </version>
    <version number="1.0.0">
      <change>Initial release</change>
    </version>
  </changelog>
</instruction>
```

## SDK

```text
SDK Usage:
  const result = await ai.run({ prompt: "Hello", provider: "ollama" });
  if (result.ok) console.log(result.data.content);
```

## Changelog

  1.1.0: Added streaming support

  1.0.0: Initial release