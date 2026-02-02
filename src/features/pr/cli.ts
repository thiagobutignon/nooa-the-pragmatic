// src/features/pr/cli.ts
import type { Command, CommandContext } from "../../core/command";
import { parseArgs } from "node:util";
import { GitHubClient } from "../../core/integrations/github";
import { getRepoInfo, getCurrentBranch } from "../../core/integrations/git";
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
                repo: { type: "string" }
            },
            allowPositionals: true,
            strict: false
        });

        if (values.help) {
            console.log(prHelp);
            return;
        }

        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            const msg = "Error: GITHUB_TOKEN environment variable is required.";
            if (values.json) console.log(JSON.stringify({ ok: false, error: msg }));
            else console.error(msg);
            process.exitCode = 2;
            return;
        }

        const sub = positionals[1];
        if (!sub) {
            console.log(prHelp);
            return;
        }

        const client = new GitHubClient(token);

        try {
            let owner: string = "";
            let repo: string = "";

            if (typeof values.repo === "string") {
                const [o, r] = values.repo.split("/");
                owner = o;
                repo = r;
            } else {
                const info = await getRepoInfo();
                owner = info.owner;
                repo = info.repo;
            }

            if (!owner || !repo) throw new Error("Could not determine repository owner or name.");

            if (sub === "create") {
                const title = values.title as string;
                const body = values.body as string;
                const head = await getCurrentBranch();
                const base = process.env.NOOA_PR_BASE || "main";

                if (!title || !body) {
                    throw new Error("Missing --title or --body for PR creation.");
                }

                if (values.json) {
                    const result = (await client.createPR(owner, repo, head, base, title, body)) as any;
                    console.log(JSON.stringify({ ok: true, result }, null, 2));
                } else {
                    process.stdout.write(`Creating PR: ${title} from ${head} to ${base}... `);
                    const result = (await client.createPR(owner, repo, head, base, title, body)) as any;
                    console.log("✅");
                    console.log(`URL: ${result.html_url}`);
                }
            } else if (sub === "list") {
                const prs = (await client.listPRs(owner, repo)) as any[];
                if (values.json) {
                    console.log(JSON.stringify({ ok: true, prs }, null, 2));
                } else {
                    console.log(`\nOpen PRs in ${owner}/${repo}:`);
                    if (prs.length === 0) {
                        console.log("No open PRs found.");
                    } else {
                        prs.forEach((pr: any) => {
                            console.log(`#${pr.number}  ${pr.title} (${pr.user.login})`);
                            console.log(`    ${pr.html_url}`);
                        });
                    }
                }
            } else if (sub === "review") {
                const prNumber = parseInt(positionals[2], 10);
                if (isNaN(prNumber)) throw new Error("PR number is required.");

                if (!values.json) console.log(`Fetching diff for PR #${prNumber}...`);
                const diff = await client.getPRDiff(owner, repo, prNumber);
                
                if (!values.json) console.log("Reviewing changes...");
                const { content, result } = await executeReview({
                    diff,
                    json: !!values.json
                }, bus);

                if (values.json) {
                    console.log(JSON.stringify({ ok: true, review: result || { content } }, null, 2));
                } else {
                    console.log("\n--- Review Results ---\n");
                    console.log(content);
                }
            } else if (sub === "merge") {
                const prNumber = parseInt(positionals[2], 10);
                if (isNaN(prNumber)) throw new Error("PR number is required.");
                const method = (values.method as string) || "merge";
                if (!["merge", "squash", "rebase"].includes(method)) {
                    throw new Error("Invalid merge method. Use merge, squash, or rebase.");
                }

                const result = await client.mergePR(owner, repo, prNumber, {
                    method: method as "merge" | "squash" | "rebase",
                    title: values.title as string,
                    message: values.message as string
                });

                if (values.json) {
                    console.log(JSON.stringify({ ok: true, result }, null, 2));
                } else {
                    console.log(`Merged PR #${prNumber} with ${method}.`);
                }
            } else if (sub === "close") {
                const prNumber = parseInt(positionals[2], 10);
                if (isNaN(prNumber)) throw new Error("PR number is required.");

                const result = await client.closePR(owner, repo, prNumber);
                if (values.json) {
                    console.log(JSON.stringify({ ok: true, result }, null, 2));
                } else {
                    console.log(`Closed PR #${prNumber}.`);
                }
            } else if (sub === "comment") {
                const prNumber = parseInt(positionals[2], 10);
                if (isNaN(prNumber)) throw new Error("PR number is required.");
                const { getStdinText } = await import("../../core/io");
                const body = (values.body as string) || (await getStdinText());
                if (!body) throw new Error("Comment body is required.");

                const result = await client.commentPR(owner, repo, prNumber, body);
                if (values.json) {
                    console.log(JSON.stringify({ ok: true, result }, null, 2));
                } else {
                    console.log(`Commented on PR #${prNumber}.`);
                }
            } else if (sub === "status") {
                const prNumber = parseInt(positionals[2], 10);
                if (isNaN(prNumber)) throw new Error("PR number is required.");

                const status = await client.getPRStatus(owner, repo, prNumber);
                if (values.json) {
                    console.log(JSON.stringify({ ok: true, status }, null, 2));
                } else {
                    console.log(`#${status.number} ${status.title}`);
                    console.log(`State: ${status.state}`);
                    console.log(`Approvals: ${status.approvals}`);
                    console.log(`Labels: ${status.labels.join(", ") || "(none)"}`);
                    console.log(
                        `Checks: ${status.checks.passed}/${status.checks.total} passed, ${status.checks.failed} failed, ${status.checks.skipped} skipped`,
                    );
                }
            } else {
                console.error(`Unknown subcommand: ${sub}`);
                console.log(prHelp);
                process.exitCode = 1;
            }
        } catch (e: any) {
            const msg = `Error executing pr ${sub || "unknown"}: ${e.message}`;
            if (values.json) console.log(JSON.stringify({ ok: false, error: msg }));
            else console.error(msg);
            process.exitCode = 1;
        }
    }
};

export default prCommand;
