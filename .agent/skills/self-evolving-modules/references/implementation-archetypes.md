# Implementation Archetypes for Self-Evolving CLI Modules

**Companion Document to:** Self-Describing & Self-Evolving CLI Modules: Deep Research Report  
**Focus:** 3-5 concrete implementation patterns with code examples

---

## Archetype 1: Schema-Driven (Recommended for NOOA)

### Philosophy
Single Zod schema → Help text + SDK + Agent spec + Tests

### Code Structure

```typescript
// commands/read.ts - Everything in one place

import { z } from 'zod';
import { defineCommand } from '../framework';

export const readCommand = defineCommand({
  // Identity
  name: 'read',
  version: '1.0.0',
  
  // Input contract
  input: z.object({
    path: z.string().describe('File path'),
    encoding: z.enum(['utf-8', 'ascii']).default('utf-8'),
  }),
  
  // Output contract
  output: z.object({
    content: z.string(),
    size: z.number(),
  }),
  
  // Error contract (discriminated union for type safety)
  errors: z.discriminatedUnion('code', [
    z.object({ code: z.literal('FILE_NOT_FOUND'), path: z.string() }),
    z.object({ code: z.literal('PERMISSION_DENIED'), path: z.string() }),
  ]),
  
  // Core logic (testable, reusable)
  run: async (input) => {
    const fs = await import('fs/promises');
    try {
      const content = await fs.readFile(input.path, input.encoding);
      return { content, size: Buffer.byteLength(content) };
    } catch (err) {
      if ((err as any).code === 'ENOENT') {
        throw { code: 'FILE_NOT_FOUND', path: input.path };
      }
      throw { code: 'PERMISSION_DENIED', path: input.path };
    }
  },
  
  // Examples (used in docs + help)
  examples: [
    {
      description: 'Read a config file',
      input: { path: 'config.json' },
      output: { content: '{"key":"value"}', size: 16 },
    },
  ],
});

// Auto-generated (from framework):
// - readCommand.toCliCommand()  → oclif Command
// - readCommand.toAgentSpec()   → Claude tool spec
// - readCommand.getHelp()       → Help text
// - readCommand.toSdk()         → Callable SDK function
```

### Advantages
✅ Everything in one file  
✅ Schema is the source of truth  
✅ Type-safe at compile time + runtime  
✅ Trivial to generate help/docs/specs  
✅ Examples are part of the contract  

### Disadvantages
❌ Requires custom framework (though minimal)  
❌ Zod learning curve  

### Best For
- New CLI projects
- Agent-first use cases
- Rapid iteration

---

## Archetype 2: Builder DSL (Fluent API)

### Philosophy
Chainable method calls for expressive, testable command definitions

### Code Structure

```typescript
// commands/read.ts

import { z } from 'zod';
import { CommandBuilder } from '../framework';

export const readCommand = new CommandBuilder()
  .name('read')
  .version('1.0.0')
  .description('Read a file from disk')
  
  .inputField('path', z.string(), {
    description: 'File path to read',
    required: true,
  })
  .inputField('encoding', z.enum(['utf-8', 'ascii']), {
    description: 'File encoding',
    default: 'utf-8',
  })
  
  .outputField('content', z.string(), { description: 'File contents' })
  .outputField('size', z.number(), { description: 'File size in bytes' })
  
  .error('FILE_NOT_FOUND', z.object({ path: z.string() }))
  .error('PERMISSION_DENIED', z.object({ path: z.string() }))
  
  .example('Read a file', { path: 'config.json' }, { content: '...', size: 42 })
  
  .implement(async (input) => {
    // implementation
  })
  
  .onSuccess((output) => {
    console.log(`✓ Read ${output.size} bytes`);
  })
  
  .onError((error) => {
    if (error.code === 'FILE_NOT_FOUND') {
      console.error(`File not found: ${error.path}`);
    }
  })
  
  .build();

// Result is same as Archetype 1, but more readable for complex commands
```

### Advantages
✅ Very readable and fluent  
✅ Discoverability via IDE autocomplete  
✅ Good for complex commands  
✅ Can incrementally build up  

### Disadvantages
❌ More boilerplate than Archetype 1  
❌ Harder to share across commands  

### Best For
- Complex commands with many fields
- Teams that prefer builder pattern
- Incremental refactoring of existing CLIs

---

## Archetype 3: Decorator-Based (Metadata Annotations)

### Philosophy
TypeScript decorators + class-based approach (similar to NestJS)

### Code Structure

```typescript
// commands/read.ts

import { z } from 'zod';
import { Command, Input, Output, Error, Example } from '../framework';

@Command({
  name: 'read',
  version: '1.0.0',
  description: 'Read a file from disk',
})
export class ReadCommand {
  @Input()
  path: string;  // Auto-inferred type from TypeScript
  
  @Input({ optional: true })
  encoding: 'utf-8' | 'ascii' = 'utf-8';
  
  @Output()
  content: string;
  
  @Output()
  size: number;
  
  @Error({ code: 'FILE_NOT_FOUND' })
  fileNotFound(path: string) {}
  
  @Error({ code: 'PERMISSION_DENIED' })
  permissionDenied(path: string) {}
  
  @Example('Read a file')
  exampleBasic = { path: 'config.json' };
  
  async run(): Promise<{ content: string; size: number }> {
    const fs = await import('fs/promises');
    const content = await fs.readFile(this.path, this.encoding);
    return { content, size: Buffer.byteLength(content) };
  }
}

export const readCommand = new ReadCommand();
```

### How It Works
- Framework scans decorators at runtime
- Builds schema from TypeScript types + decorator metadata
- Generates CLI, SDK, agent specs

### Advantages
✅ Minimal boilerplate  
✅ TypeScript types are the source of truth  
✅ Class-based OOP feel  
✅ Familiar to NestJS/Angular users  

### Disadvantages
❌ Requires TypeScript decorators (stage 3 proposal)  
❌ Runtime reflection overhead  
❌ Harder to validate schemas at build time  

### Best For
- Teams using NestJS
- Projects that already use decorators
- Enterprise environments

---

## Archetype 4: JSON/YAML Configuration (External Specification)

### Philosophy
Commands defined externally (JSON/YAML), implementation linked separately

### Code Structure

```yaml
# commands/read.yaml

name: read
version: 1.0.0
description: Read a file from disk

input:
  path:
    type: string
    description: File path to read
    required: true
  encoding:
    type: string
    enum: [utf-8, ascii]
    default: utf-8
    description: File encoding

output:
  content:
    type: string
    description: File contents
  size:
    type: integer
    description: File size in bytes

errors:
  FILE_NOT_FOUND:
    path: string
  PERMISSION_DENIED:
    path: string

examples:
  - description: Read a config file
    input: { path: config.json }
    output: { content: '{"k":"v"}', size: 16 }

implementation: './implementations/read.ts'
telemetry:
  track: [encoding, size]
  redact: [path, content]
```

```typescript
// implementations/read.ts

export async function read(input: any) {
  const fs = await import('fs/promises');
  const content = await fs.readFile(input.path, input.encoding);
  return { content, size: Buffer.byteLength(content) };
}
```

### Advantages
✅ Schema is completely separate from code  
✅ Non-developers can edit specs  
✅ Multi-language implementations  
✅ Language-agnostic (same spec → Python/Go/Node implementations)  

### Disadvantages
❌ Type safety harder (two sources of truth)  
❌ More files to maintain  
❌ Build step required to validate  

### Best For
- Multi-language CLIs (spec in YAML, impls in multiple langs)
- External spec requirement (API contracts)
- Teams with spec-first discipline

---

## Archetype 5: gRPC/Protobuf-Inspired (Multi-Language)

### Philosophy
Single `.proto` file generates CLI, SDK, docs for Python/Go/Node/Rust

### Code Structure

```protobuf
// commands/read.proto

syntax = "proto3";

package nooa.commands;

message ReadRequest {
  string path = 1;  // File path to read
  string encoding = 2;  // Encoding: utf-8, ascii
}

message ReadResponse {
  string content = 1;  // File contents
  int32 size = 2;  // File size in bytes
}

message FileNotFoundError {
  string path = 1;
}

message PermissionDeniedError {
  string path = 1;
}

message ReadError {
  oneof error {
    FileNotFoundError not_found = 1;
    PermissionDeniedError permission = 2;
  }
}

service ReadCommand {
  rpc Execute(ReadRequest) returns (ReadResponse);
}
```

### Build Step
```bash
# Generate TypeScript types
protoc --ts_out=. commands/read.proto

# Generate Go stubs
protoc --go_out=. commands/read.proto

# Generate Python types
protoc --python_out=. commands/read.proto
```

### TypeScript Implementation
```typescript
// Generated by protoc
import { ReadRequest, ReadResponse, ReadCommand } from './read_pb';

export const readCommand = new ReadCommand({
  async execute(request: ReadRequest): Promise<ReadResponse> {
    // implementation
  },
});
```

### Advantages
✅ Multi-language support built-in  
✅ Proven tooling (protoc, gRPC)  
✅ Excellent version compatibility  
✅ Large ecosystem  

### Disadvantages
❌ Overkill for single-language CLI  
❌ Learning curve (protobuf syntax)  
❌ Adds build complexity  
❌ Less web-friendly (gRPC focus)  

### Best For
- Multi-language CLI frameworks
- Microservices that expose CLI + gRPC
- Enterprise organizations with protobuf experience

---

## Quick Comparison Table

| Archetype | Setup | Type Safety | Scalability | Multi-Language | Agent-Friendly | Learn Curve |
|-----------|-------|------------|-------------|-----------------|---|---|
| **Schema-Driven (Zod)** | 1 file | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | Medium |
| **Builder DSL** | 1 file | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | Medium |
| **Decorators** | 1 file | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐ | Medium |
| **JSON/YAML Config** | 2 files | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Low |
| **Protobuf** | 2+ files | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | High |

---

## Practical Actionable Checklist

### Week 1: Foundation

**Day 1-2: Choose Your Archetype**
- [ ] Review all 5 archetypes with your team
- [ ] List requirements (multi-lang? agent-first? team expertise?)
- [ ] Pick **one** (recommendation: Schema-Driven for NOOA)

**Day 3-4: Build Core Framework**
- [ ] Create `src/framework/types.ts` with base types
- [ ] Implement `defineCommand()` or equivalent
- [ ] Create minimal TypeScript definitions

**Day 5: First Command**
- [ ] Write `read` command using your chosen archetype
- [ ] Implement core `run()` logic
- [ ] Add input validation
- [ ] Add 2-3 examples

**Final: Testing**
- [ ] Unit test core logic
- [ ] Snapshot test generated help text
- [ ] Snapshot test generated schema
- [ ] Document what you learned

### Week 2: Scaling

**Day 1-2: CLI Integration**
- [ ] Connect to oclif (or your CLI framework)
- [ ] Generate oclif Command from definition
- [ ] Test CLI help output
- [ ] Test flag/arg parsing

**Day 3: Agent Integration**
- [ ] Generate Claude tool spec
- [ ] Test with Claude API
- [ ] Document agent usage

**Day 4: SDK**
- [ ] Generate TypeScript SDK types
- [ ] Export callable functions
- [ ] Test SDK against real implementation

**Day 5: Docs**
- [ ] Auto-generate CLI help from schema
- [ ] Auto-generate markdown docs
- [ ] Test docs match actual behavior

### Week 3: Validation & Tooling

**Day 1-2: Drift Prevention**
- [ ] Set up snapshot tests for all commands
- [ ] Create schema linting rules (custom ESLint)
- [ ] Add CI checks for breaking changes

**Day 3: Versioning**
- [ ] Implement per-command versioning
- [ ] Set up semantic versioning (npm)
- [ ] Document deprecation policy

**Day 4: Error Handling**
- [ ] Define error code enums
- [ ] Implement error serialization
- [ ] Add telemetry hooks

**Day 5: Documentation**
- [ ] Write command reference
- [ ] Document SDK usage
- [ ] Create agent examples

---

## Getting Started: Your First Command (Schema-Driven)

### Step 1: Create the Definition

```typescript
// src/commands/read.ts

import { z } from 'zod';
import { defineCommand } from '../framework';

export const readCommand = defineCommand({
  name: 'read',
  description: 'Read a file',
  
  input: z.object({
    path: z.string().describe('File path'),
  }),
  
  output: z.object({
    content: z.string(),
  }),
  
  errors: z.discriminatedUnion('code', [
    z.object({ code: z.literal('NOT_FOUND'), path: z.string() }),
  ]),
  
  run: async (input) => {
    const fs = await import('fs/promises');
    const content = await fs.readFile(input.path, 'utf-8');
    return { content };
  },
  
  examples: [
    { input: { path: 'package.json' }, output: { content: '...' } },
  ],
});
```

### Step 2: Test It

```typescript
// tests/read.test.ts

import { readCommand } from '../commands/read';

test('read command works', async () => {
  const result = await readCommand.run({ path: 'package.json' });
  expect(result.content).toBeDefined();
});

test('help matches snapshot', () => {
  const help = readCommand.getHelp();
  expect(help).toMatchSnapshot();
});

test('schema matches snapshot', () => {
  const schema = readCommand.input.toJSON();
  expect(schema).toMatchSnapshot();
});
```

### Step 3: Use It

```typescript
// In CLI
const cli = readCommand.toCLI();
// Now it's an oclif Command

// In SDK
const api = readCommand.toAPI();
await api({ path: 'config.json' });

// For agents
const spec = readCommand.toAgentSpec();
// Pass to Claude as a tool
```

**That's it!** One definition, three use cases.

---

## Summary

Choose based on your priorities:

1. **New NOOA project?** → **Schema-Driven (Archetype 1)**
2. **Complex commands?** → **Builder DSL (Archetype 2)**
3. **Multi-language CLI?** → **Protobuf (Archetype 5)**
4. **External specs needed?** → **JSON/YAML (Archetype 4)**
5. **NestJS shop?** → **Decorators (Archetype 3)**

Start with one command. Get feedback. Generalize to 100+ commands.
