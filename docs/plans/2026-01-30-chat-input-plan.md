# Chat Input System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `/mnt/skills/user/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Add `nooa message` command as the primary entry point for sending messages/prompts to the AI agent.

**Architecture:** Implement `message` feature under `src/features/chat/`. The command parses user input, validates the message role, emits telemetry, and outputs in plain text or JSON format.

**Tech Stack:** Bun, TypeScript, execa.

## User Review Required

> [!IMPORTANT]
> **Initial Scope**: This command is an entry point. By default, it will:
> - Accept and validate user messages
> - Log messages to the telemetry system
> - Support structured output (--json)
> 
> **Future Scope** (not in this plan):
> - Integration with AI backend for actual responses
> - Integration with memory system for context persistence
> - Conversation threading
> - Multi-turn dialog management

---

### Task 1: Add CLI help contract for `nooa message`

**Files:**
- Create: `src/features/chat/cli.test.ts`
- Create: `src/features/chat/cli.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test";
import { execa } from "execa";

const binPath = "./index.ts";

describe("nooa message", () => {
  it("shows help", async () => {
    const res = await execa("bun", [binPath, "message", "--help"], { reject: false });
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain("Usage: nooa message <text>");
    expect(res.stdout).toContain("Flags:");
    expect(res.stdout).toContain("--role");
    expect(res.stdout).toContain("--json");
    expect(res.stdout).toContain("-h, --help");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/chat/cli.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// src/features/chat/cli.ts
export function showHelp(): void {
  console.log(`
Usage: nooa message <text>

Send a message to the AI agent.

Arguments:
  <text>         The message content (required)

Flags:
  --role <type>  Message role: user, system, assistant (default: user)
  --json         Output in JSON format
  -h, --help     Show this help message

Examples:
  nooa message "Hello, how are you?"
  nooa message "Initialize system" --role system
  nooa message "Summarize this" --json
`);
}

export async function handleMessageCommand(args: string[]): Promise<void> { /* TBD */ }
```

**Step 4: Run test to verify it passes**

Run: `bun test src/features/chat/cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/chat/cli.ts src/features/chat/cli.test.ts
git commit -m "feat: add message help"
```

---

### Task 2: Implement message validation and parsing

**Files:**
- Create: `src/features/chat/types.ts`
- Modify: `src/features/chat/cli.ts`
- Modify: `src/features/chat/cli.test.ts`

**Step 1: Write the failing test**

```ts
describe("nooa message validation", () => {
  it("requires message text", async () => {
    const res = await execa("bun", [binPath, "message"], { reject: false });
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain("Message text is required");
  });

  it("validates role values", async () => {
    const res = await execa("bun", [binPath, "message", "test", "--role", "invalid"], { reject: false });
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain("Invalid role");
  });

  it("accepts valid roles", async () => {
    const roles = ["user", "system", "assistant"];
    for (const role of roles) {
      const res = await execa("bun", [binPath, "message", "test", "--role", role], { reject: false });
      expect(res.exitCode).toBe(0);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/chat/cli.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// src/features/chat/types.ts
export type MessageRole = "user" | "system" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
  timestamp: string;
}

export interface MessageOptions {
  role: MessageRole;
  json: boolean;
}
```

```ts
// src/features/chat/cli.ts
import type { MessageRole, MessageOptions } from "./types.ts";

const VALID_ROLES: MessageRole[] = ["user", "system", "assistant"];

function validateRole(role: string): MessageRole {
  if (!VALID_ROLES.includes(role as MessageRole)) {
    console.error(`Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }
  return role as MessageRole;
}

function parseMessageArgs(args: string[]): { content: string; options: MessageOptions } {
  // Parse args, validate message content exists
  // Extract --role and --json flags
  // Return parsed content and options
}
```

Exit codes:
- 1: Missing message text or invalid role

**Step 4: Run test to verify it passes**

Run: `bun test src/features/chat/cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/chat/types.ts src/features/chat/cli.ts src/features/chat/cli.test.ts
git commit -m "feat: add message validation"
```

---

### Task 3: Implement message execution and telemetry

**Files:**
- Create: `src/features/chat/execute.ts`
- Create: `src/features/chat/execute.test.ts`
- Modify: `src/features/chat/cli.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test";
import { executeMessage } from "./execute.ts";
import type { Message } from "./types.ts";

describe("executeMessage", () => {
  it("returns message object with timestamp", async () => {
    const result = await executeMessage("Hello", { role: "user", json: false });
    
    expect(result).toHaveProperty("role", "user");
    expect(result).toHaveProperty("content", "Hello");
    expect(result).toHaveProperty("timestamp");
    expect(new Date(result.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("handles different roles", async () => {
    const roles: Array<"user" | "system" | "assistant"> = ["user", "system", "assistant"];
    
    for (const role of roles) {
      const result = await executeMessage("Test", { role, json: false });
      expect(result.role).toBe(role);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/chat/execute.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// src/features/chat/execute.ts
import type { Message, MessageOptions } from "./types.ts";

export async function executeMessage(
  content: string,
  options: MessageOptions
): Promise<Message> {
  const message: Message = {
    role: options.role,
    content,
    timestamp: new Date().toISOString(),
  };

  // TODO: Emit telemetry
  // await telemetry.emit("message.received", {
  //   role: message.role,
  //   contentLength: message.content.length,
  //   timestamp: message.timestamp,
  // });

  return message;
}

export function formatOutput(message: Message, json: boolean): string {
  if (json) {
    return JSON.stringify(message, null, 2);
  }
  
  return `[${message.role}] ${message.content}`;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/features/chat/execute.test.ts`
Expected: PASS

**Step 5: Integrate with CLI**

```ts
// src/features/chat/cli.ts
import { executeMessage, formatOutput } from "./execute.ts";

export async function handleMessageCommand(args: string[]): Promise<void> {
  const { content, options } = parseMessageArgs(args);
  
  const message = await executeMessage(content, options);
  const output = formatOutput(message, options.json);
  
  console.log(output);
}
```

**Step 6: Add integration test**

```ts
// src/features/chat/cli.test.ts
describe("nooa message integration", () => {
  it("outputs plain text by default", async () => {
    const res = await execa("bun", [binPath, "message", "Hello world"], { reject: false });
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain("[user] Hello world");
  });

  it("outputs JSON when --json flag is used", async () => {
    const res = await execa("bun", [binPath, "message", "Test", "--json"], { reject: false });
    expect(res.exitCode).toBe(0);
    
    const output = JSON.parse(res.stdout);
    expect(output).toHaveProperty("role", "user");
    expect(output).toHaveProperty("content", "Test");
    expect(output).toHaveProperty("timestamp");
  });

  it("respects role flag", async () => {
    const res = await execa("bun", [binPath, "message", "Init", "--role", "system"], { reject: false });
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain("[system] Init");
  });
});
```

**Step 7: Commit**

```bash
git add src/features/chat/execute.ts src/features/chat/execute.test.ts src/features/chat/cli.ts src/features/chat/cli.test.ts
git commit -m "feat: add message execution"
```

---

### Task 4: Documentation

**Files:**
- Create or Modify: `docs/commands/message.md`
- Modify: `README.md`

**Step 1: Write documentation**

```markdown
# nooa message

Send a message to the AI agent.

## Usage

\`\`\`bash
nooa message <text> [flags]
\`\`\`

## Arguments

- `<text>` - The message content (required)

## Flags

- `--role <type>` - Message role: `user`, `system`, or `assistant` (default: `user`)
- `--json` - Output in JSON format
- `-h, --help` - Show help message

## Examples

### Basic message
\`\`\`bash
nooa message "Hello, how are you?"
# Output: [user] Hello, how are you?
\`\`\`

### System message
\`\`\`bash
nooa message "Initialize system" --role system
# Output: [system] Initialize system
\`\`\`

### JSON output
\`\`\`bash
nooa message "Summarize this" --json
# Output:
# {
#   "role": "user",
#   "content": "Summarize this",
#   "timestamp": "2025-01-30T12:34:56.789Z"
# }
\`\`\`

## Exit Codes

- `0` - Success
- `1` - Missing message text or invalid role

## Message Roles

- **user** (default): Messages from the end user
- **system**: System-level instructions or context
- **assistant**: Messages from the AI (for testing or replay)

## Output Format

### Plain Text (default)
\`\`\`
[role] message content
\`\`\`

### JSON (--json flag)
\`\`\`json
{
  "role": "user",
  "content": "message content",
  "timestamp": "ISO 8601 timestamp"
}
\`\`\`

## Notes

- This command currently logs messages to telemetry only
- AI backend integration will be added in future releases
- Messages are not persisted between commands (yet)

## Troubleshooting

### "Message text is required"
You must provide message text as an argument:
\`\`\`bash
nooa message "your text here"
\`\`\`

### "Invalid role"
Role must be one of: `user`, `system`, `assistant`
\`\`\`bash
nooa message "test" --role user  # ✓ valid
nooa message "test" --role admin # ✗ invalid
\`\`\`
```

**Step 2: Update README**

Add `message` command to the commands list in README.md if applicable.

**Step 3: Commit**

```bash
git add docs/commands/message.md README.md
git commit -m "docs: add message command"
```

---

## Verification Plan

### Automated Tests

Run full test suite:
```bash
bun test src/features/chat/
```

Expected: All tests pass

Tests should cover:
- Help text display
- Argument parsing and validation
- Role validation (valid and invalid roles)
- Message execution
- Plain text output format
- JSON output format and schema
- Timestamp generation
- Exit codes

### Manual Verification (Dogfooding)

**Required manual tests:**

```bash
# 1. Help text
bun run index.ts message --help
# Verify: help displays correctly, all flags documented

# 2. Basic message (happy path)
bun run index.ts message "Hello world"
# Expected: [user] Hello world
# Verify exit code: echo $? (should be 0)

# 3. Different roles
bun run index.ts message "Initialize" --role system
bun run index.ts message "Response" --role assistant
# Verify: role appears in output

# 4. JSON output
bun run index.ts message "Test" --json
# Verify: valid JSON, has role/content/timestamp fields

# 5. Combined flags
bun run index.ts message "System init" --role system --json
# Verify: JSON output with correct role

# 6. Error cases
bun run index.ts message
# Expected: error message, exit code 1
echo $?

bun run index.ts message "test" --role invalid
# Expected: error message about invalid role, exit code 1
echo $?

# 7. Edge cases
bun run index.ts message "Message with 'quotes' and \"double quotes\""
bun run index.ts message "Multi
line
message"
# Verify: handles special characters and newlines
```

### Success Criteria

Before marking this task as complete:

- [ ] All automated tests pass
- [ ] Manual dogfooding completed successfully
- [ ] Help text is accurate and complete
- [ ] All three roles (user, system, assistant) work correctly
- [ ] JSON output is valid and matches schema
- [ ] Exit codes are correct (0 for success, 1 for errors)
- [ ] Error messages are clear and actionable
- [ ] Documentation is complete and accurate
- [ ] Code follows project patterns and style
- [ ] No console errors or warnings

---

## Future Enhancements (Out of Scope)

These will be addressed in subsequent tasks:

1. **AI Backend Integration**
   - Connect to actual AI service
   - Return AI responses
   - Handle streaming responses

2. **Memory System**
   - Persist conversation history
   - Context management
   - Conversation threading

3. **Advanced Features**
   - Multi-turn conversations
   - Conversation ID tracking
   - Message editing/deletion
   - Conversation export/import

4. **Telemetry Enhancement**
   - Detailed usage metrics
   - Performance tracking
   - Error analytics
