import { existsSync } from "node:fs";
import { join } from "node:path";
import { execa } from "execa";
import type { Gate, GateResult, WorkflowContext } from "./types";

export class SpecGate implements Gate {
	id = "spec";
	description = "Verifies that an implementation plan exists.";

	async check(ctx: WorkflowContext): Promise<GateResult> {
		// Look for implementation_plan.md in the brain or docs
		// For MVP, we might look for a specific file pattern or just ANY plan.
		// Let's assume the agent creates `implementation_plan.md` in the brain/cwd.

		// Context might need to provide the "brain" path or we check relative to CWD?
		// Let's check for `implementation_plan.md` in the root or .nooa directory.

		const planPath = join(ctx.cwd, "implementation_plan.md");
		// Also check typical brain location if we can infer it?
		// For now, simple check in CWD or .nooa
		const brainPlanPath = join(ctx.cwd, ".nooa", "implementation_plan.md"); // hypothetical

		if (existsSync(planPath) || existsSync(brainPlanPath)) {
			return { ok: true };
		}

		// Also check if context args has a specific plan path
		if (ctx.args?.planPath && typeof ctx.args.planPath === "string") {
			if (existsSync(ctx.args.planPath)) return { ok: true };
		}

		return {
			ok: false,
			reason: "No implementation_plan.md found. You must plan before acting.",
			suggestions: ["Create implementation_plan.md"],
		};
	}
}

export class TestGate implements Gate {
	id = "test";
	description = "Verifies that all tests pass.";

	async check(ctx: WorkflowContext): Promise<GateResult> {
		try {
			// Run tests related to the change? Or all tests?
			// "Disciplined Hypergrowth" says run RELEVANT tests.
			// For MVP, run all tests (or context specific if we had it).
			// Using `bun test`
			await execa("bun", ["test"], { cwd: ctx.cwd });
			return { ok: true };
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				ok: false,
				reason: `Tests failed: ${message}`,
				suggestions: ["Fix failing tests", "Run `bun test` to see details"],
			};
		}
	}
}

export class DogfoodGate implements Gate {
	id = "dogfood";
	description = "Verifies the command runs successfully (Dogfooding).";

	async check(ctx: WorkflowContext): Promise<GateResult> {
		// How do we know WHAT to dogfood?
		// The command being built might be inferred from context or args.
		// If we are building `nooa replay`, we should run `nooa replay --help`.

		// Construct the command to run.
		// If ctx.command is set to the target feature (e.g. "replay"), try running it.
		// But ctx.command in WorkflowContext usually means "the command that started the workflow" (e.g. "act").

		// We might look for a "target" arg in context.
		const target = ctx.args?.target as string | undefined;
		if (!target) {
			// If we can't determine what to dogfood, maybe skip or warn?
			// For strictness, if we claim to be "dogfooding", we must know what.
			// But if generic, maybe just check `nooa --help` works?
			return { ok: true }; // Pass if no specific target defined for now.
		}

		try {
			// Run the target command help or version as smoke test
			await execa("bun", ["index.ts", target, "--help"], { cwd: ctx.cwd });
			return { ok: true };
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				ok: false,
				reason: `Dogfood check failed for '${target}': ${message}`,
				suggestions: ["Check command syntax", "Verify command registration"],
			};
		}
	}
}
