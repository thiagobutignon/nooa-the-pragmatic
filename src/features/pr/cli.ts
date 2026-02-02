// src/features/pr/cli.ts

import { parseArgs } from "node:util";
import type { Command, CommandContext } from "../../core/command";
import { getCurrentBranch } from "../../core/integrations/git";
import { executeReview } from "../review/execute";

const prHelp = `
Usage: nooa pr <subcommand> [flags]

Manage GitHub Pull Requests.

Subcommands:
  create --title <t> --body <b>    Create a new PR from current branch.
  list                              List open PRs for the repository.
  review <number>                   Review a specific PR.
  merge <number> --method <m>       Merge a PR (merge|squash|rebase).
  close <number>                    Close a PR without merging.
  comment <number> --body <md>      Add a markdown comment to a PR.
  status <number>                   Show checks, labels, approvals for a PR.

Flags:
  --repo <owner/repo>   Specify repository (otherwise inferred from remote).
  --method <m>          Merge method: merge, squash, rebase.
  --title <t>           Merge commit title (merge only).
  --message <m>         Merge commit message (merge only).
  --body <md>           Comment body in markdown (or via stdin).
  --json                Output as JSON.
  -h, --help            Show help.
`;

const prCommand: Command = {
	name: "pr",
	description: "Manage GitHub PRs",
	execute: async ({ rawArgs, bus }: CommandContext) => {
		const { values, positionals } = parseArgs({
			args: rawArgs,
			options: {
				help: { type: "boolean", short: "h" },
				json: { type: "boolean" },
				title: { type: "string" },
				body: { type: "string" },
				method: { type: "string" },
				message: { type: "string" },
				repo: { type: "string" },
			},
			allowPositionals: true,
			strict: false,
		});

		if (values.help) {
			console.log(prHelp);
			return;
		}

		const sub = positionals[1];
		if (!sub) {
			console.log(prHelp);
			return;
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

		try {
			if (sub === "create") {
				const title = values.title as string;
				const body = values.body as string;
				const head = await getCurrentBranch();
				const base = process.env.NOOA_PR_BASE || "main";

				if (!title || !body) {
					throw new Error("Missing --title or --body for PR creation.");
				}

				const result = await ghPrCreate({ title, body, head, base });
				if (values.json)
					console.log(JSON.stringify({ ok: true, result }, null, 2));
				else console.log(`URL: ${result.url || "(no url)"}`);
			} else if (sub === "list") {
				const prs = (await ghPrList()) as GhPrListItem[];
				if (values.json) {
					console.log(JSON.stringify({ ok: true, prs }, null, 2));
				} else {
					console.log("\nOpen PRs:");
					if (prs.length === 0) {
						console.log("No open PRs found.");
					} else {
						prs.forEach((pr) => {
							const author = pr.author?.login || "unknown";
							console.log(
								`#${pr.number ?? "?"}  ${pr.title ?? ""} (${author})`,
							);
							if (pr.url) console.log(`    ${pr.url}`);
						});
					}
				}
			} else if (sub === "review") {
				const prNumber = parseInt(positionals[2], 10);
				if (Number.isNaN(prNumber)) throw new Error("PR number is required.");

				if (!values.json) console.log(`Fetching diff for PR #${prNumber}...`);
				const diff = await ghPrDiff(prNumber);

				if (!values.json) console.log("Reviewing changes...");
				const { content, result } = await executeReview(
					{
						diff,
						json: !!values.json,
					},
					bus,
				);

				if (values.json) {
					console.log(
						JSON.stringify(
							{ ok: true, review: result || { content } },
							null,
							2,
						),
					);
				} else {
					console.log("\n--- Review Results ---\n");
					console.log(content);
				}
			} else if (sub === "merge") {
				const prNumber = parseInt(positionals[2], 10);
				if (Number.isNaN(prNumber)) throw new Error("PR number is required.");
				const method = (values.method as string) || "merge";
				if (!["merge", "squash", "rebase"].includes(method)) {
					throw new Error(
						"Invalid merge method. Use merge, squash, or rebase.",
					);
				}

				const result = await ghMergePr({
					number: prNumber,
					method: method as "merge" | "squash" | "rebase",
					title: values.title as string,
					message: values.message as string,
				});

				if (values.json) {
					console.log(JSON.stringify({ ok: true, result }, null, 2));
				} else {
					console.log(`Merged PR #${prNumber} with ${method}.`);
				}
			} else if (sub === "close") {
				const prNumber = parseInt(positionals[2], 10);
				if (Number.isNaN(prNumber)) throw new Error("PR number is required.");

				const result = await ghClosePr(prNumber);
				if (values.json) {
					console.log(JSON.stringify({ ok: true, result }, null, 2));
				} else {
					console.log(`Closed PR #${prNumber}.`);
				}
			} else if (sub === "comment") {
				const prNumber = parseInt(positionals[2], 10);
				if (Number.isNaN(prNumber)) throw new Error("PR number is required.");
				const { getStdinText } = await import("../../core/io");
				const body = (values.body as string) || (await getStdinText());
				if (!body) throw new Error("Comment body is required.");

				const result = await ghCommentPr(prNumber, body);
				if (values.json) {
					console.log(JSON.stringify({ ok: true, result }, null, 2));
				} else {
					console.log(`Commented on PR #${prNumber}.`);
				}
			} else if (sub === "status") {
				const prNumber = parseInt(positionals[2], 10);
				if (Number.isNaN(prNumber)) throw new Error("PR number is required.");

				const status = (await ghStatusPr(prNumber)) as GhStatus;
				if (values.json) {
					console.log(JSON.stringify({ ok: true, status }, null, 2));
				} else {
					const labels = Array.isArray(status.labels)
						? status.labels
								.map((label) => label.name)
								.filter((name): name is string => Boolean(name))
						: [];
					const approvals = status.reviewDecision === "APPROVED" ? 1 : 0;
					const checks = Array.isArray(status.statusCheckRollup)
						? status.statusCheckRollup
						: [];

					const passed = checks.filter(
						(c) => c.conclusion === "SUCCESS",
					).length;
					const failed = checks.filter(
						(c) => c.conclusion === "FAILURE",
					).length;

					console.log(`#${status.number ?? "?"} ${status.title ?? ""}`);
					console.log(`State: ${status.state ?? "unknown"}`);
					console.log(`Approvals: ${approvals}`);
					console.log(`Labels: ${labels.join(", ") || "(none)"}`);
					console.log(
						`Checks: ${passed}/${checks.length} passed, ${failed} failed`,
					);
				}
			} else {
				console.error(`Unknown subcommand: ${sub}`);
				console.log(prHelp);
				process.exitCode = 1;
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const msg = `Error executing pr ${sub || "unknown"}: ${message}`;
			if (values.json) console.log(JSON.stringify({ ok: false, error: msg }));
			else console.error(msg);
			process.exitCode = 1;
		}
	},
};

export default prCommand;
