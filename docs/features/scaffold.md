# scaffold

## Description

Standardize creation of new features and prompts

## CLI Usage

```text
Usage: nooa scaffold <command|prompt> <name> [flags]

Standardize creation of new features and prompts.

Arguments:
  <command|prompt>    Type of item to scaffold.
  <name>              Name of the item.

Flags:
  --dry-run      Log planned operations without writing to disk.
  --force        Allow overwriting existing files.
  --json         Output result as structured JSON.
  --out <file>   Write results report to a specific file.
  --with-docs    Generate documentation template.
  -h, --help     Show help message.

Examples:
  nooa scaffold command authentication
  nooa scaffold prompt review --with-docs

Exit Codes:
  0: Success
  1: Runtime Error (file IO failure)
  2: Validation Error (invalid arguments or name)

Error Codes:
  scaffold.invalid_args: Missing or invalid arguments
  scaffold.invalid_type: Type must be command or prompt
  scaffold.invalid_name: Name must be kebab-case and not reserved
  scaffold.already_exists: Destination file exists
  scaffold.runtime_error: Unexpected error
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="scaffold">
  <purpose>Standardize creation of new features and prompts</purpose>
  <usage>
    <cli>nooa scaffold &lt;command|prompt&gt; &lt;name&gt; [flags]</cli>
    <sdk>await scaffold.run({ type: "command", name: "my-feature" })</sdk>
    <tui>ScaffoldWizard()</tui>
  </usage>
  <contract>
    <input>
      <field name="type" type="string" required="true" />
      <field name="name" type="string" required="true" />
      <field name="force" type="boolean" required="false" />
      <field name="dry-run" type="boolean" required="false" />
      <field name="with-docs" type="boolean" required="false" />
      <field name="json" type="boolean" required="false" />
      <field name="out" type="string" required="false" />
    </input>

    <output>
      <field name="ok" type="boolean" />
      <field name="traceId" type="string" />
      <field name="kind" type="string" />
      <field name="name" type="string" />
      <field name="files" type="string" />
      <field name="dryRun" type="boolean" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa scaffold command authentication</input>
      <output>Creates a feature</output>
    </example>
    <example>
      <input>nooa scaffold prompt review --with-docs</input>
      <output>Creates a prompt template</output>
    </example>
  </examples>
  <errors>
    <error code="scaffold.invalid_args">Missing or invalid arguments.</error>
    <error code="scaffold.invalid_type">Type must be command or prompt.</error>
    <error code="scaffold.invalid_name">Name must be kebab-case and not reserved.</error>
    <error code="scaffold.already_exists">Destination file exists.</error>
    <error code="scaffold.runtime_error">Unexpected error.</error>
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
  await scaffold.run({ type: "command", name: "my-feature", dryRun: true });
  await scaffold.run({ type: "prompt", name: "review", withDocs: true });
```

## Changelog

  1.0.0: Initial release