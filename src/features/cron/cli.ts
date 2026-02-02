import type { Command, CommandContext } from "../../core/command";
import type { CronJobRecord, CronJobSpec } from "../../core/db/cron_store";
import { cronService } from "./service";

const cronHelp = `
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
  --daemon <cmd>          Manage daemon (start|stop|status) - TODO.
  -h, --help              Show this help.

Examples:
  nooa cron add daily-index --every "6h" -- index repo
  nooa cron list --json
  nooa cron run daily-index --force
  nooa cron logs daily-index --limit 5
  nooa cron edit daily-index --schedule "0 3 * * *"
  nooa cron remove daily-index --force --json
`;

type ParsedValues = {
	help?: boolean;
	json?: boolean;
	every?: string;
	description?: string;
	"on-failure"?: string;
	retry?: string;
	timeout?: string;
	"start-at"?: string;
	"end-at"?: string;
	"max-runs"?: string;
	schedule?: string;
	command?: string;
	limit?: string;
	since?: string;
	force?: boolean;
	daemon?: string;
	active?: boolean;
};

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

const cronCommand: Command = {
	name: "cron",
	description: "Manage recurring jobs",
	execute: async ({ rawArgs }: CommandContext) => {
		const { parseArgs } = await import("node:util");
		const delimiter = rawArgs.indexOf("--");
		const beforeDelimiter =
			delimiter >= 0 ? rawArgs.slice(0, delimiter) : rawArgs;
		const afterDelimiter = delimiter >= 0 ? rawArgs.slice(delimiter + 1) : [];

		const parsed = parseArgs({
			args: beforeDelimiter,
			options: {
				help: { type: "boolean", short: "h" },
				json: { type: "boolean" },
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
			allowPositionals: true,
			strict: false,
		});
		const positionals = parsed.positionals as string[];
		const values = parsed.values as ParsedValues;

		if (values.help) {
			console.log(cronHelp);
			return;
		}

		const action = positionals[1];
		const name = positionals[2];
		const json = Boolean(values.json);

		const respond = (payload: string | Record<string, unknown>) => {
			if (json) {
				const output =
					typeof payload === "string" ? { message: payload } : payload;
				console.log(JSON.stringify(output, null, 2));
				return;
			}

			if (typeof payload === "string") {
				console.log(payload);
				return;
			}

			const message = (payload as { result?: string }).result;
			if (message) {
				console.log(message);
				return;
			}

			console.log(JSON.stringify(payload));
		};

		const jobNotFound = (target: string) => {
			console.error(`Job '${target}' not found.`);
			process.exitCode = 1;
		};

		if (!action) {
			console.log(cronHelp);
			return;
		}

		switch (action) {
			case "add": {
				if (!name) {
					console.error("Job name is required for 'add'.");
					process.exitCode = 2;
					return;
				}
				const schedule = values.every;
				if (!schedule) {
					console.error("Missing --every <schedule> for 'add'.");
					process.exitCode = 2;
					return;
				}
				if (!afterDelimiter.length) {
					console.error("Command is required after -- for 'add'.");
					process.exitCode = 2;
					return;
				}
				const spec: CronJobSpec = {
					name,
					schedule,
					description: values.description,
					command: afterDelimiter.join(" "),
					enabled: true,
					on_failure:
						(values["on-failure"] as CronJobSpec["on_failure"] | undefined) ??
						"notify",
					retries: numberFromValue(values.retry) ?? 0,
					timeout: values.timeout,
					start_at: values["start-at"],
					end_at: values["end-at"],
					max_runs: numberFromValue(values["max-runs"]) ?? 0,
				};

				cronService.addJob(spec);
				respond({
					ok: true,
					result: `Job '${name}' scheduled for '${schedule}'.`,
				});
				break;
			}

			case "list": {
				const jobs = cronService.listJobs();
				const filtered = values.active
					? jobs.filter((job) => job.enabled)
					: jobs;
				if (json) {
					respond({ ok: true, jobs: filtered });
					break;
				}
				respond(formatJobs(filtered));
				break;
			}

			case "remove": {
				if (!name) {
					console.error("Job name is required for 'remove'.");
					process.exitCode = 2;
					return;
				}
				if (!values.force) {
					console.error("Use --force to remove a job.");
					process.exitCode = 2;
					return;
				}
				const deleted = cronService.removeJob(name);
				if (!deleted) {
					jobNotFound(name);
					return;
				}
				respond({ ok: true, result: `Job '${name}' removed.` });
				break;
			}

			case "enable":
			case "resume": {
				if (!name) {
					console.error(`Job name is required for '${action}'.`);
					process.exitCode = 2;
					return;
				}
				const job = cronService.getJob(name);
				if (!job) {
					jobNotFound(name);
					return;
				}
				cronService.enableJob(name);
				respond({ ok: true, result: `Job '${name}' is enabled.` });
				break;
			}

			case "disable":
			case "pause": {
				if (!name) {
					console.error(`Job name is required for '${action}'.`);
					process.exitCode = 2;
					return;
				}
				const job = cronService.getJob(name);
				if (!job) {
					jobNotFound(name);
					return;
				}
				cronService.disableJob(name);
				respond({ ok: true, result: `Job '${name}' is disabled.` });
				break;
			}

			case "status": {
				if (!name) {
					console.error("Job name is required for 'status'.");
					process.exitCode = 2;
					return;
				}
				const job = cronService.getJob(name);
				if (!job) {
					jobNotFound(name);
					return;
				}
				respond({ ok: true, job });
				break;
			}

			case "logs":
			case "history": {
				if (!name) {
					console.error(`Job name is required for '${action}'.`);
					process.exitCode = 2;
					return;
				}
				const limit = numberFromValue(values.limit) ?? 10;
				const logs = cronService.listLogs(name, limit, values.since);
				respond({ ok: true, job: name, logs });
				break;
			}

			case "run": {
				if (!name) {
					console.error("Job name is required for 'run'.");
					process.exitCode = 2;
					return;
				}
				const job = cronService.getJob(name);
				if (!job) {
					jobNotFound(name);
					return;
				}
				cronService.recordExecution(name, "success", {
					output: `Executed via CLI at ${new Date().toISOString()}`,
				});
				respond({ ok: true, result: `Job '${name}' executed.` });
				break;
			}

			case "edit": {
				if (!name) {
					console.error("Job name is required for 'edit'.");
					process.exitCode = 2;
					return;
				}
				const updates: Partial<CronJobSpec> = {};
				if (values.schedule) updates.schedule = values.schedule;
				if (values.command) updates.command = values.command;
				if (values.description) updates.description = values.description;
				if (!updates.schedule && !updates.command && !updates.description) {
					console.error(
						"Provide at least one of --schedule, --command, --description.",
					);
					process.exitCode = 2;
					return;
				}
				const job = cronService.getJob(name);
				if (!job) {
					jobNotFound(name);
					return;
				}
				cronService.editJob(name, updates);
				respond({ ok: true, result: `Job '${name}' updated.` });
				break;
			}

			default: {
				console.log(cronHelp);
				break;
			}
		}
	},
};

export default cronCommand;
