# embed

## Description

Generate embeddings for text or files

## CLI Usage

```text
Usage: nooa embed <text|file> <input> [flags]

Arguments:
  text <string>     Embed a raw string
  file <path>       Embed file contents

Flags:
  --model <name>            Model name (default: nomic-embed-text)
  --provider <name>         Provider (default: ollama)
  --include-embedding       Include vector in output
  --out <file>              Write JSON output to file
  --json                    Output JSON (default)
  -h, --help                Show help

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  embed.missing_action: Action (text/file) is required
  embed.missing_text: Text is required
  embed.missing_path: File path is required
  embed.unknown_action: Unknown embed action
  embed.runtime_error: Embedding failed
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="embed">
  <purpose>Generate embeddings for text or files</purpose>
  <usage>
    <cli>nooa embed &lt;text|file&gt; &lt;input&gt; [flags]</cli>
    <sdk>await embed.run({ action: "text", input: "hello" })</sdk>
    <tui>EmbedConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="action" type="string" required="true" />
      <field name="input" type="string" required="true" />
      <field name="model" type="string" required="false" />
      <field name="provider" type="string" required="false" />
      <field name="include-embedding" type="boolean" required="false" />
      <field name="out" type="string" required="false" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="id" type="string" />
      <field name="model" type="string" />
      <field name="provider" type="string" />
      <field name="dimensions" type="number" />
      <field name="input" type="string" />
      <field name="embedding" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa embed text "hello"</input>
      <output>Embedding output</output>
    </example>
    <example>
      <input>nooa embed file README.md</input>
      <output>Embedding output</output>
    </example>
  </examples>
  <errors>
    <error code="embed.missing_action">Action (text/file) is required.</error>
    <error code="embed.missing_text">Text is required.</error>
    <error code="embed.missing_path">File path is required.</error>
    <error code="embed.unknown_action">Unknown embed action.</error>
    <error code="embed.read_failed">Failed to read file.</error>
    <error code="embed.runtime_error">Embedding failed.</error>
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
  const result = await embed.run({
    action: "text",
    input: "hello",
    provider: "ollama"
  });
  if (result.ok) console.log(result.data.model);
```

## Changelog

  1.0.0: Initial release