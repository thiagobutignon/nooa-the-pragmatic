import type { MergeMethod } from "../features/pr/gh";
import {
	ghClosePr,
	ghCommentPr,
	ghMergePr,
	ghPrCreate,
	ghPrDiff,
	ghPrList,
	ghStatusPr,
} from "../features/pr/gh";
import { getCurrentBranch } from "../core/integrations/git";
import { executeReview } from "../features/review/execute";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export interface PrClient {
	ghPrCreate: typeof ghPrCreate;
	ghPrList: typeof ghPrList;
	ghPrDiff: typeof ghPrDiff;
	ghMergePr: typeof ghMergePr;
	ghClosePr: typeof ghClosePr;
	ghCommentPr: typeof ghCommentPr;
	ghStatusPr: typeof ghStatusPr;
}

const defaultClient: PrClient = {
	ghPrCreate,
	ghPrList,
	ghPrDiff,
	ghMergePr,
	ghClosePr,
	ghCommentPr,
	ghStatusPr,
};

export interface PrCreateInput {
	title?: string;
	body?: string;
	base?: string;
	head?: string;
	gh?: PrClient;
}

export interface PrListInput {
	gh?: PrClient;
}

export interface PrMergeInput {
	number?: number;
	method?: MergeMethod;
	title?: string;
	message?: string;
	gh?: PrClient;
}

export interface PrCloseInput {
	number?: number;
	gh?: PrClient;
}

export interface PrCommentInput {
	number?: number;
	body?: string;
	gh?: PrClient;
}

export interface PrStatusInput {
	number?: number;
	gh?: PrClient;
}

export interface PrReviewInput {
	number?: number;
	json?: boolean;
	gh?: PrClient;
}

export async function create(
	input: PrCreateInput,
): Promise<SdkResult<{ url?: string }>> {
	if (!input.title || !input.body) {
		return {
			ok: false,
			error: sdkError("invalid_input", "title and body are required.")
		};
	}
	try {
		const head = input.head ?? (await getCurrentBranch());
		const base = input.base ?? process.env.NOOA_PR_BASE ?? "main";
		const result = await (input.gh ?? defaultClient).ghPrCreate({
			title: input.title,
			body: input.body,
			head,
			base,
		});
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("pr_error", "PR create failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function list(
	input: PrListInput = {},
): Promise<SdkResult<Awaited<ReturnType<typeof ghPrList>>>> {
	try {
		const result = await (input.gh ?? defaultClient).ghPrList();
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("pr_error", "PR list failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function merge(
	input: PrMergeInput,
): Promise<SdkResult<unknown>> {
	if (!input.number) {
		return { ok: false, error: sdkError("invalid_input", "number is required.") };
	}
	const method = input.method ?? "merge";
	if (!(["merge", "squash", "rebase"] as const).includes(method)) {
		return { ok: false, error: sdkError("invalid_input", "invalid merge method.") };
	}
	try {
		const result = await (input.gh ?? defaultClient).ghMergePr({
			number: input.number,
			method,
			title: input.title,
			message: input.message,
		});
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("pr_error", "PR merge failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function close(
	input: PrCloseInput,
): Promise<SdkResult<unknown>> {
	if (!input.number) {
		return { ok: false, error: sdkError("invalid_input", "number is required.") };
	}
	try {
		const result = await (input.gh ?? defaultClient).ghClosePr(input.number);
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("pr_error", "PR close failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function comment(
	input: PrCommentInput,
): Promise<SdkResult<unknown>> {
	if (!input.number || !input.body) {
		return { ok: false, error: sdkError("invalid_input", "number and body are required.") };
	}
	try {
		const result = await (input.gh ?? defaultClient).ghCommentPr(
			input.number,
			input.body,
		);
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("pr_error", "PR comment failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function status(
	input: PrStatusInput,
): Promise<SdkResult<unknown>> {
	if (!input.number) {
		return { ok: false, error: sdkError("invalid_input", "number is required.") };
	}
	try {
		const result = await (input.gh ?? defaultClient).ghStatusPr(input.number);
		return { ok: true, data: result };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("pr_error", "PR status failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export async function review(
	input: PrReviewInput,
): Promise<SdkResult<{ content: string; result?: unknown }>> {
	if (!input.number) {
		return { ok: false, error: sdkError("invalid_input", "number is required.") };
	}
	try {
		const diff = await (input.gh ?? defaultClient).ghPrDiff(input.number);
		const { content, result } = await executeReview({ diff, json: Boolean(input.json) });
		return { ok: true, data: { content, result } };
	} catch (error) {
		return {
			ok: false,
			error: sdkError("pr_error", "PR review failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const pr = {
	create,
	list,
	merge,
	close,
	comment,
	status,
	review,
};
