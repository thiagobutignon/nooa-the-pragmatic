import { execa } from "execa";

export async function executeFormat(path: string): Promise<string> {
    // We assume biome is installed in the project or available via bun
    // Using --write to apply changes
    const { stdout } = await execa("bun", ["biome", "format", "--write", path]);
    return stdout;
}
