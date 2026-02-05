# run

## Description

Execute multiple commands in a pipeline

## CLI Usage

```text
Usage: nooa run [flags] -- <cmd1> -- <cmd2> ...
       nooa run [flags] "cmd1" "cmd2" ...

Execute multiple commands in a pipeline.

Modes:
  1. Delimiter Mode (Recommended): Separate commands with --
     nooa run -- code write foo.ts -- commit -m "feat: foo"

  2. String Mode: Pass commands as quoted strings
     nooa run "code write foo.ts" "commit -m 'feat: foo'"

Flags:
  --continue-on-error   Continue to next step even if a step fails.
  --json                Output results as JSON (includes schemaVersion and runId).
  --capture-output      Capture stdout/stderr for each step (external commands only).
  --allow-external      Allow executing non-nooa commands (without 'exec' prefix).
  --dry-run             Parse and show plan without executing.
  -h, --help            Show help message.

Exit Codes:
  0: Success
  1: Runtime Error (failed command)
  2: Validation Error (missing commands)

Error Codes:
  run.missing_steps: No commands provided
  run.runtime_error: Pipeline failed
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="run">
  <purpose>Execute multiple commands in a pipeline</purpose>
  <usage>
    <cli>nooa run [flags] -- &lt;cmd1&gt; -- &lt;cmd2&gt; ...</cli>
    <sdk>await run.run({ steps: ["code write foo.ts"] })</sdk>
    <tui>RunPipelineConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="steps" type="string" required="true" />
      <field name="json" type="boolean" required="false" />
      <field name="dry-run" type="boolean" required="false" />
      <field name="continue-on-error" type="boolean" required="false" />
      <field name="capture-output" type="boolean" required="false" />
      <field name="allow-external" type="boolean" required="false" />
    </input>

    <output>
      <field name="ok" type="boolean" />
      <field name="failedStepIndex" type="number" />
      <field name="steps" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa run -- code write foo.ts -- commit -m "feat: foo"</input>
      <output>Pipeline executed</output>
    </example>
    <example>
      <input>nooa run "code write foo.ts" "commit -m 'feat: foo'"</input>
      <output>Pipeline executed</output>
    </example>
  </examples>
  <errors>
    <error code="run.missing_steps">No commands provided.</error>
    <error code="run.runtime_error">Pipeline failed.</error>
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
  const result = await run.run({
    steps: ["code write foo.ts", "commit -m 'feat: foo'"],
    continueOnError: false
  });
  if (result.ok) console.log(result.data.steps.length);
```

## Changelog

  1.0.0: Initial release