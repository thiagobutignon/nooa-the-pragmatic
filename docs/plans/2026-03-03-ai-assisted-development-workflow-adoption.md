# AI-Assisted Development Workflow Adoption Plan

> **For agents in this repo:** use local skills from `.agent/skills/`, not global skill registries, when following or extending this plan.

**Goal:** Establish a project-local, verbose, canonical workflow for AI-assisted development in NOOA that matches the repository's actual commands, guardrails, and skill system.

**Architecture:** The workflow will live in two layers. `docs/reference/ai-assisted-development-workflow.md` will be the long-form explanation and policy reference. `.agent/skills/ai-assisted-development-workflow/SKILL.md` will be the lightweight entry point that tells future agents when to load the workflow and which local skills to compose with it.

**Tech Stack:** Markdown documentation, local `.agent/skills`, Bun-based verification, git worktrees, existing NOOA CLI conventions.

---

### Task 1: Create the canonical reference document

**Files:**
- Create: `docs/reference/ai-assisted-development-workflow.md`

**Step 1: Write the workflow as a project-local reference**

Include:
- bootstrap through code review and post-mortem
- feature and bug-fix flows
- mapping from generic workflow phases to local skills
- project-specific verification commands (`bun test`, `bun run check`, direct CLI execution)
- explicit explanation of how and why the flow works

**Step 2: Preserve the strategic content but adapt wording to NOOA**

Replace:
- global skill references with local `.agent/skills/*`
- generic worktree examples with `.worktrees/` and repo conventions
- generic verification language with Bun and NOOA CLI examples

**Step 3: Keep the document verbose and operational**

The document should be readable as both:
- a policy reference
- a practical operating manual for future sessions

### Task 2: Create a local workflow skill

**Files:**
- Create: `.agent/skills/ai-assisted-development-workflow/SKILL.md`

**Step 1: Add a discovery-friendly description**

The skill must explain when to use this workflow without summarizing the full process in the frontmatter description.

**Step 2: Keep the skill lightweight**

Point to the canonical reference document and list the local skills that usually compose with it:
- `brainstorming`
- `writing-plans`
- `test-driven-development`
- `using-git-worktrees`
- `systematic-debugging`
- `dogfooding`
- `verification-before-completion`
- `writing-skills`

### Task 3: Update workspace guardrails

**Files:**
- Modify: `AGENTS.md`

**Step 1: Make local skills authoritative**

Add an explicit rule:
- `.agent/skills` is the source of truth in this repository
- local skills override global/personal skills when both exist
- global skills are fallback only when no project-local equivalent exists

**Step 2: Explain why**

State that project-local skills encode repository reality, commands, conventions, and lessons learned, which makes them safer than generic/global guidance.

### Task 4: Verify the documentation changes

**Files:**
- Verify: `docs/reference/ai-assisted-development-workflow.md`
- Verify: `.agent/skills/ai-assisted-development-workflow/SKILL.md`
- Verify: `AGENTS.md`

**Step 1: Inspect final diffs**

Run:

```bash
git diff -- docs/reference/ai-assisted-development-workflow.md .agent/skills/ai-assisted-development-workflow/SKILL.md AGENTS.md docs/plans/2026-03-03-ai-assisted-development-workflow-adoption.md
```

Expected:
- the workflow is now documented locally
- the skill references the local document
- `AGENTS.md` clearly prioritizes local skills

**Step 2: Sanity-check formatting**

Run:

```bash
sed -n '1,220p' docs/reference/ai-assisted-development-workflow.md
sed -n '1,220p' .agent/skills/ai-assisted-development-workflow/SKILL.md
sed -n '1,220p' AGENTS.md
```

Expected:
- headings render correctly
- frontmatter is valid
- the new guidance is explicit and unambiguous
