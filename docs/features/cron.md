# cron

## Description

Manage recurring jobs

## CLI Usage

```text
Usage: nooa cron <subcommand> [args] [flags]

Manage recurring jobs with persistence.

Subcommands:
  add <name> --every <schedule> -- <command...>     Create a job.
  list [--active] [--json]                         List jobs.
  remove <name> [--force] [--json]                  Remove a job.
  enable <name> [--json]                           Enable a job.
  disable <name> [--json]                          Disable a job.
  run <name> [--force] [--json]                    Run a job immediately.
  status <name> [--json]                           Show job status.
  logs <name> [--limit <n>] [--since <date>] [--json]  View execution logs.
  edit <name> [--schedule <cron>] [--command <cmd>] [--description <text>]  Update a job.
  pause <name> [--json]                            Pause (disable) a job temporarily.
  resume <name> [--json]                           Resume a paused job.
  history <name> [--limit <n>] [--since <date>] [--json]  Alias for logs.

Flags:
  --every <schedule>      Cron schedule (5m, 0 2 * * *, etc).
  --description <text>    Job description (add/edit).
  --on-failure <action>   notify|retry|ignore (default: notify).
  --retry <n>             Retry attempts on failure.
  --timeout <duration>    Max runtime (e.g., 30m).
  --start-at <datetime>   First execution window.
  --end-at <datetime>     Stop after this time.
  --max-runs <n>          Maximum number of runs.
  --command <text>        Command string (edit).
  --schedule <cron>       Updated schedule (edit).
  --limit <n>             How many logs to show.
  --since <date>          Only logs newer than this timestamp.
  --force                 Force destructive operations (remove/run).
  --json                  Emit JSON output.
  --daemon <cmd>          Manage daemon (start|stop|status).
  -h, --help              Show this help.

Examples:
  nooa cron add daily-index --every "6h" -- index repo
  nooa cron list --json
  nooa cron run daily-index --force
  nooa cron logs daily-index --limit 5
  nooa cron edit daily-index --schedule "0 3 * * *"
  nooa cron remove daily-index --force --json

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  cron.missing_action: Missing subcommand
  cron.missing_name: Job name required
  cron.missing_schedule: Missing --every <schedule>
  cron.missing_command: Command required after --
  cron.missing_update: Provide schedule/command/description
  cron.not_found: Job not found
  cron.force_required: --force required
  cron.runtime_error: Unexpected error
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="cron">
  <purpose>Manage recurring jobs</purpose>
  <usage>
    <cli>nooa cron &lt;subcommand&gt; [args] [flags]</cli>
    <sdk>await cron.run({ action: "list" })</sdk>
    <tui>CronConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="action" type="string" required="true" />
      <field name="name" type="string" required="false" />
      <field name="json" type="boolean" required="false" />
      <field name="every" type="string" required="false" />
      <field name="description" type="string" required="false" />
      <field name="on-failure" type="string" required="false" />
      <field name="retry" type="string" required="false" />
      <field name="timeout" type="string" required="false" />
      <field name="start-at" type="string" required="false" />
      <field name="end-at" type="string" required="false" />
      <field name="max-runs" type="string" required="false" />
      <field name="schedule" type="string" required="false" />
      <field name="command" type="string" required="false" />
      <field name="limit" type="string" required="false" />
      <field name="since" type="string" required="false" />
      <field name="force" type="boolean" required="false" />
      <field name="daemon" type="string" required="false" />
      <field name="active" type="boolean" required="false" />
    </input>

    <output>
      <field name="mode" type="string" />
      <field name="result" type="string" />
      <field name="jobs" type="string" />
      <field name="job" type="string" />
      <field name="logs" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa cron list</input>
      <output>List jobs</output>
    </example>
    <example>
      <input>nooa cron add job --every 5m -- index repo</input>
      <output>Add job</output>
    </example>
    <example>
      <input>nooa cron remove job --force</input>
      <output>Remove job</output>
    </example>
  </examples>
  <errors>
    <error code="cron.missing_action">Missing subcommand.</error>
    <error code="cron.missing_name">Job name required.</error>
    <error code="cron.missing_schedule">Missing --every <schedule>.</error>
    <error code="cron.missing_command">Command required after --.</error>
    <error code="cron.missing_update">Provide schedule/command/description.</error>
    <error code="cron.not_found">Job not found.</error>
    <error code="cron.force_required">--force required.</error>
    <error code="cron.runtime_error">Unexpected error.</error>
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
  await cron.run({ action: "list" });
  await cron.run({ action: "add", name: "daily", every: "6h", command: "index repo" });
```

## Changelog

  1.0.0: Initial release