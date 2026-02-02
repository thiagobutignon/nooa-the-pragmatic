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
- **`create <name>`**: Create a new prompt template with frontmatter and body content.
- **`edit <name>`**: Apply a unified diff patch to a prompt (expects patch via stdin with `--patch`).
- **`delete <name>`**: Remove a prompt template file.
- **`publish <name>`**: Bump the prompt version and update the changelog.

## JSON Output

When using `--json`, all actions return a standardized envelope:
- `schemaVersion`: "1.0"
- `ok`: boolean
- `traceId`: string
- `command`: "prompt"

### Flags

- **`--var key=value`**: Specify variables for the `render` action. Can be used multiple times.
- **`--body <text>`**: Provide body content for `create` (or via stdin).
- **`--description <text>`**: Required description for `create`.
- **`--output <json|markdown>`**: Output format stored in frontmatter for `create`.
- **`--patch`**: Read unified diff patch from stdin for `edit`.
- **`--level <patch|minor|major>`**: Version bump level for `publish`.
- **`--note <text>`**: Changelog note for `publish` (or via stdin).
- **`--json`**: Output result as machine-readable JSON.
- **`-h, --help`**: Show help message.

## Examples

```bash
nooa prompt list --json
nooa prompt view review
nooa prompt render review --var input="some code" --var repo_root="/path/to/repo"
nooa prompt create my-prompt --description "My Prompt" --body "Hello"
nooa prompt edit my-prompt --patch < patch.diff
nooa prompt publish my-prompt --level patch --note "Refined instructions"
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

## Changelog

Publishing a prompt updates `src/features/prompt/CHANGELOG.md` with entries per version. Previous versions are preserved in the prompt's changelog section.
