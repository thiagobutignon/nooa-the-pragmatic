import { execa } from "execa";

export async function git(args: string[], cwd: string) {
	return execa("git", args, { cwd, reject: false });
}
