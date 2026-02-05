# ci

## Description

Run local CI pipeline (test + lint + check)

## CLI Usage

```text
Usage: nooa ci [flags]

Run local CI pipeline (test + lint + policy check).

Flags:
  --json         Output results as JSON.
  --out <file>   Write results to a file.
  -h, --help     Show help message.

Examples:
  nooa ci
  nooa ci --json
  nooa ci --json --out .nooa/reports/ci.json

Exit Codes:
  0: Success
  1: Runtime Error (CI failed)

Error Codes:
  ci.failed: CI pipeline failed
  ci.runtime_error: CI execution failed
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="ci">
  <purpose>Run local CI pipeline (test + lint + check)</purpose>
  <usage>
    <cli>nooa ci [flags]</cli>
    <sdk>await ci.run({ json: true })</sdk>
    <tui>CiConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="json" type="boolean" required="false" />
      <field name="out" type="string" required="false" />
    </input>

    <output>
      <field name="ok" type="boolean" />
      <field name="traceId" type="string" />
      <field name="stages" type="string" />
      <field name="duration_ms" type="number" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa ci</input>
      <output>Runs CI</output>
    </example>
    <example>
      <input>nooa ci --json</input>
      <output>JSON report</output>
    </example>
  </examples>
  <errors>
    <error code="ci.failed">CI pipeline failed.</error>
    <error code="ci.runtime_error">CI execution failed.</error>
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
  const result = await ci.run({ json: true });
  if (result.ok) console.log(result.data.ok);
```

## Changelog

  1.0.0: Initial release