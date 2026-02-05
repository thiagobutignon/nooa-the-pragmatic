# ask

## Description

Query indexed code/memory

## CLI Usage

```text
Usage: nooa ask <query> [flags]

Search code and memory using semantic similarity.

Flags:
  --limit <n>    Limit result count (default: 5).
  --json         Output results as JSON.
  -h, --help     Show help message.

Exit Codes:
  0: Success
  1: Runtime Error (search failed)
  2: Validation Error (missing query)

Error Codes:
  ask.missing_query: Query required
  ask.runtime_error: Search failed
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="ask">
  <purpose>Query indexed code/memory</purpose>
  <usage>
    <cli>nooa ask &lt;query&gt; [flags]</cli>
    <sdk>await ask.run({ query: "find TODOs", limit: 5 })</sdk>
    <tui>AskPanel()</tui>
  </usage>
  <contract>
    <input>
      <field name="query" type="string" required="true" />
      <field name="limit" type="number" required="false" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="query" type="string" />
      <field name="results" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa ask "find TODOs"</input>
      <output>Search results</output>
    </example>
    <example>
      <input>nooa ask init --json</input>
      <output>JSON results</output>
    </example>
  </examples>
  <errors>
    <error code="ask.missing_query">Query required.</error>
    <error code="ask.runtime_error">Search failed.</error>
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
  const result = await ask.run({ query: "find TODOs", limit: 5 });
  if (result.ok) console.log(result.data.results.length);
```

## Changelog

  1.0.0: Initial release