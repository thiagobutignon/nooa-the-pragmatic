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
| `list` | List available guardrail profiles |
| `show` | Show a normalized guardrail profile |
| `spec validate` | Validate `GUARDRAIL.md` and referenced profiles |
| `spec show` | Show enabled profiles from `GUARDRAIL.md` |
| `spec init` | Create a minimal `GUARDRAIL.md` |
| `add` | Add a new guardrail profile |
| `remove` | Remove a guardrail profile (requires `--force`) |

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

## `nooa guardrail list`

Lists guardrail profiles available in `.nooa/guardrails/profiles`.

### Example

```bash
nooa guardrail list
```

---

## `nooa guardrail show`

Shows a normalized YAML profile for a given name or path.

### Examples

```bash
nooa guardrail show security
nooa guardrail show .nooa/guardrails/profiles/custom.yaml
```

---

## `nooa guardrail spec validate`

Validates `GUARDRAIL.md` and verifies that referenced profiles exist and parse.

### Example

```bash
nooa guardrail spec validate
```

---

## `nooa guardrail spec show`

Shows the enabled profile list from `GUARDRAIL.md`.

### Example

```bash
nooa guardrail spec show
```

---

## `nooa guardrail spec init`

Creates a minimal `GUARDRAIL.md` if it does not exist.

### Example

```bash
nooa guardrail spec init
```

---

## `nooa guardrail add`

Creates a new profile skeleton under `.nooa/guardrails/profiles`.

### Example

```bash
nooa guardrail add my-profile
```

---

## `nooa guardrail remove`

Removes a profile file (requires `--force`).

### Example

```bash
nooa guardrail remove my-profile --force
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

## Enabled Profiles

- zero-preguica
- security

## Exclusions

```
**/vendor/**
```
```
