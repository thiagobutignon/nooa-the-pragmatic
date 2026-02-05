# ignore

## Description

Manage .nooa-ignore patterns

## CLI Usage

```text
Usage: nooa ignore <command> [pattern] [paths...] [flags]

Manage .nooa-ignore patterns for policy audits.

Commands:
  add <pattern>        Add a new pattern to the ignore list.
  remove <pattern>     Remove a pattern from the ignore list.
  list                 Display all current ignore patterns.
  check <path>         Check whether <path> is ignored by the current list.
  test <pattern> [path...]
                       Test a pattern locally against sample paths.

Flags:
  --json               Output results as JSON.
  -h, --help           Show help message.

Examples:
  nooa ignore add secret.ts
  nooa ignore list
  nooa ignore check logs/app.log
  nooa ignore test "logs/*.log" logs/app.log README.md

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  ignore.missing_command: Subcommand required
  ignore.missing_pattern: Pattern required
  ignore.missing_path: Path required
  ignore.unknown_command: Unknown subcommand
  ignore.runtime_error: Unexpected error
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="ignore">
  <purpose>Manage .nooa-ignore patterns</purpose>
  <usage>
    <cli>nooa ignore &lt;command&gt; [pattern] [paths...] [flags]</cli>
    <sdk>await ignore.run({ action: "list" })</sdk>
    <tui>IgnoreConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="action" type="string" required="true" />
      <field name="pattern" type="string" required="false" />
      <field name="paths" type="string" required="false" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="mode" type="string" />
      <field name="pattern" type="string" />
      <field name="patterns" type="string" />
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
      <input>nooa ignore add secret.ts</input>
      <output>Add pattern</output>
    </example>
    <example>
      <input>nooa ignore list</input>
      <output>List patterns</output>
    </example>
  </examples>
  <errors>
    <error code="ignore.missing_command">Subcommand required.</error>
    <error code="ignore.missing_pattern">Pattern required.</error>
    <error code="ignore.missing_path">Path required.</error>
    <error code="ignore.unknown_command">Unknown subcommand.</error>
    <error code="ignore.runtime_error">Unexpected error.</error>
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
  await ignore.run({ action: "add", pattern: "secret.ts" });
  const result = await ignore.run({ action: "list" });
```

## Changelog

  1.0.0: Initial release