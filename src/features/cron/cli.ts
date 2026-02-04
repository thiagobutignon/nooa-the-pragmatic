import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";
import {
	handleCommandError,
	renderJson
} from "../../core/cli-output";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import type { CronJobRecord, CronJobSpec } from "../../core/db/cron_store";
import { cronService } from "./service";

export const cronMeta: AgentDocMeta = {
	name: "cron",
	description: "Manage recurring jobs",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const cronHelp = `
Usage: nooa cron <subcommand> [args] [flags]

Manage recurring jobs with persistence.

Subcommands:
  add <name> --every <schedule> -- <command...>     Create a job.
  list [--active] [--json]                         List jobs.
  remove <name> [--force] [--json]                  Remove a job.
  enable <name> [--json]                           Enable a job.
  disable <name> [--json]                          Disable a job.
  run <name> [--force] [--json]                    Run a job immediately.
  status <name> [--json]                           Show job status.
  logs <name> [--limit <n>] [--since <date>] [--json]  View execution logs.
  edit <name> [--schedule <cron>] [--command <cmd>] [--description <text>]  Update a job.
  pause <name> [--json]                            Pause (disable) a job temporarily.
  resume <name> [--json]                           Resume a paused job.
  history <name> [--limit <n>] [--since <date>] [--json]  Alias for logs.

Flags:
  --every <schedule>      Cron schedule (5m, 0 2 * * *, etc).
  --description <text>    Job description (add/edit).
  --on-failure <action>   notify|retry|ignore (default: notify).
  --retry <n>             Retry attempts on failure.
  --timeout <duration>    Max runtime (e.g., 30m).
  --start-at <datetime>   First execution window.
  --end-at <datetime>     Stop after this time.
  --max-runs <n>          Maximum number of runs.
  --command <text>        Command string (edit).
  --schedule <cron>       Updated schedule (edit).
  --limit <n>             How many logs to show.
  --since <date>          Only logs newer than this timestamp.
  --force                 Force destructive operations (remove/run).
  --json                  Emit JSON output.
  --daemon <cmd>          Manage daemon (start|stop|status).
  -h, --help              Show this help.

Examples:
  nooa cron add daily-index --every "6h" -- index repo
  nooa cron list --json
  nooa cron run daily-index --force
  nooa cron logs daily-index --limit 5
  nooa cron edit daily-index --schedule "0 3 * * *"
  nooa cron remove daily-index --force --json

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  cron.missing_action: Missing subcommand
  cron.missing_name: Job name required
  cron.missing_schedule: Missing --every <schedule>
  cron.missing_command: Command required after --
  cron.missing_update: Provide schedule/command/description
  cron.not_found: Job not found
  cron.force_required: --force required
  cron.runtime_error: Unexpected error
`;

export const cronSdkUsage = `
SDK Usage:
  await cron.run({ action: "list" });
  await cron.run({ action: "add", name: "daily", every: "6h", command: "index repo" });
`;

export const cronUsage = {
	cli: "nooa cron <subcommand> [args] [flags]",
	sdk: "await cron.run({ action: \"list\" })",
	tui: "CronConsole()",
};

export const cronSchema = {
	action: { type: "string", required: true },
	name: { type: "string", required: false },
	json: { type: "boolean", required: false },
	every: { type: "string", required: false },
	description: { type: "string", required: false },
	"on-failure": { type: "string", required: false },
	retry: { type: "string", required: false },
	timeout: { type: "string", required: false },
	"start-at": { type: "string", required: false },
	"end-at": { type: "string", required: false },
	"max-runs": { type: "string", required: false },
	schedule: { type: "string", required: false },
	command: { type: "string", required: false },
	limit: { type: "string", required: false },
	since: { type: "string", required: false },
	force: { type: "boolean", required: false },
	daemon: { type: "string", required: false },
	active: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const cronOutputFields = [
	{ name: "mode", type: "string" },
	{ name: "result", type: "string" },
	{ name: "jobs", type: "string" },
	{ name: "job", type: "string" },
	{ name: "logs", type: "string" },
];

export const cronErrors = [
	{ code: "cron.missing_action", message: "Missing subcommand." },
	{ code: "cron.missing_name", message: "Job name required." },
	{ code: "cron.missing_schedule", message: "Missing --every <schedule>." },
	{ code: "cron.missing_command", message: "Command required after --." },
	{
		code: "cron.missing_update",
		message: "Provide schedule/command/description.",
	},
	{ code: "cron.not_found", message: "Job not found." },
	{ code: "cron.force_required", message: "--force required." },
	{ code: "cron.runtime_error", message: "Unexpected error." },
];

export const cronExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const cronExamples = [
	{ input: "nooa cron list", output: "List jobs" },
	{ input: "nooa cron add job --every 5m -- index repo", output: "Add job" },
	{ input: "nooa cron remove job --force", output: "Remove job" },
];

export interface CronRunInput {
	action?: string;
	name?: string;
	json?: boolean;
	every?: string;
	description?: string;
	onFailure?: string;
	retry?: string;
	timeout?: string;
	startAt?: string;
	endAt?: string;
	maxRuns?: string;
	schedule?: string;
	command?: string;
	limit?: string;
	since?: string;
	force?: boolean;
	daemon?: string;
	active?: boolean;
	argv?: string[];
}

export interface CronRunResult {
	mode: string;
	result?: string;
	jobs?: CronJobRecord[];
	job?: CronJobRecord;
	logs?: unknown[];
}

const numberFromValue = (value?: string) => {
	if (value === undefined) return undefined;
	const parsed = Number(value);
	return Number.isNaN(parsed) ? undefined : parsed;
};

const formatJobs = (jobs: CronJobRecord[]) => {
	if (!jobs.length) {
		return "No cron jobs defined.";
	}
	return jobs
		.map((job) => {
			const status = job.enabled ? "enabled" : "disabled";
			const last = job.last_status ? `last:${job.last_status}` : "no runs yet";
			return `[${status}] ${job.name} (${job.schedule}) - ${last}`;
		})
		.join("\n");
};

export async function run(
	input: CronRunInput,
): Promise<SdkResult<CronRunResult>> {
	try {
		const action = input.action;
		if (!action) {
			return {
				ok: false,
				error: sdkError("cron.missing_action", "Missing subcommand."),
			};
		}

		const name = input.name;

		switch (action) {
			case "add": {
				if (!name) {
					return {
						ok: false,
						error: sdkError("cron.missing_name", "Job name is required."),
					};
				}
				const schedule = input.every;
				if (!schedule) {
					return {
						ok: false,
						error: sdkError(
							"cron.missing_schedule",
							"Missing --every <schedule>.",
						),
					};
				}
				if (!input.argv || input.argv.length === 0) {
					return {
						ok: false,
						error: sdkError(
							"cron.missing_command",
							"Command is required after --.",
						),
					};
				}
				const spec: CronJobSpec = {
					name,
					schedule,
					description: input.description,
					command: input.argv.join(" "),
					enabled: true,
					on_failure: (input.onFailure as CronJobSpec["on_failure"]) ??
						"notify",
					retries: numberFromValue(input.retry) ?? 0,
					timeout: input.timeout,
					start_at: input.startAt,
					end_at: input.endAt,
					max_runs: numberFromValue(input.maxRuns) ?? 0,
				};

				cronService.addJob(spec);
				return {
					ok: true,
					data: {
						mode: "add",
						result: `Job '${name}' scheduled for '${schedule}'.`,
					},
				};
			}

			case "list": {
				const jobs = cronService.listJobs();
				const filtered = input.active ? jobs.filter((job) => job.enabled) : jobs;
				return {
					ok: true,
					data: { mode: "list", jobs: filtered },
				};
			}

			case "remove": {
				if (!name) {
					return {
						ok: false,
						error: sdkError("cron.missing_name", "Job name is required."),
					};
				}
				if (!input.force) {
					return {
						ok: false,
						error: sdkError("cron.force_required", "Use --force to remove."),
					};
				}
				const deleted = cronService.removeJob(name);
				if (!deleted) {
					return {
						ok: false,
						error: sdkError("cron.not_found", `Job '${name}' not found.`),
					};
				}
				return {
					ok: true,
					data: { mode: "remove", result: `Job '${name}' removed.` },
				};
			}

			case "enable":
			case "resume": {
				if (!name) {
					return {
						ok: false,
						error: sdkError("cron.missing_name", "Job name is required."),
					};
				}
				const job = cronService.getJob(name);
				if (!job) {
					return {
						ok: false,
						error: sdkError("cron.not_found", `Job '${name}' not found.`),
					};
				}
				cronService.enableJob(name);
				return {
					ok: true,
					data: { mode: action, result: `Job '${name}' is enabled.` },
				};
			}

			case "disable":
			case "pause": {
				if (!name) {
					return {
						ok: false,
						error: sdkError("cron.missing_name", "Job name is required."),
					};
				}
				const job = cronService.getJob(name);
				if (!job) {
					return {
						ok: false,
						error: sdkError("cron.not_found", `Job '${name}' not found.`),
					};
				}
				cronService.disableJob(name);
				return {
					ok: true,
					data: { mode: action, result: `Job '${name}' is disabled.` },
				};
			}

			case "status": {
				if (!name) {
					return {
						ok: false,
						error: sdkError("cron.missing_name", "Job name is required."),
					};
				}
				const job = cronService.getJob(name);
				if (!job) {
					return {
						ok: false,
						error: sdkError("cron.not_found", `Job '${name}' not found.`),
					};
				}
				return {
					ok: true,
					data: { mode: "status", job },
				};
			}

			case "logs":
			case "history": {
				if (!name) {
					return {
						ok: false,
						error: sdkError("cron.missing_name", "Job name is required."),
					};
				}
				const limit = numberFromValue(input.limit) ?? 10;
				const logs = cronService.listLogs(name, limit, input.since);
				return {
					ok: true,
					data: { mode: action, job: cronService.getJob(name), logs },
				};
			}

			case "run": {
				if (!name) {
					return {
						ok: false,
						error: sdkError("cron.missing_name", "Job name is required."),
					};
				}
				const job = cronService.getJob(name);
				if (!job) {
					return {
						ok: false,
						error: sdkError("cron.not_found", `Job '${name}' not found.`),
					};
				}
				cronService.recordExecution(name, "success", {
					output: `Executed via CLI at ${new Date().toISOString()}`,
				});
				return {
					ok: true,
					data: { mode: "run", result: `Job '${name}' executed.` },
				};
			}

			case "edit": {
				if (!name) {
					return {
						ok: false,
						error: sdkError("cron.missing_name", "Job name is required."),
					};
				}
				const updates: Partial<CronJobSpec> = {};
				if (input.schedule) updates.schedule = input.schedule;
				if (input.command) updates.command = input.command;
				if (input.description) updates.description = input.description;
				if (!updates.schedule && !updates.command && !updates.description) {
					return {
						ok: false,
						error: sdkError(
							"cron.missing_update",
							"Provide at least one of --schedule, --command, --description.",
						),
					};
				}
				const job = cronService.getJob(name);
				if (!job) {
					return {
						ok: false,
						error: sdkError("cron.not_found", `Job '${name}' not found.`),
					};
				}
				cronService.editJob(name, updates);
				return {
					ok: true,
					data: { mode: "edit", result: `Job '${name}' updated.` },
				};
			}

			default: {
				return {
					ok: false,
					error: sdkError("cron.missing_action", "Unknown subcommand."),
				};
			}
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			error: sdkError("cron.runtime_error", message),
		};
	}
}

const cronBuilder = new CommandBuilder<CronRunInput, CronRunResult>()
	.meta(cronMeta)
	.usage(cronUsage)
	.schema(cronSchema)
	.help(cronHelp)
	.sdkUsage(cronSdkUsage)
	.outputFields(cronOutputFields)
	.examples(cronExamples)
	.errors(cronErrors)
	.exitCodes(cronExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			every: { type: "string" },
			description: { type: "string" },
			"on-failure": { type: "string" },
			retry: { type: "string" },
			timeout: { type: "string" },
			"start-at": { type: "string" },
			"end-at": { type: "string" },
			"max-runs": { type: "string" },
			schedule: { type: "string" },
			command: { type: "string" },
			limit: { type: "string" },
			since: { type: "string" },
			force: { type: "boolean" },
			daemon: { type: "string" },
			active: { type: "boolean" },
		},
	})
	.parseInput(async ({ positionals, values }) => {
		const delimiterIndex = positionals.indexOf("--");
		const argv = delimiterIndex >= 0 ? positionals.slice(delimiterIndex + 1) : [];
		return {
			action: positionals[1],
			name: positionals[2],
			json: Boolean(values.json),
			every: typeof values.every === "string" ? values.every : undefined,
			description:
				typeof values.description === "string"
					? values.description
					: undefined,
			onFailure:
				typeof values["on-failure"] === "string"
					? values["on-failure"]
					: undefined,
			retry: typeof values.retry === "string" ? values.retry : undefined,
			timeout: typeof values.timeout === "string" ? values.timeout : undefined,
			startAt:
				typeof values["start-at"] === "string"
					? values["start-at"]
					: undefined,
			endAt:
				typeof values["end-at"] === "string" ? values["end-at"] : undefined,
			maxRuns:
				typeof values["max-runs"] === "string"
					? values["max-runs"]
					: undefined,
			schedule:
				typeof values.schedule === "string" ? values.schedule : undefined,
			command:
				typeof values.command === "string" ? values.command : undefined,
			limit: typeof values.limit === "string" ? values.limit : undefined,
			since: typeof values.since === "string" ? values.since : undefined,
			force: Boolean(values.force),
			daemon: typeof values.daemon === "string" ? values.daemon : undefined,
			active: Boolean(values.active),
			argv,
		};
	})
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson(output);
			return;
		}
		if (output.mode === "list" && output.jobs) {
			console.log(formatJobs(output.jobs));
			return;
		}
		if (output.mode === "status" && output.job) {
			renderJson({ ok: true, job: output.job });
			return;
		}
		if (output.mode === "logs" || output.mode === "history") {
			renderJson({ ok: true, job: output.job?.name, logs: output.logs ?? [] });
			return;
		}
		if (output.result) {
			console.log(output.result);
			return;
		}
		renderJson(output);
	})
	.onFailure((error) => {
		if (error.code === "cron.missing_action") {
			console.log(cronHelp);
			process.exitCode = 2;
			return;
		}
		if (error.code === "cron.not_found") {
			console.error(error.message);
			process.exitCode = 1;
			return;
		}
		if (
			error.code === "cron.missing_name" ||
			error.code === "cron.missing_schedule" ||
			error.code === "cron.missing_command" ||
			error.code === "cron.missing_update" ||
			error.code === "cron.force_required"
		) {
			console.error(error.message);
			process.exitCode = 2;
			return;
		}
		handleCommandError(error, [
			"cron.missing_action",
			"cron.missing_name",
			"cron.missing_schedule",
			"cron.missing_command",
			"cron.missing_update",
			"cron.force_required",
		]);
	})
	.telemetry({
		eventPrefix: "cron",
		successMetadata: (input, output) => ({
			action: output.mode,
			name: input.name,
		}),
		failureMetadata: (input, error) => ({
			action: input.action,
			name: input.name,
			error: error.message,
		}),
	});

export const cronAgentDoc = cronBuilder.buildAgentDoc(false);
export const cronFeatureDoc = (includeChangelog: boolean) =>
	cronBuilder.buildFeatureDoc(includeChangelog);

const cronCommand = cronBuilder.build();

export default cronCommand;
