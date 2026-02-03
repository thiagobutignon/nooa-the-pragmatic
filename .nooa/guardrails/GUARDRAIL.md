# GUARDRAIL.md - Project Guardrail Specification

> Declarative guardrail rules for code auditing.

## Quick Start

```bash
# Run guardrails defined in this spec
nooa guardrail check --spec

# Run specific profile
nooa guardrail check --profile .nooa/guardrails/profiles/security.yaml
```

## Enabled Profiles

<!-- Profiles to apply when running `nooa guardrail check --spec` -->

- zero-preguica     # No TODOs, FIXMEs, or lazy markers
- security          # Secrets, SQL injection, XSS detection
- dangerous-patterns # console.log, debugger, any type

## Custom Rules

<!-- Project-specific rules -->

```yaml
rules:
  - id: no-deprecated-api
    description: Do not use deprecated API endpoints
    severity: high
    match:
      anyOf:
        - type: literal
          value: "/api/v1/"
    scope:
      include:
        - "src/**/*.ts"
```

## Thresholds

<!-- Fail build if exceeded -->

| Severity | Threshold |
|----------|-----------|
| critical | 0         |
| high     | 0         |
| medium   | 10        |
| low      | 50        |

## Exclusions

<!-- Global exclusions applied to all profiles -->

```
**/*.test.ts
**/*.spec.ts
**/node_modules/**
**/dist/**
**/.git/**
```

## CI Integration

```yaml
# .github/workflows/guardrails.yml
name: Guardrails
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun nooa guardrail check --spec --json > report.json
      - uses: actions/upload-artifact@v4
        with:
          name: guardrail-report
          path: report.json
```
