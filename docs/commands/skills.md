# nooa skills

Manage NOOA's specialized skills. Skills are modular sets of instructions and tools that extend the agent's capabilities.

## Usage

```bash
nooa skills [subcommand] [flags]
```

## Subcommands

- `list`: List all available skills currently installed or available.

## Flags

- `-h, --help`: Show the help message.

## How it works

1. **Discovery**: Scans the `.agent/skills` directory for available skill definitions.
2. **Metadata**: Reads the `SKILL.md` frontmatter to display names and descriptions.

## Examples

```bash
# List all skills
nooa skills list
```
