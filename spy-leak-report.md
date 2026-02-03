# Spy Leak Analysis Report

## Summary
Found **15 test files** with spy leaks (spyOn without mockRestore):

## Critical (10+ leaks)
- `src/features/memory/engine.test.ts`: **12 leaks** ⚠️⚠️⚠️

## High (3-5 leaks)
- `src/features/index/index.test.ts`: **4 leaks**

## Medium (2 leaks)
- `src/core/reflection/hook.test.ts`: **2 leaks**
- `src/features/guardrail/cli.test.ts`: **2 leaks**

## Low (1 leak each)
- `src/core/logger.test.ts`
- `src/features/context/execute.test.ts`
- `src/features/embed/cli.test.ts`
- `src/features/read/execute.test.ts`
- `src/features/code/execute.test.ts`
- `src/features/mcp/cli.test.ts`
- `src/features/search/engine.test.ts`
- `src/features/pr/gh.test.ts`
- `src/features/prompt/engine.test.ts`
- `src/features/fix/execute.test.ts`

## Total Impact
- **41 total spy leaks** across the codebase
- These leaks cause EventBus timeouts and test pollution
- Priority: Fix critical and high-priority files first

## Files Already Fixed
- ✅ `read/execute.test.ts` - Fixed 6 leaks → 1 remaining
- ✅ `code/execute.test.ts` - Fixed 9 leaks → 1 remaining
