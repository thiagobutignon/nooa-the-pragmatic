import type { SdkError } from "./types";

export function renderJson(payload: unknown): void {
	console.log(JSON.stringify(payload, null, 2));
}

export async function renderJsonOrWrite(
	payload: unknown,
	outPath?: string,
	successMessage?: string,
): Promise<void> {
	const jsonOutput = JSON.stringify(payload, null, 2);
	if (outPath) {
		const { writeFile } = await import("node:fs/promises");
		await writeFile(outPath, jsonOutput, "utf-8");
		console.log(successMessage ?? `✅ Results written to ${outPath}`);
		return;
	}
	console.log(jsonOutput);
}

export function printError(error: SdkError): void {
	console.error(`Error: ${error.message}`);
}

export function setExitCode(error: SdkError, validationCodes: string[]): void {
	process.exitCode = validationCodes.includes(error.code) ? 2 : 1;
}

export function handleCommandError(
	error: SdkError,
	validationCodes: string[],
): void {
	printError(error);
	setExitCode(error, validationCodes);
}
