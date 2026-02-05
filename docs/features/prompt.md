# prompt

## Description

Manage and render AI prompts

## CLI Usage

```text
Usage: nooa prompt <list|view|validate|render|create|edit|delete|publish> [name] [flags]

Manage and render versioned AI prompts.

Subcommands:
  list                List all available prompts.
  view <name>         View a specific prompt's metadata and body.
  validate <name|--all> Check if prompt templates are valid.
  render <name>       Render a prompt with variables.
  create <name>       Create a new prompt template.
  edit <name>         Edit a prompt via unified diff patch (stdin).
  delete <name>       Delete a prompt template.
  publish <name>      Bump prompt version and update changelog.

Flags:
  --var key=value     Variable for rendering (can be used multiple times).
  --body <text>       Body content for create (or via stdin).
  --description <t>   Description for create.
  --output <format>   Output format for create (json|markdown).
  --patch             Read unified diff patch from stdin (edit).
  --level <l>         Publish level: patch, minor, major.
  --note <text>       Changelog note for publish (or via stdin).
  --json              Output as JSON.
  --all               Operate on all prompts (used with validate).
  -h, --help          Show help message.

Examples:
  nooa prompt list
  nooa prompt view review --json
  nooa prompt render review --var input="some code"
  nooa prompt create my-prompt --description "My Prompt" --body "Hello"
  nooa prompt edit my-prompt --patch < patch.diff
  nooa prompt publish my-prompt --level patch --note "Refined instructions"

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  prompt.missing_action: Missing subcommand
  prompt.missing_name: Prompt name required
  prompt.missing_description: Missing --description
  prompt.invalid_output: Invalid --output
  prompt.missing_body: Prompt body required
  prompt.missing_patch: Missing --patch
  prompt.missing_level: Missing --level
  prompt.invalid_level: Invalid --level
  prompt.missing_note: Missing --note
  prompt.runtime_error: Unexpected error
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="prompt">
  <purpose>Manage and render AI prompts</purpose>
  <usage>
    <cli>nooa prompt &lt;list|view|validate|render|create|edit|delete|publish&gt; [name] [flags]</cli>
    <sdk>await prompt.run({ action: "list" })</sdk>
    <tui>PromptConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="action" type="string" required="true" />
      <field name="name" type="string" required="false" />
      <field name="var" type="string" required="false" />
      <field name="body" type="string" required="false" />
      <field name="description" type="string" required="false" />
      <field name="output" type="string" required="false" />
      <field name="patch" type="boolean" required="false" />
      <field name="level" type="string" required="false" />
      <field name="note" type="string" required="false" />
      <field name="all" type="boolean" required="false" />
      <field name="json" type="boolean" required="false" />
      <field name="debug-injection" type="boolean" required="false" />
    </input>

    <output>
      <field name="action" type="string" />
      <field name="name" type="string" />
      <field name="prompts" type="string" />
      <field name="prompt" type="string" />
      <field name="rendered" type="string" />
      <field name="version" type="string" />
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
      <input>nooa prompt list</input>
      <output>List prompts</output>
    </example>
    <example>
      <input>nooa prompt view review</input>
      <output>Prompt details</output>
    </example>
    <example>
      <input>nooa prompt publish review --level patch --note note</input>
      <output>Publish prompt</output>
    </example>
  </examples>
  <errors>
    <error code="prompt.missing_action">Missing subcommand.</error>
    <error code="prompt.missing_name">Prompt name required.</error>
    <error code="prompt.missing_description">Missing --description.</error>
    <error code="prompt.invalid_output">Invalid --output.</error>
    <error code="prompt.missing_body">Prompt body required.</error>
    <error code="prompt.missing_patch">Missing --patch.</error>
    <error code="prompt.missing_level">Missing --level.</error>
    <error code="prompt.invalid_level">Invalid --level.</error>
    <error code="prompt.missing_note">Missing --note.</error>
    <error code="prompt.runtime_error">Unexpected error.</error>
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
  const result = await prompt.run({ action: "list" });
  if (result.ok) console.log(result.data.prompts);
```

## Changelog

  1.0.0: Initial release