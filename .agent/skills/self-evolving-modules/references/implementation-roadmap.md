# NOOA CLI: Implementation Roadmap & Architecture Diagram

**Part 3 of Deep Research Series**  
**Actionable implementation plan with visual architecture**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      NOOA Feature Module                         │
│                    (Self-Describing Command)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Command Definition (Zod Schema as SSOT)                │   │
│  │                                                           │   │
│  │  • name, version, since                                 │   │
│  │  • input schema (Zod)                                   │   │
│  │  • output schema (Zod)                                  │   │
│  │  • error codes (discriminated union)                    │   │
│  │  • examples                                             │   │
│  │  • core run() implementation                            │   │
│  │  • telemetry config                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              │               │               │                  │
│              ▼               ▼               ▼                  │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  CLI Adapter     │  │ SDK Export   │  │ Agent Tool Spec  │  │
│  │  (oclif)         │  │ (TypeScript)  │  │ (JSON Schema)    │  │
│  │                  │  │               │  │                  │  │
│  │ • Flags/args     │  │ • Types       │  │ • Tool name      │  │
│  │ • Help text      │  │ • Functions   │  │ • Input schema   │  │
│  │ • Error format   │  │ • Examples    │  │ • Output schema  │  │
│  │ • Validation     │  │ • Docs        │  │ • Error codes    │  │
│  └──────────────────┘  └──────────────┘  └──────────────────┘  │
│              │               │               │                  │
└──────────────┼───────────────┼───────────────┼──────────────────┘
               │               │               │
       ┌───────▼───┐   ┌───────▼────┐  ┌──────▼───────┐
       │ CLI/TUI   │   │   SDK/Lib  │  │   Agent      │
       │(Terminal) │   │ (TypeScript)│  │ (Claude API) │
       └───────────┘   └────────────┘  └──────────────┘
```

---

## Data Flow: From Schema to All Outputs

```
┌──────────────────────────────────────────────────────────┐
│  Zod Input Schema                                        │
│  • path: string                                          │
│  • encoding: enum                                        │
│  • offset?: number                                       │
└─────────────────────┬──────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
   ┌────────┐   ┌────────┐   ┌──────────┐
   │  Zod   │   │ Help   │   │ JSON     │
   │ Validation  │ Gen    │   │ Schema   │
   └────────┘   └────────┘   └──────────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ Runtime  │  │ CLI help │  │ Agent    │
   │validation│  │ text     │  │ tool def │
   └──────────┘  └──────────┘  └──────────┘
```

---

## Week-by-Week Implementation Plan

### Week 1: Foundation & First Command

**Goal:** One command fully working (CLI + SDK + tests)

**Monday-Tuesday:**
- [ ] Set up TypeScript project
- [ ] Install dependencies (zod, oclif, jest)
- [ ] Create `src/framework/` directory
- [ ] Define command type interfaces
- [ ] Create `defineCommand()` function skeleton

**Wednesday:**
- [ ] Build first command (`read`)
  - [ ] Define Zod schemas (input/output/errors)
  - [ ] Implement `run()` logic
  - [ ] Add 2-3 examples
  - [ ] Add telemetry config

**Thursday:**
- [ ] Create CLI adapter generator
  - [ ] Convert Zod → oclif flags
  - [ ] Generate help text from schema
  - [ ] Wire up error handling

**Friday:**
- [ ] Set up tests
  - [ ] Unit tests for `run()` logic
  - [ ] Snapshot test for help text
  - [ ] Snapshot test for schema
  - [ ] Example validation tests

**Deliverables:**
```
✅ One working command (read)
✅ CLI: `nooa read --help` works
✅ SDK: `import { readAPI } from 'nooa-sdk'`
✅ Tests pass with snapshots
```

---

### Week 2: Scaling to 5+ Commands & Agent Integration

**Goal:** Multiple commands, agent specs, pattern validation

**Monday-Tuesday:**
- [ ] Refactor framework based on week 1 learnings
- [ ] Create `write`, `list`, `delete` commands
- [ ] Extract common patterns into utilities
- [ ] Update documentation

**Wednesday:**
- [ ] Implement agent spec generator
  - [ ] Zod → JSON Schema converter (use `zod-to-json-schema`)
  - [ ] Wrap in Claude tool format
  - [ ] Test with Claude API
  - [ ] Create example agent prompt

**Thursday:**
- [ ] SDK code generation
  - [ ] Auto-generate TypeScript types
  - [ ] Export callable functions
  - [ ] Generate JSDoc from schema descriptions
  - [ ] Test IDE autocomplete

**Friday:**
- [ ] Documentation automation
  - [ ] Generate CLI reference markdown
  - [ ] Generate SDK API docs
  - [ ] Create command index
  - [ ] Generate examples page

**Deliverables:**
```
✅ 5 complete commands
✅ Agent specs exported to agent/specs.ts
✅ SDK exports all commands with proper types
✅ Auto-generated markdown docs
```

---

### Week 3: Drift Prevention & Automation

**Goal:** Zero-drift guarantee via CI/CD

**Monday-Tuesday:**
- [ ] Implement schema linting
  - [ ] Rule: Every command must have description
  - [ ] Rule: Error codes must be enumerated
  - [ ] Rule: Output must be deterministic
  - [ ] Rule: Must have `run()` implementation
  - [ ] Create custom ESLint-style linter

**Wednesday:**
- [ ] Set up snapshot testing
  - [ ] Create `tests/snapshots/` directory
  - [ ] Snapshot each command's help text
  - [ ] Snapshot each command's schema
  - [ ] Snapshot each command's examples
  - [ ] CI fails on snapshot diff

**Thursday:**
- [ ] Breaking change detection
  - [ ] Compare current vs. previous command versions
  - [ ] Detect removed fields, renamed args, error code changes
  - [ ] Flag as requiring major version bump
  - [ ] Require SemVer in commit message

**Friday:**
- [ ] Documentation consistency
  - [ ] Test that help text matches generated output
  - [ ] Test that examples are valid
  - [ ] Test that error codes are documented
  - [ ] Test that all commands are listed in reference

**Deliverables:**
```
✅ Custom command linter (CLI + Node API)
✅ CI/CD checks for all commands
✅ Snapshot tests for 5+ commands
✅ Breaking change detection working
```

---

### Week 4: Versioning & Release Management

**Goal:** Automated, SemVer-compliant releases

**Monday:**
- [ ] Implement per-command versioning
  - [ ] Add `version` field to each command
  - [ ] Add `since` field (first released in which CLI version)
  - [ ] Add `deprecated` field with message
  - [ ] Track in CHANGELOG

**Tuesday:**
- [ ] Set up semantic-release
  - [ ] Configure conventional commits
  - [ ] Set up GitHub Actions for auto-release
  - [ ] Generate changelog from commits
  - [ ] Auto-bump package.json version

**Wednesday:**
- [ ] Deprecation handling
  - [ ] Create deprecated command wrapper
  - [ ] Test that deprecated commands still work
  - [ ] Test that help shows deprecation warning
  - [ ] Create migration guide template

**Thursday:**
- [ ] Release checklist
  - [ ] Verify all tests pass
  - [ ] Check no breaking changes without major bump
  - [ ] Update CHANGELOG manually (if needed)
  - [ ] Tag release with version
  - [ ] Publish to npm

**Friday:**
- [ ] Documentation updates
  - [ ] Add release notes template
  - [ ] Create migration guide for v1.0.0
  - [ ] Document versioning policy
  - [ ] Create "Upgrading NOOA" guide

**Deliverables:**
```
✅ Per-command versioning implemented
✅ Semantic-release configured
✅ GitHub Actions release workflow
✅ CHANGELOG and upgrade guides
```

---

### Week 5-8: Polish & Scale

**Week 5: Error Handling & Telemetry**
- [ ] Comprehensive error handling
  - [ ] Error code registry
  - [ ] Error message templates
  - [ ] Stack trace management
  - [ ] Localization support (i18n)

- [ ] Telemetry system
  - [ ] Track field definitions
  - [ ] Redact sensitive fields
  - [ ] Create telemetry event schema
  - [ ] Test anonymization

**Week 6: Testing Infrastructure**
- [ ] Golden tests for all 20+ commands
- [ ] Contract testing (CLI ↔ SDK ↔ Agent)
- [ ] Integration tests with Claude
- [ ] Performance benchmarks

**Week 7: Documentation Completeness**
- [ ] CLI reference (all commands + examples)
- [ ] SDK guide (getting started + patterns)
- [ ] Agent integration guide (Claude examples)
- [ ] Contributing guide (add new command)
- [ ] Architecture documentation

**Week 8: Production Readiness**
- [ ] Security audit
- [ ] Performance optimization
- [ ] Error recovery mechanisms
- [ ] Rollback procedures
- [ ] Monitoring & alerting

**Final Deliverables:**
```
✅ 100+ commands with full schemas
✅ Zero drift (all tests passing)
✅ Production release (v1.0.0)
✅ Complete documentation
✅ Agent integration working
```

---

## Immediate Action Items (This Week)

### Pick Your Archetype
- [ ] Review the 5 archetypes (from second document)
- [ ] Discussion with team about constraints
- [ ] Decision: **Schema-Driven (Archetype 1) RECOMMENDED**

### Set Up Project
```bash
mkdir nooa-cli
cd nooa-cli
npm init -y
npm install zod oclif
npm install --save-dev typescript jest @types/node ts-node
mkdir -p src/framework src/commands tests/snapshots
```

### Create Framework Skeleton
```typescript
// src/framework/types.ts
import { z } from 'zod';

export interface CommandDefinition<I, O, E> {
  name: string;
  description: string;
  input: z.ZodType<I>;
  output: z.ZodType<O>;
  errors: E;
  run: (input: I) => Promise<O>;
  examples?: Array<{ input: I; output?: O }>;
}

export function defineCommand<I, O, E>(
  def: CommandDefinition<I, O, E>
) {
  return def;
}
```

### Build First Command
```typescript
// src/commands/hello.ts
import { z } from 'zod';
import { defineCommand } from '../framework';

export const helloCommand = defineCommand({
  name: 'hello',
  description: 'Say hello',
  input: z.object({
    name: z.string().describe('Person to greet'),
  }),
  output: z.object({
    message: z.string(),
  }),
  errors: z.discriminatedUnion('code', []),
  run: async (input) => ({
    message: `Hello, ${input.name}!`,
  }),
  examples: [
    { input: { name: 'World' }, output: { message: 'Hello, World!' } },
  ],
});
```

### Run Tests
```bash
npm test
# Should pass: hello command creates output
# Should pass: schema snapshot
```

---

## Success Metrics

### Week 1
- [ ] 1 command fully functional
- [ ] Help text auto-generated (not manual strings)
- [ ] Tests passing
- [ ] No manual documentation (all from schema)

### Week 2
- [ ] 5 commands operational
- [ ] Agent specs exportable to Claude
- [ ] SDK types generated and working
- [ ] Zero type errors in TypeScript

### Week 3
- [ ] All commands pass linting
- [ ] Snapshot tests for all commands
- [ ] Breaking change detection working
- [ ] Zero manual help text strings in codebase

### Week 4
- [ ] Release automation working
- [ ] Semantic versioning enforced
- [ ] Deprecation policy documented
- [ ] Changelog auto-generated

### Week 8
- [ ] 100+ commands
- [ ] Zero drift (all tests green)
- [ ] Production-ready (v1.0.0+)
- [ ] Agent integration tested
- [ ] Documentation complete

---

## File Structure to Start With

```
nooa/
├── src/
│   ├── framework/
│   │   ├── types.ts              # Command definition interfaces
│   │   ├── builder.ts            # Help/spec generators
│   │   ├── validation.ts         # Linting rules
│   │   └── index.ts
│   │
│   ├── commands/
│   │   ├── hello.ts              # First command (Week 1)
│   │   ├── read.ts               # File operations (Week 2)
│   │   ├── write.ts
│   │   ├── list.ts
│   │   └── index.ts
│   │
│   ├── cli/
│   │   └── index.ts              # oclif CLI setup
│   │
│   ├── sdk/
│   │   └── index.ts              # Export for SDK users
│   │
│   └── index.ts
│
├── tests/
│   ├── commands/
│   │   ├── hello.test.ts
│   │   └── read.test.ts
│   │
│   └── snapshots/
│       ├── hello.help.txt
│       ├── hello.schema.json
│       └── ...
│
├── docs/
│   ├── CLI.md                    # Generated
│   ├── SDK.md                    # Generated
│   └── ARCHITECTURE.md
│
├── .github/
│   └── workflows/
│       ├── test.yml
│       └── release.yml
│
└── package.json
```

---

## References & Next Steps

**Main Document:**
- Read: `self-evolving-cli-modules.md` (sections 1-11)

**Implementation Guide:**
- Read: `implementation-archetypes.md` (all 5 patterns)

**This Roadmap:**
- Follow week-by-week plan above

**External Resources:**
- Zod docs: https://zod.dev
- oclif docs: https://oclif.io
- Semantic Versioning: https://semver.org
- Claude API: https://anthropic.com

---

**Ready to start?** Begin Week 1 on Monday. Pick Archetype 1 (Schema-Driven). Build one command end-to-end. Share results with team. Iterate.
