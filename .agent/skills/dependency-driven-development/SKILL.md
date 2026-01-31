---
name: dependency-driven-development
description: Use when a feature depends on missing primitives (infra, commands, schemas, tooling) or when a roadmap step must be reordered due to a blocking dependency.
---

# Dependency-Driven Development

## Overview
Ship the enablement layer first. If a feature requires a missing primitive, pause the feature and build the prerequisite to unlock it.

**Core principle:** If the dependency doesn’t exist, the feature isn’t ready.

## When to Use
- You discover a **missing primitive** (e.g., embeddings, vector store, auth, telemetry, schema)
- A feature needs **infrastructure, commands, or data** that does not exist yet
- You catch yourself saying “we’ll wire it later” or “stub it for now”
- The plan has **hidden prerequisites** that will block delivery

**Do NOT use when:** The dependency already exists and is stable

## Core Pattern

**Before (bad):**
- Plan feature → realize dependency mid‑implementation → improvise stubs

**After (good):**
- Identify missing primitive → create enablement plan → build primitive → resume feature

## Quick Reference

1) **Name the missing primitive** (exact capability, not vague “infra”)  
2) **Block the feature** until the primitive exists  
3) **Create enablement task/plan** for the primitive  
4) **Reorder roadmap** (dependency first, feature second)  
5) **Resume feature** only after the primitive is validated

## Implementation

**Checklist:**
- Write a short “dependency note” in the plan: *What is missing? Why is it required?*
- Convert the missing primitive into a **separate deliverable** (command, schema, pipeline)
- Run baseline tests for the enablement work before continuing the feature

**Example (NOOA search):**
- Goal: Hybrid search (lexical + embeddings)
- Missing primitive: `nooa embed` command + embedding storage
- Action: Build `nooa embed` first → then implement hybrid ranking

## Common Mistakes
- Proceeding with feature work “in parallel” without the primitive
- Shipping stub behavior that violates “no incomplete code”
- Hiding dependency in TODOs or comments

## Rationalization Trapdoor
| Excuse | Reality |
| --- | --- |
| “We’ll wire embeddings later.” | That’s incomplete code. Build the primitive first. |
| “Stub it so the UI works.” | Stubs are debt; enablement is the fix. |
| “It’s just a small dependency.” | Small dependencies still block delivery. |

## Red Flags — STOP
- “We can fake it for now.”
- “We’ll add the real thing in a follow‑up.”
- “It’s good enough to ship without the core primitive.”

**All of these mean:** stop, build the dependency, then continue.

## Related Terms (for discovery)
Dependency-first, enablement-first, architectural runway, missing primitive, backward chaining.
