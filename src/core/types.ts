export interface AgentChangelogEntry {
	version: string;
	changes: string[];
}

export interface AgentDocMeta {
	name: string;
	description: string;
	changelog: AgentChangelogEntry[];
}

export interface AgentDocExample {
	input: string;
	output: string;
}

export interface AgentDocError {
	code: string;
	message: string;
}

export interface AgentDocOutputField {
	name: string;
	type: string;
}

export interface AgentDocExitCode {
	value: string;
	description: string;
}

export interface SdkError {
	code: string;
	message: string;
	details?: Record<string, unknown>;
}

export interface SdkWarning {
	code: string;
	message: string;
	details?: Record<string, unknown>;
}

export type SdkResult<T> =
	| {
			ok: true;
			data: T;
			warnings?: SdkWarning[];
	  }
	| {
			ok: false;
			error: SdkError;
			warnings?: SdkWarning[];
	  };

export function sdkError(
	code: string,
	message: string,
	details?: Record<string, unknown>,
): SdkError {
	return { code, message, details };
}
