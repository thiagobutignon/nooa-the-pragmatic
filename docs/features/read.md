# read

## Description

Read file contents

## CLI Usage

```text
Usage: nooa read <path> [flags]

Read file contents from the local filesystem.

Arguments:
  <path>      Path to the file to read.

Flags:
  --json              Output JSON with path, bytes, content.
  --include-changelog Include changelog in help output.
  -h, --help          Show help message.

Examples:
  nooa read README.md
  nooa read src/index.ts --json

Exit Codes:
  0: Success
  1: Runtime Error (file not found or read failed)
  2: Validation Error (missing path)

Error Codes:
  read.missing_path: Path required or invalid
  read.not_found: File not found
  read.read_failed: Read failed
  read.outside_root: Path is outside basePath
```

## Agent Instructions

```xml
<instruction version="1.3.0" name="read">
  <purpose>Read file contents</purpose>
  <usage>
    <cli>nooa read &lt;path&gt; [--json]</cli>
    <sdk>await read.run({ path: "file.txt", json: false, basePath: "/path/to/project" })</sdk>
    <tui>ReadFileDialog({ initialPath })</tui>
  </usage>
  <contract>
    <input>
      <field name="path" type="string" required="true" />
      <field name="json" type="boolean" required="false" default="false" since="1.1.0" />
      <field name="basePath" type="string" required="false" since="1.3.0" />
    </input>

    <output>
      <field name="ok" type="boolean" />
      <field name="traceId" type="string" />
      <field name="path" type="string" />
      <field name="bytes" type="number" />
      <field name="content" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">File not found or read failed</code>
    <code value="2">Path required or invalid</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa read README.md</input>
      <output>File contents to stdout</output>
    </example>
    <example>
      <input>nooa read package.json --json</input>
      <output>{ "path": "package.json", "bytes": 1234, "content": "..." }</output>
    </example>
  </examples>
  <errors>
    <error code="read.missing_path">Path required or invalid</error>
    <error code="read.not_found">File not found</error>
    <error code="read.read_failed">Read failed</error>
    <error code="read.outside_root">Path is outside basePath</error>
  </errors>
  <changelog>
    <version number="1.3.0">
      <change>Added basePath support to constrain reads</change>
    </version>
    <version number="1.2.0">
      <change>Added stdin support</change>
    </version>
    <version number="1.1.0">
      <change>Added --json flag</change>
    </version>
    <version number="1.0.0">
      <change>Initial release</change>
    </version>
  </changelog>
</instruction>
```

## SDK

```text
SDK Usage:
  const result = await read.run({
    path: "file.txt",
    json: false,
    basePath: "/path/to/project"
  });
  if (result.ok) {
    console.log(result.data.content);
  }
```

## Changelog

  1.3.0: Added basePath support to constrain reads

  1.2.0: Added stdin support

  1.1.0: Added --json flag

  1.0.0: Initial release