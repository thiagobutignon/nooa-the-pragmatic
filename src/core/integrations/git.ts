import { execa } from "execa";

export async function getRepoInfo(
	cwd: string = process.cwd(),
): Promise<{ owner: string; repo: string }> {
	try {
		const { stdout } = await execa("git", ["remote", "get-url", "origin"], {
			cwd,
		});
		// Handle SSH: git@github.com:owner/repo.git
		// Handle HTTPS: https://github.com/owner/repo.git
		const match = stdout.match(
			/(?:github\.com[:/])([^/]+)\/([^/.]+)(?:\.git)?/,
		);
		if (!match) throw new Error("Could not parse GitHub remote URL.");

		return {
			owner: match[1] || "",
			repo: match[2] || "",
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to get repository info: ${message}`);
	}
}

export async function getCurrentBranch(
	cwd: string = process.cwd(),
): Promise<string> {
	const { stdout } = await execa("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
		cwd,
	});
	return stdout.trim();
}
