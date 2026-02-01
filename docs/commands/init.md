# nooa init

Bootstrap the Agentic Soul in your project. It initializes the repository with the necessary configurations, templates, and the Project Constitution.

## Usage

```bash
nooa init [flags]
```

## Flags

- `--name <name>`: Desired name for your agent.
- `--force`: Overwrite existing `.nooa/` directory.
- `-h, --help`: Show help message.

## What it creates

- `.nooa/CONSTITUTION.md`: Core principles.
- `.nooa/POLICY.md`: Governance rules.
- `.nooa/IDENTITY.md`: Agent self-description.
- `nooa.db`: Main SQLite database for memory and state.

## Examples

```bash
nooa init --name "Neo-Agent"
```
