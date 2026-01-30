import { access, writeFile } from "node:fs/promises";

export type WriteCodeInput = {
	path: string;
	content: string;
	overwrite: boolean;
	dryRun: boolean;
};

export type WriteCodeResult = {
	path: string;
	bytes: number;
	overwritten: boolean;
};

export async function writeCodeFile(
	input: WriteCodeInput,
): Promise<WriteCodeResult> {
	const { path, content, overwrite, dryRun } = input;

	let exists = false;
	try {
		await access(path);
		exists = true;
	} catch {
		exists = false;
	}

	if (exists && !overwrite) {
		throw new Error(`File already exists: ${path}`);
	}

	if (!dryRun) {
		await writeFile(path, content, "utf-8");
	}

	return {
		path,
		bytes: Buffer.byteLength(content),
		overwritten: exists,
	};
}
