---
name: ai-assisted-development-workflow
description: Use when starting, adapting, or reviewing feature, refactor, or bug-fix work in this repository and you need the canonical local workflow from bootstrap through verification.
---

# AI-Assisted Development Workflow

## Overview

This skill is the local entry point for NOOA's canonical AI-assisted development process.

Use it when you need the project's full workflow, not just one isolated tactic. The authoritative long-form reference is:

- `docs/reference/ai-assisted-development-workflow.md`

This repository treats `.agent/skills/` as the source of truth. Prefer local skills over global/personal skill registries.

## When to Use

Use this skill when:

- starting a new feature and you need the full process
- adapting a generic AI workflow to NOOA
- reviewing whether a task followed the repository's intended phases
- deciding which local skills should compose for a task
- documenting or improving the repository's development process

Do not use this skill as a substitute for the phase-specific skills. Use it to choose and sequence them correctly.

## Core Composition

Typical pairings:

- `using-superpowers` for skill-first bootstrapping
- `brainstorming` before creating or changing behavior
- `writing-plans` for multi-step execution
- `using-git-worktrees` for isolated work
- `test-driven-development` for red-green discipline
- `systematic-debugging` for bugs and failing tests
- `agent-cli-first` and `dogfooding` for runnable proof
- `self-evolving-modules` for NOOA command work
- `verification-before-completion` before any success claim

## Local Rules

1. Start from workspace context and local skills.
2. Prefer direct execution over theoretical correctness.
3. Prefer repository commands and Bun checks over generic advice.
4. Treat old `superpowers:*` references as historical labels when a local skill exists with the same intent.

## Reference

Read:

- `docs/reference/ai-assisted-development-workflow.md`

That document explains:

- the phase model
- feature and bug-fix flows
- worktree usage
- TDD expectations
- CLI-first verification
- review and post-mortem rules
- how the workflow maps to local NOOA skills
