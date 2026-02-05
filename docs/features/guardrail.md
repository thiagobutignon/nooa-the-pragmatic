# guardrail

## Description

Run guardrail profile checks on code

## CLI Usage

```text
Usage: nooa guardrail <subcommand> [options]

Subcommands:
  check      Run guardrail checks against code
  validate   Validate a YAML profile schema
  init       Initialize .nooa/guardrails directory
  list       List available guardrail profiles
  show       Show a normalized guardrail profile
  spec       Operate on GUARDRAIL.md (spec validate)
  add        Add a new guardrail profile
  remove     Remove a guardrail profile

Check Options:
  --profile, -p <path>   Path to YAML profile
  --spec                 Use GUARDRAIL.md spec (combines profiles)
  --watch, -w            Watch for file changes (continuous mode)
  --json                 Output as JSON
  --deterministic        Ensure byte-identical output (default with --json)

Validate Options:
  --profile, -p <path>   Path to YAML profile (required)

Examples:
  nooa guardrail check --spec
  nooa guardrail check --spec --watch
  nooa guardrail check --profile .nooa/guardrails/profiles/security.yaml
  nooa guardrail check -p audit.yaml --json
  nooa guardrail validate --profile my-profile.yaml
  nooa guardrail init
  nooa guardrail list
  nooa guardrail show security
  nooa guardrail spec validate
  nooa guardrail spec show
  nooa guardrail spec init
  nooa guardrail add my-profile
  nooa guardrail remove my-profile --force

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error
  3: Blocking Findings
  4: Warning Findings

Error Codes:
  guardrail.missing_subcommand: Missing subcommand
  guardrail.invalid_subcommand: Unknown subcommand
  guardrail.missing_profile: Profile is required
  guardrail.missing_name: Profile name required
  guardrail.force_required: --force required
  guardrail.invalid_profile: Profile invalid
  guardrail.not_found: Profile not found
  guardrail.runtime_error: Unexpected error
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="guardrail">
  <purpose>Run guardrail profile checks on code</purpose>
  <usage>
    <cli>nooa guardrail &lt;subcommand&gt; [options]</cli>
    <sdk>await guardrail.run({ action: "check", profile: "security" })</sdk>
    <tui>GuardrailConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="action" type="string" required="true" />
      <field name="profile" type="string" required="false" />
      <field name="spec" type="boolean" required="false" />
      <field name="watch" type="boolean" required="false" />
      <field name="json" type="boolean" required="false" />
      <field name="deterministic" type="boolean" required="false" />
      <field name="force" type="boolean" required="false" />
    </input>

    <output>
      <field name="mode" type="string" />
      <field name="report" type="string" />
      <field name="profiles" type="string" />
      <field name="result" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Validation error</code>
    <code value="3">Blocking findings</code>
    <code value="4">Warning findings</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa guardrail check --spec</input>
      <output>Run guardrails</output>
    </example>
    <example>
      <input>nooa guardrail list</input>
      <output>List profiles</output>
    </example>
  </examples>
  <errors>
    <error code="guardrail.missing_subcommand">Missing subcommand.</error>
    <error code="guardrail.invalid_subcommand">Unknown subcommand.</error>
    <error code="guardrail.missing_profile">Profile is required.</error>
    <error code="guardrail.missing_name">Profile name required.</error>
    <error code="guardrail.force_required">--force required.</error>
    <error code="guardrail.invalid_profile">Profile invalid.</error>
    <error code="guardrail.not_found">Profile not found.</error>
    <error code="guardrail.runtime_error">Unexpected error.</error>
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
  await guardrail.run({ action: "check", profile: "security" });
  await guardrail.run({ action: "list" });
```

## Changelog

  1.0.0: Initial release