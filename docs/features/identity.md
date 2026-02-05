# identity

## Description

Initialize agent identity artifacts (Legacy)

## CLI Usage

```text
Usage: nooa init [flags]

Initialize NOOA identity artifacts (Identity, Soul, User) in .nooa/ directory.

Flags:
  -h, --help    Show help message
  --force       Overwrite existing files (not implemented yet, safe default)

Exit Codes:
  0: Success
  1: Runtime Error

Error Codes:
  init.runtime_error: Init failed
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="identity">
  <purpose>Initialize agent identity artifacts (Legacy)</purpose>
  <usage>
    <cli>nooa init [flags]</cli>
    <sdk>await init.run({ force: false })</sdk>
    <tui>InitConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="force" type="boolean" required="false" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="message" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
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
  const result = await init.run({ force: false });
  if (result.ok) console.log(result.data.message);
```

## Changelog

  1.0.0: Initial release