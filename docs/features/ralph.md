# ralph

## Description

Run the Ralph backlog loop for autonomous feature delivery

## CLI Usage

```text
Usage: nooa ralph <subcommand> [args] [flags]

Run the Ralph backlog loop for autonomous feature delivery.

Subcommands:
  init                 Initialize .nooa/ralph/ state for the current branch.
  status               Show current Ralph run status.
  import-prd <path>    Import a Ralph-compatible prd.json into .nooa/ralph/.
  select-story         Select the next pending story from the active PRD.
  step                 Execute one story and stop at peer review.
  review               Run peer review for a specific story.
  approve              Mark a story as approved without another review round.
  promote-learning     Show promotion candidates extracted for one story.
  run                  Execute repeated fresh Ralph steps.

Flags:
  --json               Output results as JSON.
  --story <id>         Target a specific story ID.
  --max-iterations <n> Maximum number of step iterations (default: 10).
  -h, --help           Show help message.

Examples:
  nooa ralph init
  nooa ralph status --json
  nooa ralph import-prd ./prd.json
  nooa ralph select-story --json
  nooa ralph step --json
  nooa ralph review --story US-001 --json
  nooa ralph approve --story US-001 --json
  nooa ralph promote-learning --story US-001 --json
  nooa ralph run --max-iterations 1 --json

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  ralph.missing_action: Subcommand required
  ralph.missing_path: Path required
  ralph.unsafe_state_path: .nooa/ralph/ is not git-ignored
  ralph.runtime_error: Unexpected error
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="ralph">
  <purpose>Run the Ralph backlog loop for autonomous feature delivery</purpose>
  <usage>
    <cli>nooa ralph &lt;subcommand&gt; [args] [flags]</cli>
    <sdk>await ralph.run({ action: "status" })</sdk>
    
  </usage>
  <contract>
    <input>
      <field name="action" type="string" required="true" />
      <field name="path" type="string" required="false" />
      <field name="json" type="boolean" required="false" />
      <field name="max-iterations" type="number" required="false" />
      <field name="story" type="string" required="false" />
    </input>

    <output>
      <field name="mode" type="string" />
      <field name="initialized" type="boolean" />
      <field name="runId" type="string" />
      <field name="branchName" type="string" />
      <field name="status" type="string" />
      <field name="storyCounts" type="string" />
      <field name="path" type="string" />
      <field name="story" type="string" />
      <field name="ok" type="boolean" />
      <field name="storyId" type="string" />
      <field name="state" type="string" />
      <field name="rounds" type="number" />
      <field name="candidates" type="string" />
      <field name="reason" type="string" />
      <field name="iterations" type="number" />
      <field name="completedStories" type="number" />
      <field name="blockedStories" type="number" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa ralph init</input>
      <output>Initialize Ralph state in .nooa/ralph/.</output>
    </example>
    <example>
      <input>nooa ralph status --json</input>
      <output>Return the current Ralph status as JSON.</output>
    </example>
  </examples>
  <errors>
    <error code="ralph.missing_action">Subcommand required.</error>
    <error code="ralph.missing_path">Path required.</error>
    <error code="ralph.unsafe_state_path">.nooa/ralph/ must be git-ignored before init.</error>
    <error code="ralph.runtime_error">Unexpected error.</error>
  </errors>
  <changelog>
    <version number="1.0.0">
      <change>Initial init and status flows</change>
    </version>
  </changelog>
</instruction>
```

## SDK

```text
SDK Usage:
  await ralph.run({ action: "init" });
  const status = await ralph.run({ action: "status", json: true });
```

## Changelog

  1.0.0: Initial init and status flows
