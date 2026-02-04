import type { SdkError } from "./types";

export function renderJson(payload: unknown): void {
	console.log(JSON.stringify(payload, null, 2));
}

export function printError(error: SdkError): void {
	console.error(`Error: ${error.message}`);
}

export function setExitCode(error: SdkError, validationCodes: string[]): void {
	process.exitCode = validationCodes.includes(error.code) ? 2 : 1;
}
