# review

## Description

Perform a code review

## CLI Usage

```text
Usage: nooa review [path] [flags]

Perform an AI-powered code review of a file or staged changes.

Arguments:
  [path]              Path to a file to review. If omitted, staged changes are reviewed.

Flags:
  --prompt <name>     Use a specific prompt template (default: review).
  --json              Output as structured JSON.
  --out <file>        Save output to a file (especially useful with --json).
  --fail-on <level>   Exit with code 1 if findings with severity >= level are found.
                      (Levels: low, medium, high)
  -h, --help          Show help message.

Examples:
  nooa review src/index.ts
  nooa review --json --out review-results.json
  nooa review --fail-on high

Exit Codes:
  0: Success
  1: Runtime Error (AI failure or parsing issues)
  2: Validation Error (missing input or invalid severity)

Error Codes:
  review.no_input: No input source provided
  review.not_found: File not found
  review.invalid_severity: Invalid fail-on level
  review.runtime_error: Review failed
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="review">
  <purpose>Perform a code review</purpose>
  <usage>
    <cli>nooa review [path] [flags]</cli>
    <sdk>await review.run({ path: "src/index.ts" })</sdk>
    <tui>ReviewConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="path" type="string" required="false" />
      <field name="prompt" type="string" required="false" />
      <field name="json" type="boolean" required="false" />
      <field name="out" type="string" required="false" />
      <field name="fail-on" type="string" required="false" />
    </input>

    <output>
      <field name="ok" type="boolean" />
      <field name="traceId" type="string" />
      <field name="content" type="string" />
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
      <input>nooa review src/index.ts</input>
      <output>Review output</output>
    </example>
    <example>
      <input>nooa review --json --out review-results.json</input>
      <output>JSON review output</output>
    </example>
    <example>
      <input>nooa review --fail-on high</input>
      <output>Exit non-zero</output>
    </example>
  </examples>
  <errors>
    <error code="review.no_input">No input source provided.</error>
    <error code="review.not_found">File not found.</error>
    <error code="review.invalid_severity">Invalid severity level. Use low, medium, or high.</error>
    <error code="review.runtime_error">Review failed.</error>
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
  const result = await review.run({ path: "src/index.ts", prompt: "review" });
  if (result.ok) console.log(result.data.content);
```

## Changelog

  1.0.0: Initial release