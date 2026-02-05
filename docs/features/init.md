# init

## Description

Initialize NOOA's Agentic Soul and Identity

## CLI Usage

```text
Usage: nooa init [flags]

Initialize NOOA's Agentic Soul and Identity.

Flags:
  --name <name>         Name of the agent (default: NOOA).
  --vibe <vibe>         Vibe of the agent (snarky, protocol, resourceful).
  --user-name <name>    What the agent should call you.
  --root <path>         Project root directory.
  --force               Overwrite existing configuration.
  --dry-run             Do not write files.
  --non-interactive     Skip interactive prompts.
  --out <path>          Write JSON output to file.
  --json                Output results as JSON.
  -h, --help            Show help message.

Examples:
  nooa init
  nooa init --name "NOOA-Pragmatic" --vibe "snarky" --non-interactive

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  init.already_exists: .nooa directory already exists
  init.runtime_error: Init failed
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="init">
  <purpose>Initialize NOOA's Agentic Soul and Identity</purpose>
  <usage>
    <cli>nooa init [flags]</cli>
    <sdk>await init.run({ name: "NOOA" })</sdk>
    <tui>InitConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="name" type="string" required="false" />
      <field name="vibe" type="string" required="false" />
      <field name="user-name" type="string" required="false" />
      <field name="user-role" type="string" required="false" />
      <field name="working-style" type="string" required="false" />
      <field name="architecture" type="string" required="false" />
      <field name="root" type="string" required="false" />
      <field name="force" type="boolean" required="false" />
      <field name="dry-run" type="boolean" required="false" />
      <field name="non-interactive" type="boolean" required="false" />
      <field name="out" type="string" required="false" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="traceId" type="string" />
      <field name="results" type="string" />
      <field name="dryRun" type="boolean" />
      <field name="name" type="string" />
      <field name="vibe" type="string" />
      <field name="userName" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa init</input>
      <output>Identity initialized</output>
    </example>
    <example>
      <input>nooa init --force</input>
      <output>Overwrite identity</output>
    </example>
  </examples>
  <errors>
    <error code="init.already_exists">.nooa directory already exists.</error>
    <error code="init.runtime_error">Init failed.</error>
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
  const result = await init.run({ name: "NOOA", vibe: "resourceful" });
  if (result.ok) console.log(result.data.results);
```

## Changelog

  1.0.0: Initial release