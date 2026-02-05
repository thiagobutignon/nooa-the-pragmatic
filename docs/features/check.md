# check

## Description

Audit code against project policies (Zero-Preguiça)

## CLI Usage

```text
Usage: nooa check [path] [flags]

Audit code against project policies (Zero-Preguiça) or YAML guardrail profiles.

Flags:
  --staged           Audit only staged files in git.
  --json             Output result as structured JSON.
  -p, --profile      Path to YAML guardrail profile (uses guardrail engine).
  -h, --help         Show help message.

Examples:
  nooa check
  nooa check src --json
  nooa check --staged
  nooa check --profile .nooa/guardrails/profiles/security.yaml

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error / Policy Violations
  3: Guardrail Warnings

Error Codes:
  check.git_error: Git error when reading staged files
  check.policy_violation: Policy violations found
  check.guardrail_failed: Guardrail failed
  check.guardrail_warning: Guardrail warnings
  check.runtime_error: Unexpected error
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="check">
  <purpose>Audit code against project policies (Zero-Preguiça)</purpose>
  <usage>
    <cli>nooa check [path] [flags]</cli>
    <sdk>await check.run({ path: "." })</sdk>
    <tui>CheckConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="path" type="string" required="false" />
      <field name="staged" type="boolean" required="false" />
      <field name="profile" type="string" required="false" />
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="mode" type="string" />
      <field name="result" type="string" />
      <field name="report" type="string" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
    <code value="2">Policy violation / validation error</code>
    <code value="3">Guardrail warning</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa check</input>
      <output>Policy check</output>
    </example>
    <example>
      <input>nooa check src --json</input>
      <output>JSON policy report</output>
    </example>
    <example>
      <input>nooa check --profile .nooa/guardrails/profiles/security.yaml</input>
      <output>Guardrail report</output>
    </example>
  </examples>
  <errors>
    <error code="check.git_error">Git error when reading staged files.</error>
    <error code="check.policy_violation">Policy violations found.</error>
    <error code="check.guardrail_failed">Guardrail failed.</error>
    <error code="check.guardrail_warning">Guardrail warnings.</error>
    <error code="check.runtime_error">Unexpected error.</error>
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
  const result = await check.run({ path: ".", staged: false });
  if (result.ok) console.log(result.data.result.ok);
```

## Changelog

  1.0.0: Initial release