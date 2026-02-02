# Skills Management Implementation Plan

## Goal
Implement missing subcommands for `nooa skills` to manage the agent's capabilities.

## User Review Required
- **Subcommand behavior**:
    - `add <name>`: Scaffolds a new skill structure in `.agent/skills/<name>`.
    - `remove <name>`: Deletes a skill directory.
    - `update <name>`: (Placeholder) For now, opens the skill file for editing or reloads metadata.
    - `show <name>`: Displays detailed information (description, instructions) from `SKILL.md`.
    - `enable <name>` / `disable <name>`: Toggles skill availability (via `.disabled` marker file).

## Proposed Changes

### `src/features/skills`

#### [MODIFY] [cli.ts](file:///Users/thiagobutignon/dev/nooa-the-pragmatic/.worktrees/feature/skills-management/src/features/skills/cli.ts)
- Register new subcommands: `add`, `remove`, `update`, `show`, `enable`, `disable`.
- Implement `list` (already exists, maybe enhance).

#### [NEW] [manager.ts](file:///Users/thiagobutignon/dev/nooa-the-pragmatic/.worktrees/feature/skills-management/src/features/skills/manager.ts)
- `SkillManager` class to handle filesystem operations:
    - `createSkill(name: string, description: string)`
    - `deleteSkill(name: string)`
    - `getSkill(name: string)`
    - `toggleSkill(name: string, enabled: boolean)`
    - `listSkills()`

#### [NEW] [templates.ts](file:///Users/thiagobutignon/dev/nooa-the-pragmatic/.worktrees/feature/skills-management/src/features/skills/templates.ts)
- Template for `SKILL.md`.

### `docs/commands`

#### [MODIFY] [skills.md](file:///Users/thiagobutignon/dev/nooa-the-pragmatic/.worktrees/feature/skills-management/docs/commands/skills.md)
- Document new subcommands.

## Verification Plan

### Automated Tests
- Unit tests for `SkillManager` (mocking `fs`).
- Integration tests for CLI commands.

### Manual Verification (Dogfooding)
- `nooa skills add test-skill`
- `nooa skills list` (should show it)
- `nooa skills disable test-skill`
- `nooa skills list` (should show disabled or hide it)
- `nooa skills remove test-skill`
