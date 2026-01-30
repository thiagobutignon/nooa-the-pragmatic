---
name: dogfooding
description: Verify real-world behavior, help text consistency, and CLI contract satisfaction after implementing features or fixes. Required before claiming completion.
---

# Dogfooding

## Overview
**Dogfooding is the practice of using your own product to verify it works as intended in real-world conditions.**

For Claude implementing CLI tools, this means:
- Manually executing commands in a real terminal
- Verifying help text matches implementation
- Checking exit codes and output formats
- Running the full test suite
- Testing edge cases and error conditions

**CRITICAL: Dogfooding is REQUIRED before completing any CLI-related task.**

## When to Use

### Always Required
- After implementing a new command or flag.
- After refactoring the CLI entry point or argument parsing.
- After modifying help text or documentation.
- After changing exit codes or error messages.
- Before marking ANY CLI task as complete.

### Also Recommended
- After fixing bugs in command handling.
- After updating dependencies that affect CLI behavior.
- When implementing features that interact with external tools (git, etc).

## Core Pattern

### 1. Execute Primary Commands
```bash
# Run the happy path
bun run index.ts <command> <args>

# Check output format and content
# Verify exit code: echo $?
```

### 2. Execute Edge Cases
```bash
# Missing required arguments
bun run index.ts <command>

# Invalid arguments
bun run index.ts <command> --invalid-flag

# Help for each subcommand
bun run index.ts <command> --help
```

### 3. Help Check
```bash
# Root help
bun run index.ts --help

# Verify:
# - All implemented commands are listed
# - Removed commands are NOT listed
# - Flag descriptions are accurate
# - Examples are correct
# - No typos or formatting issues
```

### 4. Contract Check
```bash
# If --json is supported
bun run index.ts <command> --json

# Verify:
# - Valid JSON output
# - Expected schema structure
# - Semantic exit codes (0=success, 1=error, 2+=specific errors)
```

### 5. Test Suite
```bash
# ALWAYS run full test suite
bun test

# If tests fail, fix them BEFORE completing the task
```

## Why it Matters
Without dogfooding, you might:
- Leave old commands in the help text (drift).
- Break the `--json` schema for downstream tools.
- Deliver "working" code that fails in a real shell invocation.
- Ship confusing or misleading error messages.
- Create help text that doesn't match actual behavior.
- Introduce regressions in existing commands.
- Break command chaining or piping behavior.

**Real users will immediately notice these issues.** Dogfooding catches them before shipping.

## Dogfooding Checklist

Before marking a CLI task as complete, verify:

- [ ] Primary command executes without errors
- [ ] Help text is accurate and complete
- [ ] All flags work as documented
- [ ] Exit codes are correct (0 for success, non-zero for errors)
- [ ] Error messages are clear and actionable
- [ ] Edge cases handle gracefully (missing args, invalid input)
- [ ] Output format matches expectations (plain text, JSON, etc)
- [ ] Full test suite passes (`bun test`)
- [ ] No console errors or unhandled exceptions
- [ ] Command works with different shell environments (if applicable)

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Unit tests passed" | Tests often mock the environment or help text. Executing proves the integration works. |
| "I'll check help later" | Later is never. Inconsistent help text is a bug. |
| "The user can test it" | You are the first user. Don't ship broken UX. |
| "It's just a small change" | Small changes can have big impacts. Always verify. |
| "I only changed one flag" | That flag might affect help text, tests, and examples. |
| "The code looks correct" | Code correctness ≠ user experience quality. |

## Practical Examples

### Example 1: After Implementing `nooa commit`

```bash
# 1. Execute primary command
bun run index.ts commit -m "test commit"
# Expected: success or clear error message

# 2. Test edge cases
bun run index.ts commit
# Expected: error about missing -m flag

bun run index.ts commit -m "test" --invalid-flag
# Expected: error about unknown flag

# 3. Check help
bun run index.ts commit --help
# Verify: -m flag documented, --no-test documented, examples present

# 4. Run tests
bun test src/features/commit/
# Expected: all tests pass

# 5. Verify exit codes
bun run index.ts commit -m "test"; echo $?
# Expected: 0 on success, non-zero on error
```

### Example 2: After Refactoring Argument Parsing

```bash
# Test ALL existing commands to ensure nothing broke
bun run index.ts --help
bun run index.ts commit --help
bun run index.ts push --help
# ... etc for all commands

# Run full test suite
bun test
```

## Red Flags

These indicate you're skipping dogfooding:

- ❌ Marking task complete without running the command manually
- ❌ Seeing `Error: Unknown subcommand` and not investigating
- ❌ Help text listing features that were removed
- ❌ Test failures that you "plan to fix later"
- ❌ Assuming everything works because the code compiles
- ❌ Not checking help text after changing command structure
- ❌ Skipping edge case testing "to save time"
- ❌ Delivering code with console.log debugging statements still present

## Integration with Other Skills

Dogfooding complements:
- **executing-plans**: Run dogfooding checks after each task completion
- **TDD workflows**: Execute real commands after tests pass
- **Documentation**: Verify examples in docs actually work

## Success Criteria

You've successfully dogfooded when:

1. ✅ You've executed the command in a real terminal
2. ✅ All help text is accurate and complete
3. ✅ Exit codes match documented behavior
4. ✅ Full test suite passes
5. ✅ Edge cases are handled gracefully
6. ✅ You're confident a user could successfully use the feature

**Only then should you mark the task as complete.**
