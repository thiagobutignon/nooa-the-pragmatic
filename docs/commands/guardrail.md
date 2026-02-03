# nooa guardrail

Code auditing based on declarative profiles (YAML).

The `guardrail` command allows you to define compliance, security, and quality rules that the code must follow. It supports regex and literal matching patterns with scope filtering (globs).

## Usage

```bash
nooa guardrail <subcommand> [options]
```

### Subcommands

| Command | Description |
|---------|-----------|
| `check` | Audit code against guardrail profiles |
| `validate` | Validate a YAML profile schema |
| `init` | Initialize the `.nooa/guardrails` directory |

---

## `nooa guardrail check`

Runs the audit in the current directory.

### Options

- `--profile, -p <path>`: Path to a specific YAML profile.
- `--spec`: Use the `GUARDRAIL.md` file to combine multiple profiles.
- `--watch, -w`: Continuous mode (re-runs on file changes).
- `--json`: Structured JSON output.
- `--deterministic`: Ensures byte-identical output (default with `--json`).

### Examples

```bash
# Run guardrails defined in GUARDRAIL.md
nooa guardrail check --spec

# Run a specific profile
nooa guardrail check --profile .nooa/guardrails/profiles/security.yaml

# Continuous mode saving to JSON
nooa guardrail check --spec --watch --json > report.json
```

---

## `nooa guardrail validate`

Checks if a profile file is syntactically correct.

### Options

- `--profile, -p <path>`: Path to the profile to validate (required).

### Example

```bash
nooa guardrail validate --profile custom-rules.yaml
```

---

## Profile Structure (YAML)

A profile (`.yaml`) defines a list of rules:

```yaml
refactor_name: security
description: Security rules
rules:
  - id: no-eval
    description: Usage of eval() is forbidden
    severity: high
    match:
      anyOf:
        - type: regex
          value: "\\beval\\s*\\("
    scope:
      exclude:
        - "**/*.test.ts"
```

## GUARDRAIL.md (Spec)

The `GUARDRAIL.md` file at the project root allows automating the execution of multiple profiles:

```markdown
# GUARDRAIL.md

## Profiles
- [security](file://./.nooa/guardrails/profiles/security.yaml)
- [zero-preguica](file://./.nooa/guardrails/profiles/zero-preguica.yaml)

## Exclusions
- "**/vendor/**"
```
