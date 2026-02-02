# nooa skills

Manage NOOA's specialized skills. Skills are modular sets of instructions and tools that extend the agent's capabilities.

## Usage

```bash
nooa skills [subcommand] [flags]
```

## Subcommands

- `list`: List all available skills currently installed or available.
- `add <name> [description]`: Create a new skill with boilerplate structure.
- `remove <name>`: Delete an existing skill.
- `show <name>`: Display skill details and content.
- `enable <name>`: Enable a skill.
- `disable <name>`: Disable a skill.
- `update <name>`: (Placeholder) Update a skill.

## Flags

- `-h, --help`: Show the help message.

## How it works

1. **Discovery**: Scans the `.agent/skills` directory for available skill definitions.
2. **Metadata**: Reads the `SKILL.md` frontmatter to display names and descriptions.
3. **Management**: Creates, deletes, and toggles skills by manipulating the filesystem structure in `.agent/skills`.

## Examples

```bash
# List all skills
nooa skills list

# Create a new skill
nooa skills add my-new-skill "A description of what it does"

# Show details
nooa skills show my-new-skill

# Disable a skill temporarily
nooa skills disable my-new-skill

# Remove a skill
nooa skills remove my-new-skill
```
