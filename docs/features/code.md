# code

## Description

Code operations (write, patch, diff, format, refactor)

## CLI Usage

```text
Usage: nooa code <subcommand> [args] [flags]

Code operations.

Subcommands:
  write <path>        Create or overwrite a file.
  patch <path>        Apply a unified diff.
  diff [path]         Show git diff for path or all.
  format <path>       Format a file using biome.
  refactor <path> "instruction"  Refactor a file using AI.

Flags:
  --from <path>       Read content from a file (write mode).
  --overwrite         Overwrite destination if it exists (write mode).
  --patch             Read unified diff from stdin (patch mode).
  --patch-from <path> Read unified diff from a file (patch mode).
  --patch/--patch-from cannot be combined with --from.
  --json              Output result as JSON.
  --dry-run           Do not write the file.
  -h, --help          Show help message.

Examples:
  nooa code write app.ts --from template.ts
  nooa code diff src/
  nooa code format src/index.ts
  nooa code refactor src/utils.ts "rename process to handler"
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="code">
  <purpose>Code operations (write, patch, diff, format, refactor)</purpose>
  <usage>
    <cli>nooa code &lt;subcommand&gt; [args] [flags]</cli>
    <sdk>await code.run({ action: "write", path: "app.ts", content: "..." })</sdk>
    <tui>CodeConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="action" type="string" required="true" />
      <field name="path" type="string" required="false" />
      <field name="instruction" type="string" required="false" />
      <field name="from" type="string" required="false" />
      <field name="content" type="string" required="false" />
      <field name="overwrite" type="boolean" required="false" />
      <field name="dry-run" type="boolean" required="false" />
      <field name="patch" type="boolean" required="false" />
      <field name="patch-from" type="string" required="false" />
      <field name="patchText" type="string" required="false" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="mode" type="string" />
      <field name="path" type="string" />
      <field name="bytes" type="number" />
      <field name="overwritten" type="boolean" />
      <field name="dryRun" type="boolean" />
      <field name="patched" type="boolean" />
      <field name="output" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa code write app.ts --from template.ts</input>
      <output>Writes file</output>
    </example>
    <example>
      <input>nooa code patch app.ts --patch-from fix.patch</input>
      <output>Patches file</output>
    </example>
    <example>
      <input>nooa code diff src/</input>
      <output>Git diff output</output>
    </example>
  </examples>
  <errors>
    <error code="code.missing_action">Action is required.</error>
    <error code="code.missing_path">Destination path is required.</error>
    <error code="code.missing_input">Missing input. Use --from or stdin.</error>
    <error code="code.missing_patch_input">Missing patch input. Use --patch-from or stdin.</error>
    <error code="code.patch_with_from">--patch is mutually exclusive with --from.</error>
    <error code="code.format_missing_path">Path required for format.</error>
    <error code="code.refactor_missing_args">Path and instructions required for refactor.</error>
    <error code="code.runtime_error">Runtime error.</error>
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
  await code.run({ action: "write", path: "app.ts", content: "hello" });
  await code.run({ action: "patch", path: "app.ts", patchText: "diff..." });
  await code.run({ action: "diff", path: "src/index.ts" });
```

## Changelog

  1.0.0: Initial release