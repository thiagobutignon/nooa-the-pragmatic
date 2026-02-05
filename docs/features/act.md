# act

## Description

Autonomous agent orchestrator

## CLI Usage

```text
Usage: nooa act <goal> [flags]

Orchestrate multiple commands to achieve a high-level goal.
The agent perceives capabilities via self-describing modules (AgentDocs).

Arguments:
  <goal>         The objective to achieve (e.g. "Check code and fix lint errors").

Flags:
  --model <name>      LLM model to use (default: configured in env).
  --provider <name>   LLM provider (default: ollama).
  --turns <number>    Max turns (default: 10).
  --json              Output result as JSON.
  -h, --help          Show help message.

Examples:
  nooa act "Get the title of README.md"
  nooa act "Run CI and summarize failures" --model gpt-4

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  act.missing_goal: Goal is required
  act.max_turns_exceeded: Goal not achieved within turn limit
  act.runtime_error: Execution failed
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="act">
  <purpose>Autonomous agent orchestrator</purpose>
  <usage>
    <cli>nooa act &lt;goal&gt; [flags]</cli>
    <sdk>await act.run({ goal: "Fix bugs" })</sdk>
    <tui>ActConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="goal" type="string" required="true" />
      <field name="model" type="string" required="false" />
      <field name="provider" type="string" required="false" />
      <field name="turns" type="number" required="false" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="ok" type="boolean" />
      <field name="history" type="string" />
      <field name="finalAnswer" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime Error</code>
    <code value="2">Validation Error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa act 'Check status'</input>
      <output>Orchestration result</output>
    </example>
  </examples>
  <errors>
    <error code="act.missing_goal">Goal is required.</error>
    <error code="act.max_turns_exceeded">Goal not achieved within turn limit.</error>
    <error code="act.runtime_error">Execution failed.</error>
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
  const result = await act.run({ goal: "Fix bugs" });
  if (result.ok) console.log(result.data.finalAnswer);
```

## Changelog

  1.0.0: Initial release