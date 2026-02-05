# pwd

## Description

Print current working directory

## CLI Usage

```text
Usage: nooa pwd [flags]

Print the current working directory.

Flags:
  --json              Output JSON with cwd.
  --include-changelog Include changelog in help output.
  -h, --help          Show help message.

Examples:
  nooa pwd
  nooa pwd --json

Exit Codes:
  0: Success
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="pwd">
  <purpose>Print current working directory</purpose>
  <usage>
    <cli>nooa pwd</cli>
    <sdk>await pwd.run({})</sdk>
    <tui>PwdLabel()</tui>
  </usage>
  <contract>
    <input>
      <field name="json" type="boolean" required="false" default="false" since="1.0.0" />
    </input>

    <output>
      <field name="cwd" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa pwd</input>
      <output>/path/to/project</output>
    </example>
    <example>
      <input>nooa pwd --json</input>
      <output>{ "cwd": "/path/to/project" }</output>
    </example>
  </examples>
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
  const result = await pwd.run({});
  if (result.ok) {
    console.log(result.data.cwd);
  }
```

## Changelog

  1.0.0: Initial release