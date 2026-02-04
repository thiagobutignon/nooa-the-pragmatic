# Implementation Plan - Context-First Orchestrator & Deep Bootstrap

## Goal
Implement a "Context-First" Orchestrator (`nooa act`) that relies on persistent markdown context (`SOUL.md`, `USER.md`, `TOOLS.md`) rather than massive system prompts.
Additionally, enhance `nooa init` to perform a "Deep Bootstrap" interview, capturing user preferences and workflow styles (e.g., TDD vs Prototype, Frontend-First vs Backend-First) to populate these context files.

## User Review Required
> [!IMPORTANT]
> The "Agent Lightning" optimization loop is implemented via `TOOLS.md`. When the agent learns a lesson, it appends it to `TOOLS.md`.
> The "Bootstrap" is now a deep interview that defines the Agent's Persona (`SOUL.md`) and Working Rules (`TOOLS.md`).

## Proposed Changes

### 1. Deep Bootstrap (`src/features/init/`)
- **[MODIFY] `cli.ts`**: Expand interactive mode to ask about:
    - User Role (Developer, Architect, etc.)
    - Working Style (TDD, Prototype-First, etc.)
    - Architecture Preferences (Clean Arch, Vertical Slice, etc.)
- **[MODIFY] `execute.ts`**: Use the interview answers to generate rich `SOUL.md` and `USER.md` from templates, not just defaults.
- **[NEW/MODIFY] Templates**: Update `src/features/init/templates/` to support the new variables.

### 2. Context-First Orchestrator (`src/features/act/`)
- **[MODIFY] `engine.ts`**:
    - **Context Loading**: Read `SOUL.md`, `USER.md`, and `TOOLS.md` at the start of `execute()`.
    - **Prompt Injection**: Inject these contents into the System Prompt.
    - **Learning Loop**: If the agent perceives a "Lesson" (or user corrects it), suggest updating `TOOLS.md` (for now, manual update; future: auto-append).

## Verification Plan

### Manual Verification
1.  **Run Init**: `nooa init` -> Answer "Frontend First", "Thiago".
2.  **Verify Context**: Check if `SOUL.md` mentions "Frontend First" preference.
3.  **Run Act**: `nooa act "Plan a new feature"`
    - Expectation: The plan should prioritize Frontend work based on the context.
