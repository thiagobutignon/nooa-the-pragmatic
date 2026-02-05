# message

## Description

Send a message to the AI agent

## CLI Usage

```text
Usage: nooa message <text> [flags]

Send a message to the AI agent.

Arguments:
  <text>         The message content (required).

Flags:
  --role <type>  Message role: user, system, assistant (default: user).
  --json         Output result in JSON format.
  -h, --help     Show help message.

Examples:
  nooa message "Hello, how are you?"
  nooa message "Initialize system" --role system
  nooa message "Summarize this" --json

Exit Codes:
  0: Success
  1: Runtime Error (failed execution)
  2: Validation Error (missing text or invalid role)

Error Codes:
  message.missing_text: Message text is required
  message.invalid_role: Invalid message role
  message.runtime_error: Failed to send message
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="message">
  <purpose>Send a message to the AI agent</purpose>
  <usage>
    <cli>nooa message &lt;text&gt; [flags]</cli>
    <sdk>await message.run({ content: "Hello", role: "user" })</sdk>
    <tui>MessageConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="content" type="string" required="true" />
      <field name="role" type="string" required="false" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="output" type="string" />
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
      <input>nooa message "Hello"</input>
      <output>Message output</output>
    </example>
    <example>
      <input>nooa message "Init" --role system</input>
      <output>System message</output>
    </example>
  </examples>
  <errors>
    <error code="message.missing_text">Message text is required.</error>
    <error code="message.invalid_role">Invalid message role.</error>
    <error code="message.runtime_error">Failed to send message.</error>
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
  const result = await message.run({ content: "Hello", role: "user" });
  if (result.ok) console.log(result.data.output);
```

## Changelog

  1.0.0: Initial release