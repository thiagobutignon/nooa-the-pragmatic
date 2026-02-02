import { execa } from "execa";

export type MergeMethod = "merge" | "squash" | "rebase";

export async function ghPrCreate(args: {
	base: string;
	head: string;
	title: string;
	body: string;
}) {
	const { stdout, stderr, exitCode } = await execa(
		"gh",
		[
			"pr",
			"create",
			"--base",
			args.base,
			"--head",
			args.head,
			"--title",
			args.title,
			"--body",
			args.body,
		],
		{ reject: false },
	);
	if (exitCode !== 0) {
		throw new Error((stderr || "").trim() || "gh pr create failed");
	}
	const url = (stdout || "").trim();
	return { url };
}

export async function ghPrList() {
	const { stdout } = await execa(
		"gh",
		["pr", "list", "--json", "number,title,author,url"],
		{ reject: false },
	);
	return JSON.parse(stdout || "[]");
}

export async function ghPrDiff(number: number) {
	const { stdout } = await execa("gh", ["pr", "diff", String(number)], {
		reject: false,
	});
	return stdout;
}

export async function ghMergePr(args: {
	number: number;
	method: MergeMethod;
	title?: string;
	message?: string;
}) {
	const methodFlag =
		args.method === "squash"
			? "--squash"
			: args.method === "rebase"
				? "--rebase"
				: "--merge";
	const cmd = [
		"pr",
		"merge",
		String(args.number),
		methodFlag,
		"--json",
		"merged,mergeCommit" as const,
	];
	if (args.title) cmd.push("--subject", args.title);
	if (args.message) cmd.push("--body", args.message);
	const { stdout } = await execa("gh", cmd, { reject: false });
	return JSON.parse(stdout || "{}");
}

export async function ghClosePr(number: number) {
	const { stdout } = await execa(
		"gh",
		[
			"pr",
			"close",
			String(number),
			"--comment",
			"--delete-branch",
			"--json",
			"state",
		],
		{
			reject: false,
		},
	);
	return JSON.parse(stdout || "{}");
}

export async function ghCommentPr(number: number, body: string) {
	const { stdout } = await execa(
		"gh",
		["pr", "comment", String(number), "--body", body, "--json", "id"],
		{
			reject: false,
		},
	);
	return JSON.parse(stdout || "{}");
}

export async function ghStatusPr(number: number) {
	const { stdout } = await execa(
		"gh",
		[
			"pr",
			"view",
			String(number),
			"--json",
			"number,title,state,labels,reviewDecision,statusCheckRollup",
		],
		{ reject: false },
	);
	return JSON.parse(stdout || "{}");
}
