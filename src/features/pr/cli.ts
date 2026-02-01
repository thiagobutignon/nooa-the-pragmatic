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

Flags:
  --repo <owner/repo>   Specify repository (otherwise inferred from remote).
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
                const base = "main"; // TODO: Make configurable

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
                if (isNaN(prNumber)) throw new Error("Missing or invalid PR number.");

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
