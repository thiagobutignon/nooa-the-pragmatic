# doctor

## Description

Check environment health

## CLI Usage

```text
Usage: nooa doctor [flags]

Check development environment health.

Flags:
  --json         Output results as JSON.
  -h, --help     Show help message.

Examples:
  nooa doctor
  nooa doctor --json

Exit Codes:
  0: All tools available
  1: One or more tools missing

Error Codes:
  doctor.failed: One or more tools missing
  doctor.runtime_error: Execution failed
```

## Agent Instructions

```xml
<instruction version="1.0.0" name="doctor">
  <purpose>Check environment health</purpose>
  <usage>
    <cli>nooa doctor [flags]</cli>
    <sdk>await doctor.run({ json: true })</sdk>
    <tui>DoctorConsole()</tui>
  </usage>
  <contract>
    <input>
      <field name="json" type="boolean" required="false" />
    </input>

    <output>
      <field name="ok" type="boolean" />
      <field name="traceId" type="string" />
      <field name="tools" type="string" />
      <field name="duration_ms" type="number" />
    </output>
  </contract>
  <exit-codes>
    <code value="0">Success</code>
    <code value="1">Runtime error</code>
  </exit-codes>
  <examples>
    <example>
      <input>nooa doctor</input>
      <output>Environment check</output>
    </example>
    <example>
      <input>nooa doctor --json</input>
      <output>JSON report</output>
    </example>
  </examples>
  <errors>
    <error code="doctor.failed">One or more tools missing.</error>
    <error code="doctor.runtime_error">Execution failed.</error>
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
  const result = await doctor.run({ json: true });
  if (result.ok) console.log(result.data.ok);
```

## Changelog

  1.0.0: Initial release