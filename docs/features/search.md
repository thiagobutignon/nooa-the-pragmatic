# search

## Description

Search files and file contents

## CLI Usage

```text
Usage: nooa search <query> [path] [flags]

Search for patterns in file contents or filenames.

Arguments:
  <query>            Search term or regex pattern.
  [path]             Directory to search in (default: .).

Flags:
  --regex            Treat query as a regular expression.
  --case-sensitive   Enable case-sensitive matching.
  --files-only       Only list matching file paths.
  --max-results <n>  Limit total matches (default: 100).
  --include <glob>   Include files matching glob (repeatable).
  --exclude <glob>   Include files matching glob (repeatable).
  --json             Output detailed results as JSON.
  --plain            Output results in a stable, parseable format.
  --no-color         Disable terminal colors in output.
  --context <n>      Show n lines of context (default: 0).
  --ignore-case, -i  Enable case-insensitive matching.
  --count, -c        Show only the count of matches per file.
  --hidden           Include hidden files and directories.
  -h, --help         Show help message.

Examples:
  nooa search "TODO" . --include "*.ts"
  nooa search "class User" src --json
  nooa search "error" logs --context 2 --regex

Exit Codes:
  0: Success (matches found)
  1: Runtime Error (failed execution)
  2: Validation Error (missing query)
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="search">
  <purpose>Search files and file contents</purpose>
  <usage>
    <cli>nooa search &lt;query&gt; [path] [flags]</cli>
    <sdk>await search.run({ query: "TODO", root: "." })</sdk>
    <tui>SearchPanel()</tui>
  </usage>
  <contract>
    <input>
      <field name="query" type="string" required="true" />
      <field name="root" type="string" required="false" />
      <field name="regex" type="boolean" required="false" />
      <field name="case-sensitive" type="boolean" required="false" />
      <field name="files-only" type="boolean" required="false" />
      <field name="max-results" type="string" required="false" />
      <field name="include" type="string" required="false" />
      <field name="exclude" type="string" required="false" />
      <field name="plain" type="boolean" required="false" />
      <field name="no-color" type="boolean" required="false" />
      <field name="context" type="string" required="false" />
      <field name="ignore-case" type="boolean" required="false" />
      <field name="count" type="boolean" required="false" />
      <field name="hidden" type="boolean" required="false" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="results" type="string" />
      <field name="engine" type="string" />
      <field name="root" type="string" />
      <field name="query" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa search "TODO" . --include "*.ts"</input>
      <output>Matches list</output>
    </example>
    <example>
      <input>nooa search "class User" src --json</input>
      <output>JSON results</output>
    </example>
  </examples>
  <errors>
    <error code="search.missing_query">Query is required.</error>
    <error code="search.invalid_max_results">Invalid max-results.</error>
    <error code="search.runtime_error">Search failed.</error>
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
  const result = await search.run({ query: "TODO", root: ".", json: true });
  if (result.ok) console.log(result.data.results);
```

## Changelog

  1.0.0: Initial release