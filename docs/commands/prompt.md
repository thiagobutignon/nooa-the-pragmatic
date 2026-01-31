# Prompt Command

The `prompt` command manages versioned AI system prompts stored as Markdown files with YAML frontmatter.

## Usage

```bash
nooa prompt <action> [name] [flags]
```

### Actions

- **`list`**: List all available prompts in `src/features/prompt/templates/`.
- **`view <name>`**: Display the metadata and body of a specific prompt.
- **`validate <name|--all>`**: Check if prompt templates are valid. Use `--all` to validate the entire directory.
- **`render <name>`**: Render a prompt template by replacing `{{key}}` placeholders.

## JSON Output

When using `--json`, all actions return a standardized envelope:
- `schemaVersion`: "1.0"
- `ok`: boolean
- `traceId`: string
- `command`: "prompt"

### Flags

- **`--var key=value`**: Specify variables for the `render` action. Can be used multiple times.
- **`--json`**: Output result as machine-readable JSON.
- **`-h, --help`**: Show help message.

## Examples

```bash
nooa prompt list --json
nooa prompt view review
nooa prompt render review --var input="some code" --var repo_root="/path/to/repo"
```

## Prompt Format

Prompts are stored in `src/features/prompt/templates/` as `.md` files. They **must** start with a YAML frontmatter block:

```yaml
---
name: review
version: 1.0.0
description: "AI Reviewer"
output: json
---
# Prompt Body...
```
