import type { SdkError } from "./types";

export function sdkError(
	code: string,
	message: string,
	details?: Record<string, unknown>,
): SdkError {
	return { code, message, details };
}
