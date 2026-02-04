import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import { printError, renderJson, setExitCode } from "../../core/cli-output";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { clearGoal, getGoal, setGoal } from "./execute";

export const goalMeta: AgentDocMeta = {
	name: "goal",
	description: "Manage focus and goals",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const goalHelp = `
Usage: nooa goal <subcommand> [flags]

Manage focus and prevent scope creep.

Subcommands:
  set <goal>     Set the current goal.
  status         Show current goal.
  clear          Clear the current goal.

Flags:
  --json         Output as JSON.
  -h, --help     Show help.

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  goal.missing_goal: Goal text required
  goal.invalid_command: Unknown subcommand
  goal.runtime_error: Operation failed
`;

export const goalSdkUsage = `
SDK Usage:
  await goal.run({ action: "set", goal: "Ship it" });
  const result = await goal.run({ action: "status" });
`;

export const goalUsage = {
	cli: "nooa goal <subcommand> [flags]",
	sdk: "await goal.run({ action: \"status\" })",
	tui: "GoalPanel()",
};

export const goalSchema = {
	action: { type: "string", required: true },
	goal: { type: "string", required: false },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const goalOutputFields = [
	{ name: "mode", type: "string" },
	{ name: "goal", type: "string" },
	{ name: "message", type: "string" },
];

export const goalErrors = [
	{ code: "goal.missing_goal", message: "Goal text required." },
	{ code: "goal.invalid_command", message: "Unknown subcommand." },
	{ code: "goal.runtime_error", message: "Operation failed." },
];

export const goalExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const goalExamples = [
	{ input: "nooa goal set Ship it", output: "Goal set" },
	{ input: "nooa goal status", output: "Current goal" },
];

export interface GoalRunInput {
	action?: "set" | "status" | "clear";
	goal?: string;
	json?: boolean;
}

export interface GoalRunResult {
	mode: "set" | "status" | "clear";
	goal: string | null;
	message?: string;
}

export async function run(
	input: GoalRunInput,
): Promise<SdkResult<GoalRunResult>> {
	try {
		if (!input.action) {
			return {
				ok: false,
				error: sdkError("goal.invalid_command", "Unknown subcommand."),
			};
		}

		if (input.action === "set") {
			const goal = input.goal ?? "";
			if (!goal) {
				return {
					ok: false,
					error: sdkError("goal.missing_goal", "Goal text required."),
				};
			}
			await setGoal(goal);
			return {
				ok: true,
				data: { mode: "set", goal, message: `Goal set: ${goal}` },
			};
		}

		if (input.action === "status") {
			const goal = await getGoal();
			return {
				ok: true,
				data: { mode: "status", goal: goal || null },
			};
		}

		if (input.action === "clear") {
			await clearGoal();
			return {
				ok: true,
				data: { mode: "clear", goal: null, message: "Goal cleared" },
			};
		}

		return {
			ok: false,
			error: sdkError("goal.invalid_command", "Unknown subcommand."),
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: sdkError("goal.runtime_error", message),
		};
	}
}

const goalBuilder = new CommandBuilder<GoalRunInput, GoalRunResult>()
	.meta(goalMeta)
	.usage(goalUsage)
	.schema(goalSchema)
	.help(goalHelp)
	.sdkUsage(goalSdkUsage)
	.outputFields(goalOutputFields)
	.examples(goalExamples)
	.errors(goalErrors)
	.exitCodes(goalExitCodes)
	.options({ options: buildStandardOptions() })
	.parseInput(async ({ positionals, values }) => ({
		action: positionals[1] as "set" | "status" | "clear" | undefined,
		goal: positionals.slice(2).join(" ") || undefined,
		json: Boolean(values.json),
	}))
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson({ goal: output.goal });
			return;
		}
		if (output.mode === "set") {
			console.log(`✅ Goal set: ${output.goal}`);
			return;
		}
		if (output.mode === "status") {
			console.log(output.goal || "No goal set. Use `nooa goal set <goal>`");
			return;
		}
		if (output.mode === "clear") {
			console.log("✅ Goal cleared");
		}
	})
	.onFailure((error) => {
		if (error.code === "goal.missing_goal") {
			console.error("Error: Goal text required");
			process.exitCode = 2;
			return;
		}
		if (error.code === "goal.invalid_command") {
			console.log(goalHelp);
			process.exitCode = 2;
			return;
		}
		printError(error);
		setExitCode(error, ["goal.missing_goal", "goal.invalid_command"]);
	})
	.telemetry({
		eventPrefix: "goal",
		successMetadata: (input) => ({
			action: input.action,
		}),
		failureMetadata: (input, error) => ({
			action: input.action,
			error: error.message,
		}),
	});

export const goalAgentDoc = goalBuilder.buildAgentDoc(false);
export const goalFeatureDoc = (includeChangelog: boolean) =>
	goalBuilder.buildFeatureDoc(includeChangelog);

const goalCommand = goalBuilder.build();

export default goalCommand;
