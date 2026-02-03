import { createTraceId } from "../core/logger";
import { executeReview, type ReviewResult } from "../features/review/execute";
import { sdkError } from "./errors";
import type { SdkResult } from "./types";

export type ReviewSeverity = "low" | "medium" | "high";

export interface ReviewRunInput {
	path?: string;
	staged?: boolean;
	diff?: string;
	json?: boolean;
	prompt?: string;
	failOn?: ReviewSeverity;
}

export interface ReviewRunResult {
	ok: boolean;
	traceId: string;
	content: string;
	result?: ReviewResult;
}

export async function run(
	input: ReviewRunInput,
): Promise<SdkResult<ReviewRunResult>> {
	const traceId = createTraceId();
	const shouldStage = input.staged ?? (!input.path && !input.diff);
	if (!input.path && !input.diff && !shouldStage) {
		return {
			ok: false,
			error: sdkError("invalid_input", "path, diff, or staged input required."),
		};
	}

	try {
		const { content, result } = await executeReview({
			path: input.path,
			staged: shouldStage,
			diff: input.diff,
			json: !!input.json,
			prompt: input.prompt,
			failOn: input.failOn,
			traceId,
		});

		if (input.json && !result) {
			return {
				ok: false,
				error: sdkError("review_parse", "Review JSON parsing failed.", {
					content,
					traceId,
				}),
			};
		}

		if (input.failOn && result) {
			const levels: ReviewSeverity[] = ["low", "medium", "high"];
			const minLevelIdx = levels.indexOf(input.failOn);
			if (minLevelIdx === -1) {
				return {
					ok: false,
					error: sdkError(
						"invalid_input",
						`Invalid severity level '${input.failOn}'.`,
					),
				};
			}
			const highSeverityIssues = result.findings.filter(
				(f) => levels.indexOf(f.severity) >= minLevelIdx,
			);
			if (highSeverityIssues.length > 0) {
				return {
					ok: false,
					error: sdkError(
						"review_fail_on",
						`Found ${highSeverityIssues.length} issues with severity >= ${input.failOn}.`,
						{
							failOn: input.failOn,
							findings: highSeverityIssues,
							result,
							content,
							traceId,
						},
					),
				};
			}
		}

		return {
			ok: true,
			data: {
				ok: true,
				traceId,
				content,
				result,
			},
		};
	} catch (error) {
		return {
			ok: false,
			error: sdkError("runtime_error", "Review failed.", {
				message: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

export const review = {
	run,
};
