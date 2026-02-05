# index

## Description

Semantic indexing operations

## CLI Usage

```text
Usage: nooa index [subcommand] [flags]

Semantic indexing for code and memory.

Subcommands:
  repo     Index all TypeScript and Markdown files in the repository.
  file     Index a specific file.
  clear    Clear the index.
  stats    Show index statistics.
  rebuild  Clear and rebuild the index.

Flags:
  --json         Output results as JSON.
  -h, --help     Show help message.

Examples:
  nooa index repo
  nooa index file src/index.ts
  nooa index stats --json

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  index.missing_command: Subcommand required
  index.missing_path: File path required
  index.runtime_error: Index operation failed
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="index">
  <purpose>Semantic indexing operations</purpose>
  <usage>
    <cli>nooa index [subcommand] [flags]</cli>
    <sdk>await index.run({ action: "repo" })</sdk>
    <tui>IndexConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="action" type="string" required="true" />
      <field name="path" type="string" required="false" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="mode" type="string" />
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
      <input>nooa index repo</input>
      <output>Index repository</output>
    </example>
    <example>
      <input>nooa index file src/index.ts</input>
      <output>Index file</output>
    </example>
  </examples>
  <errors>
    <error code="index.missing_command">Subcommand required.</error>
    <error code="index.missing_path">File path required.</error>
    <error code="index.runtime_error">Index operation failed.</error>
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
  await index.run({ action: "repo" });
  await index.run({ action: "file", path: "src/index.ts" });
```

## Changelog

  1.0.0: Initial release