import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import {
	handleCommandError,
	renderJson
} from "../../core/cli-output";
import type { EventBus } from "../../core/event-bus";
import { getCurrentBranch } from "../../core/integrations/git";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import { sdkError } from "../../core/types";
import { executeReview } from "../review/execute";

export const prMeta: AgentDocMeta = {
	name: "pr",
	description: "Manage GitHub Pull Requests",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const prHelp = `
Usage: nooa pr <subcommand> [flags]

Manage GitHub Pull Requests.

Subcommands:
  create --title <t> --body <b>    Create a new PR from current branch.
  list                            List open PRs for the repository.
  review <number>                 Review a specific PR.
  merge <number> --method <m>     Merge a PR (merge|squash|rebase).
  close <number>                  Close a PR without merging.
  comment <number> --body <md>    Add a markdown comment to a PR.
  status <number>                 Show checks, labels, approvals for a PR.

Flags:
  --repo <owner/repo>   Specify repository (otherwise inferred from remote).
  --method <m>          Merge method: merge, squash, rebase.
  --title <t>           Merge commit title (merge only).
  --message <m>         Merge commit message (merge only).
  --body <md>           Comment body in markdown (or via stdin).
  --json                Output as JSON.
  -h, --help            Show help.

Exit Codes:
  0: Success
  1: Runtime Error
  2: Validation Error

Error Codes:
  pr.missing_action: Missing subcommand
  pr.missing_number: PR number required
  pr.missing_title: Missing --title
  pr.missing_body: Missing --body
  pr.missing_comment: Comment body required
  pr.invalid_method: Invalid merge method
  pr.unknown_action: Unknown subcommand
  pr.runtime_error: Unexpected error
`;

export const prSdkUsage = `
SDK Usage:
  const result = await pr.run({ action: "list" });
  if (result.ok) console.log(result.data.prs);
`;

export const prUsage = {
	cli: "nooa pr <subcommand> [flags]",
	sdk: "await pr.run({ action: \"list\" })",
	tui: "PrConsole()",
};

export const prSchema = {
	action: { type: "string", required: true },
	number: { type: "number", required: false },
	title: { type: "string", required: false },
	body: { type: "string", required: false },
	method: { type: "string", required: false },
	message: { type: "string", required: false },
	repo: { type: "string", required: false },
	json: { type: "boolean", required: false },
} satisfies SchemaSpec;

export const prOutputFields = [
	{ name: "action", type: "string" },
	{ name: "result", type: "string" },
	{ name: "prs", type: "string" },
	{ name: "review", type: "string" },
	{ name: "status", type: "string" },
];

export const prErrors = [
	{ code: "pr.missing_action", message: "Missing subcommand." },
	{ code: "pr.missing_number", message: "PR number required." },
	{ code: "pr.missing_title", message: "Missing --title." },
	{ code: "pr.missing_body", message: "Missing --body." },
	{ code: "pr.missing_comment", message: "Comment body required." },
	{ code: "pr.invalid_method", message: "Invalid merge method." },
	{ code: "pr.unknown_action", message: "Unknown subcommand." },
	{ code: "pr.runtime_error", message: "Unexpected error." },
];

export const prExitCodes = [
	{ value: "0", description: "Success" },
	{ value: "1", description: "Runtime error" },
	{ value: "2", description: "Validation error" },
];

export const prExamples = [
	{ input: "nooa pr list", output: "List PRs" },
	{ input: "nooa pr review 12", output: "Review PR" },
	{ input: "nooa pr create --title T --body B", output: "Create PR" },
];

type GhPrListItem = {
	number?: number;
	title?: string;
	url?: string;
	author?: { login?: string };
};

type GhLabel = { name?: string };

type GhCheck = { conclusion?: string };

type GhStatus = {
	number?: number;
	title?: string;
	state?: string;
	labels?: GhLabel[];
	reviewDecision?: string;
	statusCheckRollup?: GhCheck[];
};

export interface PrRunInput {
	action?: string;
	number?: number;
	title?: string;
	body?: string;
	method?: string;
	message?: string;
	repo?: string;
	json?: boolean;
	bus?: EventBus;
}

export interface PrRunResult {
	action: string;
	number?: number;
	result?: unknown;
	prs?: GhPrListItem[];
	review?: unknown;
	status?: GhStatus;
}

export async function run(input: PrRunInput): Promise<SdkResult<PrRunResult>> {
	try {
		const action = input.action;
		if (!action) {
			return {
				ok: false,
				error: sdkError("pr.missing_action", "Missing subcommand."),
			};
		}

		const {
			ghPrCreate,
			ghPrList,
			ghPrDiff,
			ghMergePr,
			ghClosePr,
			ghCommentPr,
			ghStatusPr,
		} = await import("./gh");

		switch (action) {
			case "create": {
				if (!input.title) {
					return {
						ok: false,
						error: sdkError("pr.missing_title", "Missing --title."),
					};
				}
				if (!input.body) {
					return {
						ok: false,
						error: sdkError("pr.missing_body", "Missing --body."),
					};
				}
				const head = await getCurrentBranch();
				const base = process.env.NOOA_PR_BASE || "main";
				const result = await ghPrCreate({
					title: input.title,
					body: input.body,
					head,
					base,
				});
				return { ok: true, data: { action, result } };
			}
			case "list": {
				const prs = (await ghPrList()) as GhPrListItem[];
				return { ok: true, data: { action, prs } };
			}
			case "review": {
				if (!input.number) {
					return {
						ok: false,
						error: sdkError("pr.missing_number", "PR number required."),
					};
				}
				const diff = await ghPrDiff(input.number);
				const { content, result } = await executeReview(
					{
						diff,
						json: input.json,
					},
					input.bus,
				);
				return { ok: true, data: { action, review: { content, result } } };
			}
			case "merge": {
				if (!input.number) {
					return {
						ok: false,
						error: sdkError("pr.missing_number", "PR number required."),
					};
				}
				const method = input.method || "merge";
				if (!["merge", "squash", "rebase"].includes(method)) {
					return {
						ok: false,
						error: sdkError("pr.invalid_method", "Invalid merge method."),
					};
				}
				const result = await ghMergePr({
					number: input.number,
					method: method as "merge" | "squash" | "rebase",
					title: input.title,
					message: input.message,
				});
				return { ok: true, data: { action, result, number: input.number } };
			}
			case "close": {
				if (!input.number) {
					return {
						ok: false,
						error: sdkError("pr.missing_number", "PR number required."),
					};
				}
				const result = await ghClosePr(input.number);
				return { ok: true, data: { action, result, number: input.number } };
			}
			case "comment": {
				if (!input.number) {
					return {
						ok: false,
						error: sdkError("pr.missing_number", "PR number required."),
					};
				}
				const { getStdinText } = await import("../../core/io");
				const body = input.body || (await getStdinText());
				if (!body) {
					return {
						ok: false,
						error: sdkError("pr.missing_comment", "Comment body required."),
					};
				}
				const result = await ghCommentPr(input.number, body);
				return { ok: true, data: { action, result, number: input.number } };
			}
			case "status": {
				if (!input.number) {
					return {
						ok: false,
						error: sdkError("pr.missing_number", "PR number required."),
					};
				}
				const status = (await ghStatusPr(input.number)) as GhStatus;
				return { ok: true, data: { action, status, number: input.number } };
			}
			default:
				return {
					ok: false,
					error: sdkError("pr.unknown_action", "Unknown subcommand."),
				};
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, error: sdkError("pr.runtime_error", message) };
	}
}

const prBuilder = new CommandBuilder<PrRunInput, PrRunResult>()
	.meta(prMeta)
	.usage(prUsage)
	.schema(prSchema)
	.help(prHelp)
	.sdkUsage(prSdkUsage)
	.outputFields(prOutputFields)
	.examples(prExamples)
	.errors(prErrors)
	.exitCodes(prExitCodes)
	.options({
		options: {
			...buildStandardOptions(),
			title: { type: "string" },
			body: { type: "string" },
			method: { type: "string" },
			message: { type: "string" },
			repo: { type: "string" },
		},
	})
	.parseInput(async ({ positionals, values, bus }) => {
		const numberRaw = positionals[2];
		const parsedNumber = numberRaw ? Number.parseInt(numberRaw, 10) : undefined;
		return {
			action: positionals[1],
			number: Number.isNaN(parsedNumber) ? undefined : parsedNumber,
			title: typeof values.title === "string" ? values.title : undefined,
			body: typeof values.body === "string" ? values.body : undefined,
			method: typeof values.method === "string" ? values.method : undefined,
			message: typeof values.message === "string" ? values.message : undefined,
			repo: typeof values.repo === "string" ? values.repo : undefined,
			json: Boolean(values.json),
			bus,
		};
	})
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson(output);
			return;
		}

		switch (output.action) {
			case "create":
				console.log(`URL: ${(output.result as { url?: string })?.url || "(no url)"}`);
				break;
			case "list":
				console.log("\nOpen PRs:");
				if (!output.prs || output.prs.length === 0) {
					console.log("No open PRs found.");
					return;
				}
				output.prs.forEach((pr) => {
					const author = pr.author?.login || "unknown";
					console.log(`#${pr.number ?? "?"}  ${pr.title ?? ""} (${author})`);
					if (pr.url) console.log(`    ${pr.url}`);
				});
				break;
			case "review": {
				const review = output.review as { content?: string } | undefined;
				if (review?.content) {
					console.log("\n--- Review Results ---\n");
					console.log(review.content);
				}
				break;
			}
			case "merge":
				console.log(`Merged PR #${output.number ?? "?"}.`);
				break;
			case "close":
				console.log(`Closed PR #${output.number ?? "?"}.`);
				break;
			case "comment":
				console.log(`Commented on PR #${output.number ?? "?"}.`);
				break;
			case "status": {
				const status = output.status;
				if (!status) return;
				const labels = Array.isArray(status.labels)
					? status.labels
							.map((label) => label.name)
							.filter((name): name is string => Boolean(name))
					: [];
				const approvals = status.reviewDecision === "APPROVED" ? 1 : 0;
				const checks = Array.isArray(status.statusCheckRollup)
					? status.statusCheckRollup
					: [];
				const passed = checks.filter((c) => c.conclusion === "SUCCESS").length;
				const failed = checks.filter((c) => c.conclusion === "FAILURE").length;
				console.log(`#${status.number ?? "?"} ${status.title ?? ""}`);
				console.log(`State: ${status.state ?? "unknown"}`);
				console.log(`Approvals: ${approvals}`);
				console.log(`Labels: ${labels.join(", ") || "(none)"}`);
				console.log(`Checks: ${passed}/${checks.length} passed, ${failed} failed`);
				break;
			}
			default:
				break;
		}
	})
	.onFailure((error) => {
		handleCommandError(error, [
			"pr.missing_action",
			"pr.missing_number",
			"pr.missing_title",
			"pr.missing_body",
			"pr.missing_comment",
			"pr.invalid_method",
			"pr.unknown_action",
		]);
	})
	.telemetry({
		eventPrefix: "pr",
		successMetadata: (input) => ({ action: input.action }),
		failureMetadata: (input, error) => ({ action: input.action, error: error.message }),
	});

export const prAgentDoc = prBuilder.buildAgentDoc(false);
export const prFeatureDoc = (includeChangelog: boolean) =>
	prBuilder.buildFeatureDoc(includeChangelog);

const prCommand = prBuilder.build();

export default prCommand;
