# GUARDRAIL.md - Project Guardrail Specification

> Declarative guardrail rules for code auditing.

## Quick Start

```bash
# Run guardrails defined in this spec
nooa guardrail check --spec

# Run specific profile
nooa guardrail check --profile .nooa/guardrails/profiles/security.yaml
```

## Profiles

Selected profiles to be enforced in this project:

- [zero-preguica](file://./profiles/zero-preguica.yaml) - Hygiene (TODO, FIXME, MOCK)
- [security](file://./profiles/security.yaml) - Secrets and SQL injection risk
- [dangerous-patterns](file://./profiles/dangerous-patterns.yaml) - console.log, eval, any type
- [anarchy-baseline](file://./profiles/anarchy-baseline.yaml) - Adversarial patterns from project_anarchy

## Thresholds

Maximum violations allowed before failing:

| Category | Max Violations |
|----------|----------------|
| security | 0              |
| quality  | 5              |
| hygiene  | 10             |

## Exclusions

Global exclusions for this spec:

- "**/vendor/**"
- "**/node_modules/**"
- "**/dist/**"
- "**/docs/**"
- "**/.agent/**"
- "**/.nooa/guardrails/**"

## Custom Rules

Add project-specific rules here:

```yaml
- id: no-local-hardcoded-ip
  description: Avoid hardcoding local IP addresses
  severity: medium
  match:
    anyOf:
      - type: regex
        value: "127\\.0\\.0\\.1"
```
