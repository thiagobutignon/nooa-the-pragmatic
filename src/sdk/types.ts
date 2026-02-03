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

export type SdkResult<T> = {
	ok: true;
	data: T;
	warnings?: SdkWarning[];
} | {
	ok: false;
	error: SdkError;
	warnings?: SdkWarning[];
};
