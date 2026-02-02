import { execa } from "execa";

export async function executeDiff(path?: string): Promise<string> {
    const args = ["diff"];
    if (path) {
        args.push(path);
    }
    const { stdout } = await execa("git", args);
    return stdout;
}
