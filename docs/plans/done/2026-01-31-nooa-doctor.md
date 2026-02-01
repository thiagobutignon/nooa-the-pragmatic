# nooa doctor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sanity check the development environment before any complex operation.

**Architecture:** Check dependencies (bun, git, rg), providers, permissions, and repo structure.

**Tech Stack:** Bun, TypeScript, execa.

---

### Task 1: Doctor Core Checks

**Files:**
- Create: `src/features/doctor/execute.ts`
- Test: `src/features/doctor/execute.test.ts`

**Step 1: Write the failing test**

```typescript
import { expect, test, describe } from "bun:test";
import { runDoctor } from "./execute";

describe("Doctor", () => {
    test("checks for required tools", async () => {
        const result = await runDoctor();
        expect(result).toHaveProperty("bun");
        expect(result).toHaveProperty("git");
        expect(result).toHaveProperty("ok");
    });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/doctor/execute.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/features/doctor/execute.ts
import { execa } from "execa";

export interface DoctorResult {
    ok: boolean;
    bun: { available: boolean; version?: string };
    git: { available: boolean; version?: string };
    rg: { available: boolean };
    sqlite: { available: boolean };
}

export async function runDoctor(): Promise<DoctorResult> {
    const checks = {
        bun: await checkTool("bun", ["--version"]),
        git: await checkTool("git", ["--version"]),
        rg: await checkTool("rg", ["--version"]),
        sqlite: await checkTool("sqlite3", ["--version"]),
    };
    return {
        ...checks,
        ok: Object.values(checks).every(c => c.available)
    };
}

async function checkTool(cmd: string, args: string[]) {
    try {
        const { stdout } = await execa(cmd, args);
        return { available: true, version: stdout.trim().split("\n")[0] };
    } catch {
        return { available: false };
    }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/features/doctor/execute.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/doctor/
git commit -m "feat: implement doctor core checks"
```

---

### Task 2: CLI Command `nooa doctor`

**Files:**
- Create: `src/features/doctor/cli.ts`

**Step 1: Write the failing test**

```typescript
test("--help shows usage", async () => {
    const { stdout, exitCode } = await execa("bun", ["index.ts", "doctor", "--help"], { reject: false });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage: nooa doctor");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/features/doctor/cli.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/features/doctor/cli.ts
import type { Command, CommandContext } from "../../core/command";
import { parseArgs } from "node:util";
import { runDoctor } from "./execute";

const doctorHelp = `
Usage: nooa doctor [flags]

Check development environment health.

Flags:
  --json         Output as JSON.
  -h, --help     Show help.
`;

const doctorCommand: Command = {
    name: "doctor",
    description: "Check environment health",
    execute: async ({ rawArgs }: CommandContext) => {
        const { values } = parseArgs({
            args: rawArgs,
            options: { help: { type: "boolean", short: "h" }, json: { type: "boolean" } },
            allowPositionals: true, strict: false
        });
        if (values.help) { console.log(doctorHelp); return; }

        const result = await runDoctor();
        if (values.json) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log(result.bun.available ? `✅ bun: ${result.bun.version}` : "❌ bun: not found");
            console.log(result.git.available ? `✅ git: ${result.git.version}` : "❌ git: not found");
            console.log(result.rg.available ? "✅ ripgrep" : "❌ ripgrep: not found");
            console.log(result.ok ? "\n✅ Environment healthy" : "\n❌ Issues found");
        }
        process.exitCode = result.ok ? 0 : 1;
    }
};

export default doctorCommand;
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add src/features/doctor/
git commit -m "feat: add nooa doctor command"
```
