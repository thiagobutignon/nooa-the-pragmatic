# `nooa goal`

Manage focus and prevent scope creep by setting and tracking a clear project goal.

## Usage

```bash
nooa goal <subcommand> [flags]
```

## Subcommands

### `set <goal>`
Sets the current goal for the project. This overwrites any existing goal.

```bash
nooa goal set "Implement User Authentication"
```

### `status`
Displays the current active goal and when it was set.

```bash
nooa goal status
```

**JSON Output:**
Use `--json` to get a machine-readable output.
```bash
nooa goal status --json
# Output: {"goal": "# Current Goal\n\nImplement User Authentication\n..."}
```

### `clear`
Clears the active goal. Useful when between milestones.

```bash
nooa goal clear
```

## Integration
The current goal is automatically injected into the context of other NOOA AI commands:
- **`nooa fix`**: The AI will ensure that proposed fixes align with the current goal.
- **`nooa review`**: (Coming soon) The AI reviewer will check if the changes serve the current goal.
