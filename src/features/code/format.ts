import { execa } from "execa";

type ExecFn = (cmd: string, args: string[]) => Promise<{ stdout: string }>;

export async function executeFormat(
	path: string,
	exec: ExecFn = execa,
): Promise<string> {
	// We assume biome is installed in the project or available via bun
	// Using --write to apply changes
	const { stdout } = await exec("bun", ["biome", "format", "--write", path]);
	return stdout;
}
