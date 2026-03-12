import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import {
	isBacklogBoardColumnId,
	moveBacklogStory,
	renderBacklogBoard,
	type BacklogBoardColumnId,
} from "./board";
import { generateBacklogFromPrompt } from "./generate";
import { importBacklogIntoRalph } from "./ralph-bridge";
import { splitBacklogStories } from "./split";
import type { BacklogAction, BacklogMode } from "./types";
import { validateBacklogPrd } from "./validate";

export interface BacklogRunInput {
	action?: BacklogAction;
	json?: boolean;
	prompt?: string;
	inPath?: string;
	outPath?: string;
	profileCommand?: string[];
	maxAcceptanceCriteria?: number;
	maxStories?: number;
	storyId?: string;
	targetColumn?: BacklogBoardColumnId;
}

export interface BacklogRunResult {
	mode: BacklogMode;
	raw?: string;
	message?: string;
	prd?: unknown;
	outPath?: string;
	errors?: string[];
	board?: unknown;
}

export const backlogMeta: AgentDocMeta = {
	name: "backlog",
	description: "Generate and operate backlog PRDs and kanban state",
	changelog: [
		{ version: "1.0.0", changes: ["Initial backlog command scaffold"] },
	],
};

export const backlogHelp = `
Usage: nooa backlog <subcommand> [args] [flags]

Generate and operate backlog PRDs and kanban state.

Subcommands:
  generate              Generate a PRD from a macro prompt.
  validate              Validate PRD schema compatibility.
  split                 Split large stories into smaller units.
  board                 Render board columns from PRD state.
  move                  Move one story between board columns.
  import-ralph          Normalize a backlog PRD and import it into .nooa/ralph/.

Flags:
  --json                Output results as JSON.
  --in <path>           Input PRD JSON path.
  --out <path>          Persist generated PRD JSON to disk.
  --profile-command <json>
                        Optional JSON array used to seed story.profileCommand.
  --max-ac <n>          Max acceptance criteria per story when splitting.
  --max-stories <n>     Max stories allowed after splitting.
  --story <id>          Story ID used by move.
  --to <column>         Target board column: todo|in_progress|in_review|done.
  -h, --help            Show help message.

Examples:
  nooa backlog --help
  nooa backlog generate --help
  nooa backlog generate "Improve latency" --profile-command '["node","scripts/profile-target.js"]'
  nooa backlog split --in prd.json --out prd.split.json --max-ac 2 --json
  nooa backlog board --in prd.json --json
  nooa backlog move --in prd.json --story US-001 --to in_review --out prd.json --json
  nooa backlog import-ralph --in prd.json --json

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  backlog.missing_action: Subcommand required
  backlog.missing_prompt: Prompt required for generate
  backlog.missing_input_path: Input path required
  backlog.invalid_action: Unknown subcommand
  backlog.runtime_error: Unexpected error
`;

export const backlogUsage = {
	cli: "nooa backlog <subcommand> [args] [flags]",
	sdk: 'await backlog.run({ action: "help" })',
};

export const backlogSdkUsage = `
SDK Usage:
  const result = await backlog.run({ action: "help" });
  if (result.ok) console.log(result.data.mode);
`;

export const backlogSchema = {
	action: { type: "string", required: true },
	json: { type: "boolean", required: false },
	in: { type: "string", required: false },
	out: { type: "string", required: false },
	"profile-command": { type: "string", required: false },
	"max-ac": { type: "number", required: false },
	"max-stories": { type: "number", required: false },
	story: { type: "string", required: false },
	to: { type: "string", required: false },
} satisfies SchemaSpec;

export const backlogOutputFields = [
	{ name: "mode", type: "string" },
	{ name: "raw", type: "string" },
	{ name: "message", type: "string" },
	{ name: "prd", type: "object" },
	{ name: "board", type: "array" },
	{ name: "outPath", type: "string" },
	{ name: "errors", type: "array" },
];

export const backlogErrors = [
	{ code: "backlog.missing_action", message: "Subcommand required." },
	{ code: "backlog.missing_prompt", message: "Prompt required for generate." },
	{ code: "backlog.missing_input_path", message: "Input path required." },
	{ code: "backlog.missing_story", message: "Story ID required." },
	{ code: "backlog.missing_target_column", message: "Target column required." },
	{ code: "backlog.invalid_action", message: "Unknown subcommand." },
	{ code: "backlog.runtime_error", message: "Unexpected error." },
];

export const backlogExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const backlogExamples = [
	{
		input: "nooa backlog --help",
		output: "Show subcommand contract for backlog operations.",
	},
];

export async function run(
	input: BacklogRunInput,
): Promise<SdkResult<BacklogRunResult>> {
	const action = input.action;
	if (!action || action === "help") {
		return {
			ok: true,
			data: {
				mode: "help",
				raw: backlogHelp,
			},
		};
	}

	if (action === "generate") {
		if (!input.prompt?.trim()) {
			return {
				ok: false,
			error: sdkError(
					"backlog.missing_prompt",
					"Prompt required for generate.",
				),
			};
		}

		const prd = await generateBacklogFromPrompt({
			prompt: input.prompt,
			profileCommand: input.profileCommand,
		});
		if (input.outPath) {
			await mkdir(dirname(input.outPath), { recursive: true });
			await writeFile(
				input.outPath,
				`${JSON.stringify(prd, null, 2)}\n`,
				"utf8",
			);
		}
		return {
			ok: true,
			data: {
				mode: "generate",
				prd,
				outPath: input.outPath,
				message: input.outPath
					? `Generated PRD written to ${input.outPath}`
					: "Generated PRD",
			},
		};
	}

	if (action === "validate") {
		if (!input.inPath) {
			return {
				ok: false,
				error: sdkError("backlog.missing_input_path", "Input path required."),
			};
		}
		const payload = JSON.parse(await readFile(input.inPath, "utf8"));
		const validation = validateBacklogPrd(payload);
		return {
			ok: true,
			data: {
				mode: "validate",
				message: validation.ok ? "PRD is valid" : "PRD is invalid",
				errors: validation.errors,
			},
		};
	}

	if (action === "split") {
		if (!input.inPath) {
			return {
				ok: false,
				error: sdkError("backlog.missing_input_path", "Input path required."),
			};
		}
		const payload = JSON.parse(await readFile(input.inPath, "utf8"));
		const { prd } = splitBacklogStories(payload, {
			maxAcceptanceCriteria: input.maxAcceptanceCriteria,
			maxStories: input.maxStories,
		});
		if (input.outPath) {
			await mkdir(dirname(input.outPath), { recursive: true });
			await writeFile(
				input.outPath,
				`${JSON.stringify(prd, null, 2)}\n`,
				"utf8",
			);
		}
		return {
			ok: true,
			data: {
				mode: "split",
				prd,
				outPath: input.outPath,
				message: input.outPath
					? `Split PRD written to ${input.outPath}`
					: "Split PRD",
			},
		};
	}

	if (action === "board") {
		if (!input.inPath) {
			return {
				ok: false,
				error: sdkError("backlog.missing_input_path", "Input path required."),
			};
		}
		const payload = JSON.parse(await readFile(input.inPath, "utf8"));
		return {
			ok: true,
			data: {
				mode: "board",
				board: renderBacklogBoard(payload),
				message: "Rendered backlog board",
			},
		};
	}

	if (action === "move") {
		if (!input.inPath) {
			return {
				ok: false,
				error: sdkError("backlog.missing_input_path", "Input path required."),
			};
		}
		if (!input.storyId) {
			return {
				ok: false,
				error: sdkError("backlog.missing_story", "Story ID required."),
			};
		}
		if (!input.targetColumn) {
			return {
				ok: false,
				error: sdkError(
					"backlog.missing_target_column",
					"Target column required.",
				),
			};
		}
		const payload = JSON.parse(await readFile(input.inPath, "utf8"));
		const prd = moveBacklogStory(payload, input.storyId, input.targetColumn);
		if (input.outPath) {
			await mkdir(dirname(input.outPath), { recursive: true });
			await writeFile(
				input.outPath,
				`${JSON.stringify(prd, null, 2)}\n`,
				"utf8",
			);
		}
		return {
			ok: true,
			data: {
				mode: "move",
				prd,
				outPath: input.outPath,
				message: input.outPath
					? `Moved story ${input.storyId} into ${input.targetColumn} and wrote ${input.outPath}`
					: `Moved story ${input.storyId} into ${input.targetColumn}`,
			},
		};
	}

	if (action === "import-ralph") {
		if (!input.inPath) {
			return {
				ok: false,
				error: sdkError("backlog.missing_input_path", "Input path required."),
			};
		}
		const prd = await importBacklogIntoRalph({
			root: process.cwd(),
			path: input.inPath,
		});
		return {
			ok: true,
			data: {
				mode: "import-ralph",
				prd,
				message: "Imported backlog PRD into Ralph state",
			},
		};
	}

	if (
		action !== "split" &&
		action !== "board" &&
		action !== "move" &&
		action !== "import-ralph"
	) {
		return {
			ok: false,
			error: sdkError(
				"backlog.invalid_action",
				`Unknown subcommand: ${action}`,
			),
		};
	}

	return {
		ok: true,
		data: {
			mode: action,
			message: `backlog ${action} scaffold ready`,
		},
	};
}

const backlogBuilder = new CommandBuilder<BacklogRunInput, BacklogRunResult>()
	.meta(backlogMeta)
	.usage(backlogUsage)
	.schema(backlogSchema)
	.help(backlogHelp)
	.sdkUsage(backlogSdkUsage)
	.outputFields(backlogOutputFields)
	.examples(backlogExamples)
	.errors(backlogErrors)
	.exitCodes(backlogExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			in: { type: "string" },
			out: { type: "string" },
			"profile-command": { type: "string" },
			"max-ac": { type: "string" },
			"max-stories": { type: "string" },
			story: { type: "string" },
			to: { type: "string" },
		},
	})
	.parseInput(async ({ positionals, values }) => {
		const commandIndex = positionals.indexOf("backlog");
		const action = positionals[commandIndex + 1] as BacklogAction | undefined;
		const args = positionals.slice(commandIndex + 2);
		const profileCommandRaw =
			typeof values["profile-command"] === "string"
				? values["profile-command"]
				: undefined;
		let profileCommand: string[] | undefined;
		const maxAcceptanceCriteriaRaw =
			typeof values["max-ac"] === "string" ? values["max-ac"] : undefined;
		const maxStoriesRaw =
			typeof values["max-stories"] === "string"
				? values["max-stories"]
				: undefined;
		const targetColumnRaw =
			typeof values.to === "string" ? values.to : undefined;
		if (profileCommandRaw) {
			const parsed = JSON.parse(profileCommandRaw) as unknown;
			if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
				throw new Error(
					"--profile-command must be a JSON array of strings",
				);
			}
			profileCommand = parsed;
		}
		if (targetColumnRaw && !isBacklogBoardColumnId(targetColumnRaw)) {
			throw new Error("--to must be one of: todo, in_progress, in_review, done");
		}
		return {
			action,
			json: Boolean(values.json),
			prompt: action === "generate" ? args.join(" ").trim() : undefined,
			inPath: typeof values.in === "string" ? values.in : undefined,
			outPath: typeof values.out === "string" ? values.out : undefined,
			profileCommand,
			maxAcceptanceCriteria: maxAcceptanceCriteriaRaw
				? Number.parseInt(maxAcceptanceCriteriaRaw, 10)
				: undefined,
			maxStories: maxStoriesRaw
				? Number.parseInt(maxStoriesRaw, 10)
				: undefined,
			storyId: typeof values.story === "string" ? values.story : undefined,
			targetColumn: targetColumnRaw,
		};
	})
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson({
				schemaVersion: "1.0",
				command: "backlog",
				action: output.mode,
				timestamp: new Date().toISOString(),
				...output,
			});
			return;
		}
		if (output.mode === "help" && output.raw) {
			console.log(output.raw);
			return;
		}
		if (output.mode === "board" && output.board) {
			console.log(JSON.stringify(output.board, null, 2));
			return;
		}
		if (output.message) {
			console.log(output.message);
			if (output.prd && !output.outPath) {
				console.log(JSON.stringify(output.prd, null, 2));
			}
			if (output.errors && output.errors.length > 0) {
				for (const error of output.errors) {
					console.log(`- ${error}`);
				}
			}
		}
	})
	.onFailure((error) => {
		handleCommandError(error, [
			"backlog.missing_action",
			"backlog.missing_prompt",
			"backlog.missing_input_path",
			"backlog.missing_story",
			"backlog.missing_target_column",
			"backlog.invalid_action",
		]);
	})
	.telemetry({
		eventPrefix: "backlog",
		successMetadata: (_, output) => ({ mode: output.mode }),
		failureMetadata: (_, error) => ({ error: error.message }),
	});

export const backlogAgentDoc = backlogBuilder.buildAgentDoc(false);
export const backlogFeatureDoc = (includeChangelog: boolean) =>
	backlogBuilder.buildFeatureDoc(includeChangelog);

const backlogCommand = backlogBuilder.build();

export default backlogCommand;
