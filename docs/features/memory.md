# memory

## Description

Manage NOOA's persistent memory

## CLI Usage

```text
Usage: nooa memory <add|search|promote|get|summarize> [args] [flags]

Manage NOOA's persistent memory.

Actions:
  add <content>        Add a new memory entry to daily log
  delete <id>          Delete a memory entry
  update <id> <text>   Update a memory entry
  clear                Wipe all memory (requires --force)
  export <path>        Export memory to JSON
  import <path>        Import memory from JSON
  search <query>       Search memory entries (lexical by default)
  promote <id>         Move a daily entry to durable memory
  get <id>             Show full details of a memory entry
  summarize            Curate daily logs into .nooa/MEMORY_SUMMARY.md

Flags:
  --semantic           Use semantic search instead of lexical
  --force              Confirm destructive actions
  --type <type>        decision|fact|preference|rule|gotcha
  --scope <scope>      project|user|repo|command
  --confidence <lvl>   low|medium|high
  --tags <tag>         Custom tags (repeatable)
  --json               Output as structured JSON
  -h, --help           Show help message

Examples:
  nooa memory add "Store key insight"
  nooa memory search "auth" --json
  nooa memory promote mem_123

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  memory.missing_action: Missing subcommand
  memory.missing_content: Memory content required
  memory.missing_id: Memory ID required
  memory.missing_path: Path required
  memory.missing_query: Search query required
  memory.force_required: --force required
  memory.not_found: Memory entry not found
  memory.runtime_error: Unexpected error
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="memory">
  <purpose>Manage NOOA's persistent memory</purpose>
  <usage>
    <cli>nooa memory &lt;add|search|promote|get|summarize&gt; [args] [flags]</cli>
    <sdk>await memory.run({ action: "search", query: "auth" })</sdk>
    <tui>MemoryConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="action" type="string" required="true" />
      <field name="id" type="string" required="false" />
      <field name="content" type="string" required="false" />
      <field name="query" type="string" required="false" />
      <field name="path" type="string" required="false" />
      <field name="type" type="string" required="false" />
      <field name="scope" type="string" required="false" />
      <field name="confidence" type="string" required="false" />
      <field name="tags" type="string" required="false" />
      <field name="trace-id" type="string" required="false" />
      <field name="semantic" type="boolean" required="false" />
      <field name="out" type="string" required="false" />
      <field name="force" type="boolean" required="false" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="action" type="string" />
      <field name="entry" type="string" />
      <field name="entries" type="string" />
      <field name="id" type="string" />
      <field name="path" type="string" />
      <field name="message" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa memory add "Store key insight"</input>
      <output>Added entry</output>
    </example>
    <example>
      <input>nooa memory search "auth"</input>
      <output>List entries</output>
    </example>
    <example>
      <input>nooa memory promote mem_123</input>
      <output>Promoted entry</output>
    </example>
  </examples>
  <errors>
    <error code="memory.missing_action">Missing subcommand.</error>
    <error code="memory.missing_content">Memory content required.</error>
    <error code="memory.missing_id">Memory ID required.</error>
    <error code="memory.missing_path">Path required.</error>
    <error code="memory.missing_query">Search query required.</error>
    <error code="memory.force_required">--force required.</error>
    <error code="memory.not_found">Memory entry not found.</error>
    <error code="memory.runtime_error">Unexpected error.</error>
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
  const result = await memory.run({ action: "search", query: "auth" });
  if (result.ok) console.log(result.data.entries);
```

## Changelog

  1.0.0: Initial release