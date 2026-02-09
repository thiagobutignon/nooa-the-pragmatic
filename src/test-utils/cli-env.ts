import { dirname } from "node:path";

const EXEC_DIR = dirname(process.execPath);
const FALLBACK_PATH = "/usr/bin:/bin:/usr/sbin:/sbin";

export const bunPath = process.execPath;
export const repoRoot = process.cwd();

export const baseEnv: NodeJS.ProcessEnv = {
	...process.env,
	PATH: [EXEC_DIR, process.env.PATH, FALLBACK_PATH].filter(Boolean).join(":"),
	NOOA_DISABLE_REFLECTION: "1",
};
