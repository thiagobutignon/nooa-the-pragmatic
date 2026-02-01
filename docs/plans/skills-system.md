# Plan: NOOA Skills System (Architecture & Evolution)

The Skills System allows NOOA to extend its capabilities through specialized instructions and scripts, turning it from a general-purpose agent into a domain expert.

## Goal
Establish a standardized way to define, discover, and invoke "Skills" within NOOA.

### Skill Definition
A Skill is a directory containing:
- `SKILL.md`: Metadata and detailed instructions (The "Brain").
- `scripts/`: Implementation utilities (The "Hands").
- `examples/`: Patterns and expected behaviors.

### Proposed Architecture
1. **Skill Discovery**: Logic to crawl `.agent/skills/` and index available capabilities.
2. **Context Injection**: Ability to dynamically inject skill instructions into the prompt context when relevant.
3. **Execution Layer**: Unified way to run scripts defined within a skill while maintaining NOOA standards (telemetry, JSON stdout, exit codes).

## Roadmap
- [ ] Define the `Skill` interface and schema.
- [ ] Implement `nooa skills list` to show installed capabilities.
- [ ] Implement `nooa skills add <name>` (Scaffold a new skill).
- [ ] Implement Context-Aware skill loading using regex or embeddings.
