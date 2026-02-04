# Self-Describing & Self-Evolving CLI Modules: Deep Research Report

**Prepared for:** NOOA CLI (Agent-First Architecture)  
**Date:** February 2026  
**Status:** Comprehensive Research with Actionable Patterns

---

## Executive Summary

A **self-describing module** is a feature module that contains its complete specification (input schema, output fields, errors, help text, versioning, telemetry hooks) in a single, machine-readable source of truth. This enables automatic generation of:
- Interactive help & documentation
- SDK/library bindings
- Agent tool specifications (for Claude, GPT-4, etc.)
- CLI/TUI adapters
- Error catalogs & telemetry schemas

The core principle: **Define once, generate many.** This eliminates drift between documentation, code, and agent capabilities.

---

## 1. Terminology & Industry Patterns

### 1.1 What This Is Called

| Term | Source | Meaning |
|------|--------|---------|
| **Single Source of Truth (SSOT)** | Enterprise Architecture | One authoritative location for data; all consumers read/reference it [web:3][web:6][web:12] |
| **Self-Describing Module** | CTK (Common Toolkit) | A CLI module that outputs its own specification (XML/JSON) alongside execution [web:1] |
| **Contract-First API** | REST/gRPC community | Design the specification first, generate code/docs/clients from it [web:9][web:37][web:40] |
| **Specification-First** | Red Hat Enterprise Arch. | "All work emanates from an ever-evolving but controlled specification" [web:9] |
| **Capability Manifest** | LLM/Agent tooling | JSON schema describing what a tool can do (function name, inputs, outputs, errors) [web:33][web:36] |
| **Living Documentation** | Literate Programming | Executable code blocks within documentation; docs & code stay in sync [web:61][web:63] |
| **Self-Documenting Command Spec** | CLI best practices | Help text, examples, flags all derived from a single schema definition [web:4][web:19] |

**No single "correct" term exists.** Use **"feature module SSOT"** or **"executable command spec"** for clarity.

---

## 2. Analogous Patterns in Mature Ecosystems

### 2.1 OpenAPI / Swagger (REST APIs)

**Pattern:**
```yaml
openapi: 3.0.0
paths:
  /users/{id}:
    get:
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        200:
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
```

**What It Generates:**
- TypeScript types (via `openapi-typescript` or `openapi-generator`) [web:31][web:34]
- Server stubs (code generation)
- Client SDKs
- Interactive documentation (Swagger UI)
- Validation middleware

**For NOOA:** OpenAPI is overkill for CLI, but the **architecture principle** is sound: single spec → many artifacts.

**Sources:**
- Red Hat SSOT guide: https://www.redhat.com/en/blog/single-source-truth-architecture [web:9]
- Contract-first boilerplate: https://github.com/xutyxd/ts-openapi-contract-first-boilerplate [web:31]

---

### 2.2 gRPC / Protobuf (RPC & Microservices)

**Pattern:**
```protobuf
service UserService {
  rpc GetUser(GetUserRequest) returns (User);
}

message GetUserRequest {
  string user_id = 1;
}

message User {
  string id = 1;
  string name = 2;
  string email = 3;
}
```

**What It Generates:**
- Server interface stubs
- Client code (Go, Python, TypeScript, etc.)
- Type definitions
- Marshaling/unmarshaling logic
- `.proto` files as canonical definition

**Why It Works:**
- IDL (Interface Definition Language) is language-agnostic
- Compiler enforces schema consistency
- Breaking changes are explicit (e.g., required field removal)
- Multiple language ecosystems can interoperate

**For NOOA:** Adopt the **schema-first mindset**, even if you don't use protobuf. The schema is your source of truth.

---

### 2.3 JSON Schema + TypeScript Runtime Validators (Zod, io-ts)

**Pattern:**
```typescript
import { z } from 'zod';

// Single schema definition
const ReadCommandInputSchema = z.object({
  path: z.string().describe('File path to read'),
  encoding: z.enum(['utf-8', 'ascii']).default('utf-8'),
  offset: z.number().optional(),
});

// Automatically infer TypeScript type
type ReadCommandInput = z.infer<typeof ReadCommandInputSchema>;

// Runtime validation
const result = ReadCommandInputSchema.safeParse(userInput);
```

**What This Achieves:**
- One definition → TypeScript type + runtime validation [web:32][web:38]
- Compile-time type safety + runtime certainty
- Can generate JSON Schema for docs/agents [web:41]
- Automatic type inference (no manual duplication)

**Why It's Better Than io-ts:**
- Zod has a more intuitive API (fluent, readable)
- Better error messages
- Smaller bundle size
- Widely adopted (as of 2024/2025) [web:32][web:35]

**For NOOA:** Zod is a perfect fit for input validation + schema generation.

**Sources:**
- Zod: https://zod.dev [web:32][web:38]
- io-ts legacy article: https://kieran.casa/io-ts/ [web:35]

---

## 3. CLI Framework Comparison

### 3.1 oclif (Node.js / TypeScript)

**Strengths:**
- TypeScript-first [web:19]
- Plugin architecture (users can extend CLI at runtime)
- Built-in help generation
- Flag/argument parsing
- Hooks (pre/post command execution)
- ESM & CommonJS support

**What It Provides:**
- Command scaffolding (`oclif generate command`)
- Automatic help text from JSDoc comments
- Plugin system for extensibility
- Minimal dependencies
- Used by Heroku CLI, Salesforce CLI, others

**Limitations:**
- Help text is generated from JSDoc, not from a schema
- No built-in schema validation (you add your own)
- No automatic SDK generation

**For NOOA:** Use oclif as the CLI framework, wrap commands with a **schema layer** on top (Zod).

**Sources:**
- oclif intro: https://oclif.io/docs/introduction/ [web:19]
- oclif generators: https://oclif.github.io/docs/generator_commands/ [web:16]
- Tutorial: https://www.joshcanhelp.com/oclif/ [web:8]

---

### 3.2 Cobra (Go)

**Strengths:**
- Hierarchical command structure (natural tree of commands)
- Persistent flags (inherited by subcommands)
- Auto-generated help for subcommands
- Shell completion (bash, zsh, fish)
- Used by kubectl, Docker, Hugo, GitHub CLI

**Command Model:**
```go
var addCmd = &cobra.Command{
  Use:   "add [arg]",
  Short: "Add two numbers",
  Long:  "...",
  Run:   func(cmd *cobra.Command, args []string) {
    // implementation
  },
}
```

**What It Provides:**
- Clear command tree
- Automatic help + version flags
- Error handling patterns
- Completion generation

**Limitations:**
- Schema-agnostic (you manage your own input parsing)
- Help text is manual strings
- No automatic doc generation

**For Reference:** Cobra's **command tree** model is worth emulating. Structure NOOA commands hierarchically:
```
nooa
├── read       (input: path, encoding, offset)
├── write      (input: path, content, overwrite)
└── admin
    ├── config
    └── logs
```

**Sources:**
- Cobra docs: https://cobra.dev/docs/how-to-guides/working-with-commands/ [web:27]
- Detailed guide: https://www.oreateai.com/blog/a-detailed-explanation-of-the-cobra-framework-for-go-language-command-line-development/ [web:24]

---

### 3.3 Clap (Rust)

**Strengths:**
- Derive macro for zero-cost abstraction
- Automatic help generation from `#[command]` attributes
- Subcommands & groups
- Shell completion generation
- Used in high-performance tools (ripgrep, starship, bat)

**Pattern:**
```rust
#[derive(Parser)]
#[command(name = "read", about = "Read a file")]
struct ReadCmd {
  /// File path
  path: String,
  
  /// Encoding (utf-8 or ascii)
  #[arg(short, long, default_value = "utf-8")]
  encoding: String,
}
```

**Help Auto-Generated:**
```
$ read --help
Read a file

USAGE:
    read [OPTIONS] <PATH>

ARGUMENTS:
    <PATH>    File path

OPTIONS:
    -e, --encoding <ENCODING>    Encoding (utf-8 or ascii) [default: utf-8]
    -h, --help                   Print help information
    -V, --version                Print version information
```

**Can Generate Man Pages:**
Clap integrates with `clap_mangen` to auto-generate Unix man pages at compile time [web:23].

**For Reference:** Clap's **declarative, attribute-based** approach is clean and DRY. Consider a similar pattern for NOOA commands (though via TypeScript/Zod, not macros).

**Sources:**
- Clap docs: https://docs.rs/clap [web:17]
- Clap + man pages: https://rust-cli.github.io/book/in-depth/docs.html [web:23]

---

## 4. LLM Tool Specifications & Agent Integration

### 4.1 Claude Function Calling (Anthropic)

**Pattern:**
```json
{
  "name": "read_command",
  "description": "Read a file from disk",
  "input_schema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "File path to read"
      },
      "encoding": {
        "type": "string",
        "enum": ["utf-8", "ascii"],
        "default": "utf-8"
      }
    },
    "required": ["path"]
  }
}
```

**How It Works:**
1. You provide Claude with a list of tools (functions) + their schemas
2. Claude analyzes the user query and decides which tool to use
3. Claude returns: `{ "tool": "read_command", "input": {"path": "..."} }`
4. **You** execute the function and send results back
5. Claude uses results to form its response

**Critical:** Claude doesn't execute functions; it only **suggests** them. You control execution (security feature).

**Output Must Be Deterministic:**
- Tools must return structured JSON
- No randomness
- Reproducible
- Clear error semantics

**For NOOA:** Your command specs must be **agent-friendly**:
- Clear descriptions (Claude reads these)
- Input schema as JSON Schema
- Defined output fields (not just stdout)
- Enumerated error codes (not free-form messages)

**Sources:**
- Claude function calling: https://blog.mlq.ai/claude-function-calling-tools/ [web:36]
- Composio guide: https://composio.dev/blog/claude-function-calling-tools [web:39]
- Anthropic docs: (direct source, referenced in [web:36])

---

### 4.2 Generating Agent Tool Specs from Command Modules

**The Gap:**
- Your CLI command spec (Zod schema) ≠ Agent tool spec (JSON Schema)
- But they **can** derive from the same source

**Solution:**
```typescript
// 1. Define command input via Zod
const ReadInputSchema = z.object({
  path: z.string().describe('File path'),
  encoding: z.enum(['utf-8', 'ascii']).optional(),
});

// 2. Convert to JSON Schema
import { zodToJsonSchema } from 'zod-to-json-schema';
const jsonSchema = zodToJsonSchema(ReadInputSchema);

// 3. Wrap for Claude
const claudeToolSpec = {
  name: 'read_command',
  description: 'Read a file from disk',
  input_schema: jsonSchema,
};

// 4. Pass to Claude
await client.messages.create({
  model: 'claude-opus-4-20250514',
  max_tokens: 1024,
  tools: [claudeToolSpec],
  messages: [...],
});
```

**Key Insight:** A **Zod schema** can generate:
- TypeScript types
- Runtime validation
- JSON Schema (for docs & agents)
- OpenAPI snippets
- Help text (via descriptions)
- Example values (via `.example()`)

---

## 5. Avoiding Drift: Techniques & Automation

### 5.1 Snapshot Testing for Commands

**Idea:** Store the "golden" output of `command --help` and `command --json` in git. Test that actual output matches.

**Example (Node/Jest):**
```typescript
describe('read command', () => {
  test('help output matches snapshot', () => {
    const help = readCommand.getHelpText();
    expect(help).toMatchSnapshot();
  });

  test('schema matches snapshot', () => {
    const schema = readCommand.getInputSchema().toJSON();
    expect(schema).toMatchSnapshot();
  });
});
```

**When Help Changes:**
- CI fails until you review the diff
- You explicitly accept or reject the change
- Git history shows _what_ changed and _why_

**Tools:**
- Jest snapshots (built-in) [web:47]
- Go `golden` library [web:47]
- Flutter golden tests [web:50][web:53]

**For NOOA:** Implement snapshot tests for each command:
```
tests/snapshots/
├── read.help.txt
├── read.schema.json
├── write.help.txt
└── write.schema.json
```

**Sources:**
- Snapshot testing overview: https://github.com/franiglesias/golden [web:47]
- Tiger Beetle article: https://tigerbeetle.com/blog/2024-05-14-snapshot-testing-for-the-masses [web:56]

---

### 5.2 Help Generation from Schema (Not Manual Strings)

**Anti-Pattern:**
```typescript
const command = {
  name: 'read',
  helpText: 'Read a file from disk',
  inputSchema: zod.object({ path: zod.string() }),
  // Help text is now decoupled from schema!
};
```

**Better Pattern:**
```typescript
const readCommand = defineCommand({
  name: 'read',
  description: 'Read a file from disk', // Used for help
  input: z.object({
    path: z.string().describe('File path to read'),
    encoding: z.enum(['utf-8', 'ascii'])
      .describe('File encoding')
      .default('utf-8'),
  }),
  output: z.object({
    content: z.string().describe('File contents'),
    size: z.number().describe('File size in bytes'),
  }),
  errors: {
    FILE_NOT_FOUND: z.object({ path: z.string() }),
    PERMISSION_DENIED: z.object({ path: z.string() }),
  },
  examples: [
    { input: { path: 'example.txt' }, output: { content: '...', size: 42 } },
  ],
  run: async (input) => {
    // implementation
  },
});

// Auto-generate help from command definition
const help = generateHelp(readCommand);
// → "Read a file from disk\n\nUSAGE: read <path> [--encoding=<encoding>]\n..."
```

**This Ensures:**
- Help is always in sync with schema
- Descriptions live with their fields
- Examples are part of the spec
- Changes to schema force help updates

---

### 5.3 CI/CD Checks for Drift

**Automated Checks:**

1. **Schema Validation**
   ```bash
   npm run test:schemas
   # Validates all command schemas conform to a meta-schema
   ```

2. **Help Text Audit**
   ```bash
   npm run audit:help
   # Checks all --help outputs are generated (not manually typed)
   # Fails if any command has hardcoded help text
   ```

3. **Snapshot Diff in PR**
   ```bash
   npm run test:snapshots -- --updateSnapshot
   # Fails unless schemas/help haven't changed
   # PR reviewer must approve changes
   ```

4. **Agent Spec Validation**
   ```bash
   npm run validate:agent-specs
   # Ensures all commands export valid Claude tool specs
   # Tests that specs match input/output schemas
   ```

5. **Breaking Change Detection**
   ```bash
   npm run detect:breaking-changes
   # Compares current commands to previous release
   # Flags removed fields, renamed args, changed error codes
   # Requires semantic version bump if breaking
   ```

---

### 5.4 Semantic Linting for Commands

**Custom ESLint-like Rules for Commands:**

```typescript
// hypothetical rule
const rules = {
  'command/required-description': 'error',
  'command/required-examples': 'warn',
  'command/error-codes-enumerated': 'error',
  'command/output-fields-documented': 'error',
  'command/no-hardcoded-help': 'error',
  'command/required-since-version': 'error',
};
```

**Lint Configuration:**
```yaml
commands:
  rules:
    - name: 'command/required-description'
      severity: error
      message: 'Every command must have a description'
    
    - name: 'command/error-codes-enumerated'
      severity: error
      message: 'All possible errors must be listed with error codes'
      
    - name: 'command/output-deterministic'
      severity: error
      message: 'Output must be deterministic (no timestamps, randomness, or env vars)'
```

---

## 6. Evolutionary Versioning & Deprecation

### 6.1 Per-Command Versioning

**Approach:**
Each command has its own version, separate from the CLI version.

```typescript
const readCommand = defineCommand({
  name: 'read',
  version: '1.0.0',  // Read command version
  since: '0.1.0',    // First released in NOOA v0.1.0
  deprecated: false,
  description: 'Read a file from disk',
  // ...
});
```

**Why Separate Versions?**
- Some commands are stable; others change frequently
- Users can rely on the command version, not CLI version
- SemVer per command is more honest

---

### 6.2 Deprecation Markers

**Pattern:**
```typescript
const legacyReadCmd = defineCommand({
  name: 'read-legacy',
  deprecated: {
    since: '2.0.0',
    replacement: 'read',
    message: 'Use `read` command instead. Removed in v3.0.0.',
  },
  // ...
});
```

**In Help Output:**
```
$ nooa read-legacy --help
⚠️  DEPRECATED: Use `read` command instead. Removed in v3.0.0.

Read a file from disk (legacy version)
...
```

**Tizen Platform Deprecation Policy:**
- Mark deprecated in version V1
- Still available in V2
- Removed in V3 (2 releases to migrate) [web:52]

**For NOOA:**
```
nooa v1.0.0  → deprecate read-legacy (with message)
nooa v2.0.0  → read-legacy still works, but warn
nooa v3.0.0  → read-legacy removed entirely
```

---

### 6.3 Breaking Changes & Semantic Versioning

**Semantic Versioning Rules for Commands:** [web:57][web:60]

| Change | Version Bump | Example |
|--------|--------------|---------|
| Bug fix | PATCH | `read` now correctly handles UTF-16 |
| New backward-compatible flag | MINOR | Add `--recursive` flag to `read` |
| New command | MINOR | Add new `write` command |
| Remove/rename field | MAJOR | Remove `--encoding` flag |
| Change error code | MAJOR | Change `FILE_NOT_FOUND` to `NOT_FOUND` |
| Change output format | MAJOR | Change JSON output structure |
| Incompatible API change | MAJOR | Change input schema significantly |

**For CLI Versioning:**
- Track individual command versions
- CLI version = highest command version + breaking changes
- Or use "versionless" approach (Kubernetes does this)

---

## 7. Reference Architectures & Implementations

### 7.1 Architecture Pattern: Schema-Driven Feature Module

**Complete Example for NOOA:**

```typescript
// src/commands/read.ts

import { z } from 'zod';
import { defineCommand } from '../framework';

// 1. INPUT SCHEMA (Zod)
const ReadInputSchema = z.object({
  path: z.string()
    .describe('File path to read')
    .example('config.json'),
  
  encoding: z.enum(['utf-8', 'ascii', 'utf-16'])
    .default('utf-8')
    .describe('File encoding'),
  
  offset: z.number().int().non_negative()
    .optional()
    .describe('Byte offset to start reading from'),
  
  limit: z.number().int().positive()
    .optional()
    .describe('Maximum bytes to read'),
});

// 2. OUTPUT SCHEMA
const ReadOutputSchema = z.object({
  content: z.string().describe('File contents'),
  size: z.number().describe('File size in bytes'),
  encoding: z.string().describe('Actual encoding used'),
  readAt: z.string().datetime().describe('When the read occurred'),
});

// 3. ERROR CODES
const ReadErrors = z.discriminatedUnion('code', [
  z.object({ code: z.literal('FILE_NOT_FOUND'), path: z.string() }),
  z.object({ code: z.literal('PERMISSION_DENIED'), path: z.string() }),
  z.object({ code: z.literal('INVALID_ENCODING'), encoding: z.string() }),
  z.object({ code: z.literal('IO_ERROR'), message: z.string() }),
]);

// 4. CORE IMPLEMENTATION (testable, reusable)
async function readFile(
  input: z.infer<typeof ReadInputSchema>,
): Promise<z.infer<typeof ReadOutputSchema>> {
  // Core logic—used by CLI, SDK, agent, TUI
  const fs = await import('fs/promises');
  
  try {
    const buffer = await fs.readFile(input.path);
    const content = buffer.toString(input.encoding as BufferEncoding);
    
    return {
      content: content.slice(input.offset ?? 0, input.limit ? (input.offset ?? 0) + input.limit : undefined),
      size: buffer.length,
      encoding: input.encoding,
      readAt: new Date().toISOString(),
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw { code: 'FILE_NOT_FOUND', path: input.path };
    } else if ((err as NodeJS.ErrnoException).code === 'EACCES') {
      throw { code: 'PERMISSION_DENIED', path: input.path };
    } else {
      throw { code: 'IO_ERROR', message: (err as Error).message };
    }
  }
}

// 5. COMMAND DEFINITION
export const readCommand = defineCommand({
  // Metadata
  name: 'read',
  version: '1.2.0',
  since: '0.1.0',
  
  // Documentation
  description: 'Read a file from disk',
  long: `Read a file from disk and return its contents.
  
Supports multiple encodings and partial reads via offset/limit.
Useful for checking configuration files or small text files.`,
  
  // Schemas
  input: ReadInputSchema,
  output: ReadOutputSchema,
  errors: ReadErrors,
  
  // Examples
  examples: [
    {
      description: 'Read a JSON file',
      input: { path: 'package.json' },
      output: { content: '{"name":"example"}', size: 42, encoding: 'utf-8', readAt: '2025-02-03T...' },
    },
    {
      description: 'Read first 100 bytes',
      input: { path: 'large-file.txt', limit: 100 },
      output: { content: 'First 100 bytes...', size: 999999, encoding: 'utf-8', readAt: '2025-02-03T...' },
    },
  ],
  
  // Implementation
  run: readFile,
  
  // Telemetry
  telemetry: {
    trackFields: ['encoding', 'size'],
    redactFields: ['path', 'content'],
  },
  
  // Success handler
  onSuccess: (output) => {
    console.log(`✓ Read ${output.size} bytes from file`);
  },
  
  // Error handler
  onError: (error) => {
    if (error.code === 'FILE_NOT_FOUND') {
      console.error(`✗ File not found: ${error.path}`);
      process.exit(1);
    } else if (error.code === 'PERMISSION_DENIED') {
      console.error(`✗ Permission denied: ${error.path}`);
      process.exit(1);
    } else {
      console.error(`✗ IO error: ${error.message}`);
      process.exit(1);
    }
  },
});

// 6. DERIVED EXPORTS (auto-generated from definition)

// For CLI
export const readCommandCLI = readCommand.toCLI();  // oclif Command

// For SDK/library
export const readAPI = readCommand.toAPI();  // Callable function

// For Agent (Claude, etc.)
export const readAgentSpec = readCommand.toAgentSpec();  // JSON Schema tool spec

// For Documentation
export const readDocumentation = readCommand.toDocumentation();  // Markdown

// For Testing
export { readFile };  // Direct access to core logic
```

**Framework Boilerplate (`src/framework.ts`):**

```typescript
import { z } from 'zod';

export interface CommandDefinition<
  I extends z.ZodType,
  O extends z.ZodType,
  E extends z.ZodDiscriminatedUnion<string, any>,
> {
  name: string;
  version: string;
  since: string;
  description: string;
  long?: string;
  input: I;
  output: O;
  errors: E;
  examples: Array<{
    description: string;
    input: z.infer<I>;
    output?: z.infer<O>;
  }>;
  run: (input: z.infer<I>) => Promise<z.infer<O>>;
  telemetry?: { trackFields: string[]; redactFields: string[] };
  onSuccess?: (output: z.infer<O>) => void;
  onError?: (error: any) => void;
}

export function defineCommand<
  I extends z.ZodType,
  O extends z.ZodType,
  E extends z.ZodDiscriminatedUnion<string, any>,
>(def: CommandDefinition<I, O, E>) {
  return {
    ...def,
    
    // Generate CLI adapter (oclif Command)
    toCLI() {
      // Convert Zod schema to oclif flags
      // Return a Command instance
    },
    
    // Generate agent spec
    toAgentSpec() {
      return {
        name: def.name,
        description: def.description,
        input_schema: zodToJsonSchema(def.input),
      };
    },
    
    // Generate help text
    getHelp() {
      // Build help from definition
    },
    
    // Generate documentation
    toDocumentation() {
      // Markdown with examples, schema, errors
    },
    
    // For SDK use
    toAPI() {
      return async (input: z.infer<I>) => {
        const parsed = def.input.parse(input);
        return def.run(parsed);
      };
    },
  };
}
```

---

### 7.2 Project Structure

```
nooa/
├── src/
│   ├── framework/
│   │   ├── command.ts          # defineCommand, CommandDefinition
│   │   ├── builder.ts          # Help/agent spec generation
│   │   └── index.ts
│   │
│   ├── commands/
│   │   ├── read.ts             # Self-describing read command
│   │   ├── write.ts            # Self-describing write command
│   │   ├── admin/
│   │   │   ├── config.ts
│   │   │   └── logs.ts
│   │   └── index.ts            # Export all commands
│   │
│   ├── cli/
│   │   ├── index.ts            # oclif CLI setup
│   │   └── plugins/            # oclif plugins
│   │
│   ├── sdk/
│   │   ├── index.ts            # TypeScript SDK
│   │   └── types.ts            # Generated types
│   │
│   ├── agent/
│   │   ├── specs.ts            # Claude tool specs
│   │   └── executor.ts         # Tool executor for agents
│   │
│   └── index.ts                # Main exports
│
├── tests/
│   ├── commands/
│   │   ├── read.test.ts
│   │   └── write.test.ts
│   │
│   └── snapshots/
│       ├── read.help.txt
│       ├── read.schema.json
│       └── ...
│
├── docs/
│   ├── cli/                    # Generated CLI docs
│   │   ├── read.md
│   │   └── write.md
│   │
│   └── sdk/                    # Generated SDK docs
│       └── api.md
│
├── dist/
│   ├── cli.js
│   ├── sdk.js
│   └── index.d.ts
│
└── package.json
```

---

## 8. Frameworks & Libraries to Use

### 8.1 Recommended Stack for NOOA

| Layer | Library | Reasoning |
|-------|---------|-----------|
| **Schema** | Zod | TypeScript-first, runtime validation, JSON schema export [web:32] |
| **CLI** | oclif | Node/TS native, plugin system, minimal deps [web:19] |
| **Help Gen** | Custom builder | Generate from Zod schema (not oclif JSDoc) |
| **Agent Spec** | zod-to-json-schema | Convert Zod → JSON Schema for Claude/GPT-4 [web:39] |
| **Testing** | Jest snapshots | Compare help/schema against golden files |
| **Versioning** | semantic-release | Auto-bump version based on commits [web:48] |
| **Documentation** | TypeDoc + custom builder | Generate docs from command definitions |

### 8.2 Supporting Libraries

```json
{
  "dependencies": {
    "zod": "^3.22.0",
    "oclif": "^4.0.0"
  },
  "devDependencies": {
    "zod-to-json-schema": "^3.0.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "jest": "^29.0.0",
    "semantic-release": "^21.0.0",
    "typedoc": "^0.25.0"
  }
}
```

### 8.3 Repos Demonstrating These Patterns

| Project | Pattern | Notes |
|---------|---------|-------|
| [Heroku CLI](https://github.com/heroku/cli) | oclif-based | Large-scale CLI with 100+ commands |
| [Salesforce CLI](https://github.com/salesforcecli) | oclif + plugins | Extensible CLI architecture |
| [AWS CLI v2](https://github.com/aws/aws-cli) | Contract-first (internal JSON spec) | Generated SDK from spec |
| [Kubernetes kubectl](https://github.com/kubernetes/kubectl) | Cobra + code gen | Stable command set for 10+ years |
| [tRPC](https://trpc.io) | Schema-first RPC | End-to-end type safety (similar philosophy) |
| [Prisma CLI](https://github.com/prismaio/prisma) | Oclif + Rust modules | Hybrid architecture |

---

## 9. Implementation Checklist for NOOA

### Phase 1: Foundation (Weeks 1-2)

- [ ] Design command spec format (using Zod)
- [ ] Build `defineCommand()` and framework types
- [ ] Create 2-3 reference commands (`read`, `write`, `help`)
- [ ] Implement Zod → JSON Schema converter
- [ ] Set up snapshot tests

### Phase 2: Integration (Weeks 3-4)

- [ ] Connect framework to oclif
- [ ] Implement CLI adapter generation
- [ ] Add help text generation from schemas
- [ ] Wire up error handling & telemetry
- [ ] Validate against 10+ commands

### Phase 3: Agent & SDK (Weeks 5-6)

- [ ] Generate Claude tool specs
- [ ] Build agent executor (handles tool calls)
- [ ] Generate TypeScript SDK types
- [ ] Create SDK wrapper functions
- [ ] Test with Claude API

### Phase 4: Drift Prevention (Weeks 7-8)

- [ ] Implement schema linting rules
- [ ] Add CI checks (breaking changes, help diffs)
- [ ] Create snapshot testing harness
- [ ] Document deprecation policy
- [ ] Release tooling (semantic-release)

### Phase 5: Documentation & Examples (Weeks 9+)

- [ ] Auto-generate command docs
- [ ] Create CLI reference
- [ ] Write SDK examples
- [ ] Agent examples (with Claude)
- [ ] Migration guides

---

## 10. Recommended Starting Approach

**Do This First (Week 1):**

1. **Define your command spec in plain TypeScript:**
   ```typescript
   // Simple, explicit, no magic
   interface CommandSpec {
     name: string;
     input: ZodSchema;
     output: ZodSchema;
     errors: ZodDiscriminatedUnion;
     run: (input: T) => Promise<U>;
   }
   ```

2. **Write one complete command** (e.g., `read`) using this spec:
   - Input validation (Zod)
   - Core logic
   - Error handling
   - Telemetry
   - Help text generation
   - Agent spec export

3. **Create snapshot tests** for:
   - `help` output stability
   - Schema structure stability
   - Example outputs

4. **Then generalize:**
   - Extract commonalities
   - Build the `defineCommand` helper
   - Create reusable patterns

**Why This Approach?**
- No premature abstraction
- Concrete feedback quickly
- Easier to adjust based on 1-2 real commands
- Avoid framework bloat

---

## 11. References & Further Reading

### Core Concepts
- **Single Source of Truth:** https://www.redhat.com/en/blog/single-source-truth-architecture [web:9]
- **Contract-First Design:** https://www.harrisoncramer.me/contract-first-api-design/ [web:37]
- **CLI Guidelines:** https://clig.dev/ [web:4]
- **Semantic Versioning:** https://semver.org [web:60]

### Framework References
- **oclif:** https://oclif.io [web:19]
- **Cobra:** https://cobra.dev [web:27]
- **Clap:** https://docs.rs/clap [web:17]

### Schema & Validation
- **Zod:** https://zod.dev [web:32]
- **OpenAPI/Swagger:** https://swagger.io [web:31]
- **JSON Schema:** https://json-schema.org

### Agent Integration
- **Claude API (Anthropic):** https://anthropic.com/claude [web:36]
- **Function Calling Guide:** https://blog.mlq.ai/claude-function-calling-tools/ [web:36]

### Testing & Quality
- **Golden/Snapshot Testing:** https://github.com/franiglesias/golden [web:47]
- **Semantic Versioning in CI/CD:** https://semaphore.io/blog/semantic-versioning-cicd [web:54]

### Executable Documentation
- **Literate Programming (Knuth):** https://www-cs-faculty.stanford.edu/~knuth/litprog.html [web:61]
- **MDX:** https://mdxjs.com [web:69]
- **Markdown Execute Blocks:** https://github.com/realworldocaml/mdx [web:63]

---

## 12. Conclusion

**Self-describing modules** are not a new concept—they're well-established in REST APIs (OpenAPI), gRPC (protobuf), and literate programming (Knuth). The key insight for CLIs is:

> **Define the specification once. Generate all artifacts from it: help text, SDK types, agent specs, documentation, and error catalogs.**

**For NOOA**, this means:
1. Use **Zod** for schema definitions (input, output, errors)
2. Build a simple **`defineCommand()` framework** to wrap them
3. Create **generators** that turn schemas into CLIs, SDKs, and agent specs
4. Use **snapshot testing** to catch drift early
5. Adopt **semantic versioning** per command
6. Enforce via **CI/CD linting**

This approach scales to 100+ commands without drift, keeps documentation in sync, enables agent integration natively, and gives you compile-time type safety + runtime validation across all interfaces (CLI, SDK, Agent).

---

**Report compiled:** February 3, 2026  
**Research sources:** 75+ primary sources (tools, frameworks, specifications, academic papers)  
**Estimated implementation effort:** 8-10 weeks for complete integration with NOOA
