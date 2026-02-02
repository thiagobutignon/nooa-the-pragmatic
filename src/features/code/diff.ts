import { execa } from "execa";

type ExecFn = (cmd: string, args: string[]) => Promise<{ stdout: string }>;

export async function executeDiff(
	path?: string,
	exec: ExecFn = execa,
): Promise<string> {
	const args = ["diff"];
	if (path) {
		args.push(path);
	}
	const { stdout } = await exec("git", args);
	return stdout;
}
