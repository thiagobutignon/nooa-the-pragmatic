# mcp

## Description

Manage MCP integrations (list, install, enable, disable, call, health)

## CLI Usage

```text
Usage: nooa mcp <subcommand> [options]

Subcommands:
  init         Onboard recommended MCPs
  list         List installed/enabled/available MCPs
  install      Install an MCP server
  enable       Enable an MCP server
  disable      Disable an MCP server
  call         Execute an MCP tool
  resource     Read an MCP resource URI
  info         Show MCP server information
  configure    Configure MCP server settings
  alias        Manage stored MCP alias shortcuts
  uninstall    Remove an MCP configuration
  test         Ping an MCP server
  health       Check MCP server health

Options:
  -h, --help   Show this help message

Examples:
  nooa mcp list --enabled
  nooa mcp install @modelcontextprotocol/server-filesystem
  nooa mcp enable filesystem
  nooa mcp call filesystem read_file --path README.md

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  mcp.missing_subcommand: Missing subcommand
  mcp.unknown_subcommand: Unknown subcommand
  mcp.runtime_error: MCP command failed
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="mcp">
  <purpose>Manage MCP integrations (list, install, enable, disable, call, health)</purpose>
  <usage>
    <cli>nooa mcp &lt;subcommand&gt; [options]</cli>
    <sdk>await mcp.run({ command: "list" })</sdk>
    <tui>McpConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="command" type="string" required="true" />
      <field name="args" type="string" required="false" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
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
      <input>nooa mcp list</input>
      <output>List MCP servers</output>
    </example>
    <example>
      <input>nooa mcp call filesystem read_file --path README.md</input>
      <output>Call tool</output>
    </example>
  </examples>
  <errors>
    <error code="mcp.missing_subcommand">Missing subcommand.</error>
    <error code="mcp.unknown_subcommand">Unknown subcommand.</error>
    <error code="mcp.runtime_error">MCP command failed.</error>
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
  await mcp.run({ command: "list" });
  await mcp.run({ command: "call", args: ["filesystem", "read_file", "--path", "README.md"] });
```

## Changelog

  1.0.0: Initial release