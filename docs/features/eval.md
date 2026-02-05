# eval

## Description

Systematic evaluation of AI prompts and outputs

## CLI Usage

```text
Usage: nooa eval <command> <prompt_name> --suite <name> [flags]

Systematic evaluation of AI prompts and outputs.

Commands:
  run          Execute evaluation suite on a prompt.
  suggest      Analyze failures and suggest improvements.
  apply        Bump prompt version if evaluation passes.
  report       Show the latest evaluation record for a prompt/suite combo.
  history      List recent evaluation runs for a prompt.
  compare      Diff two entries and display the score delta.

Flags:
  -s, --suite <name>     Name of the test suite (required).
  --json                 Output results as JSON.
  --judge <type>         Evaluation judge (deterministic, llm).
  --bump <level>         Version level for 'apply' (patch, minor, major).
  --limit <n>            Maximum entries for history/compare (default 5).
  --base <id>            Base entry id for compare mode.
  --head <id>            Head entry id for compare mode.
  --id <id>              Specific history entry for reports.
  --history-file <path>  Use an alternate history file (report/history/compare only).
  --fail-on-regression    Exit with code 1 if score < 1.0.
  -h, --help             Show help message.

Examples:
  nooa eval run review --suite standard
  nooa eval apply code --suite smoke --bump minor
  nooa eval history review --suite standard --limit 3

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  eval.missing_args: Missing required arguments
  eval.no_history: No history entries found
  eval.compare_insufficient: Need at least two entries to compare
  eval.invalid_command: Unknown subcommand
  eval.runtime_error: Evaluation failed
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="eval">
  <purpose>Systematic evaluation of AI prompts and outputs</purpose>
  <usage>
    <cli>nooa eval &lt;command&gt; &lt;prompt_name&gt; --suite &lt;name&gt;</cli>
    <sdk>await eval.run({ command: "run", promptName: "review", suite: "standard" })</sdk>
    <tui>EvalConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="command" type="string" required="true" />
      <field name="promptName" type="string" required="true" />
      <field name="suite" type="string" required="true" />
      <field name="json" type="boolean" required="false" />
      <field name="baseline" type="string" required="false" />
      <field name="fail-on-regression" type="boolean" required="false" />
      <field name="bump" type="string" required="false" />
      <field name="judge" type="string" required="false" />
      <field name="limit" type="string" required="false" />
      <field name="base" type="string" required="false" />
      <field name="head" type="string" required="false" />
      <field name="id" type="string" required="false" />
      <field name="history-file" type="string" required="false" />
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
      <input>nooa eval run review --suite standard</input>
      <output>Run suite</output>
    </example>
    <example>
      <input>nooa eval compare review --suite standard</input>
      <output>Compare</output>
    </example>
  </examples>
  <errors>
    <error code="eval.missing_args">Missing required arguments.</error>
    <error code="eval.no_history">No history entries found.</error>
    <error code="eval.compare_insufficient">Need at least two entries.</error>
    <error code="eval.invalid_command">Unknown subcommand.</error>
    <error code="eval.runtime_error">Evaluation failed.</error>
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
  const result = await evalCommand.run({
    command: "run",
    promptName: "review",
    suite: "standard"
  });
  if (result.ok) console.log(result.data);
```

## Changelog

  1.0.0: Initial release