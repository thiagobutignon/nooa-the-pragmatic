import type { BacklogPrd } from "./types";

const BACKLOG_ALLOWED_STATES = [
	"pending",
	"implementing",
	"verifying",
	"peer_review_1",
	"peer_fix_1",
	"peer_review_2",
	"peer_fix_2",
	"peer_review_3",
	"approved",
	"committed",
	"passed",
	"failed",
	"blocked",
] as const;

export interface BacklogValidationResult {
	ok: boolean;
	errors: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function validateBacklogPrd(input: unknown): BacklogValidationResult {
	const errors: string[] = [];

	if (!isObject(input)) {
		return { ok: false, errors: ["PRD payload must be an object"] };
	}

	if (typeof input.project !== "string" || input.project.trim() === "") {
		errors.push("project must be a non-empty string");
	}
	if (typeof input.branchName !== "string" || input.branchName.trim() === "") {
		errors.push("branchName must be a non-empty string");
	}
	if (
		typeof input.description !== "string" ||
		input.description.trim() === ""
	) {
		errors.push("description must be a non-empty string");
	}

	if (!Array.isArray(input.userStories)) {
		errors.push("userStories must be an array");
	} else if (input.userStories.length === 0) {
		errors.push("userStories must contain at least 1 story");
	} else {
		input.userStories.forEach((story, index) => {
			if (!isObject(story)) {
				errors.push(`userStories[${index}] must be an object`);
				return;
			}
			if (typeof story.id !== "string" || story.id.trim() === "") {
				errors.push(`userStories[${index}].id must be a non-empty string`);
			}
			if (typeof story.title !== "string" || story.title.trim() === "") {
				errors.push(`userStories[${index}].title must be a non-empty string`);
			}
			if (
				typeof story.description !== "string" ||
				story.description.trim() === ""
			) {
				errors.push(
					`userStories[${index}].description must be a non-empty string`,
				);
			}
			if (!Array.isArray(story.acceptanceCriteria)) {
				errors.push(
					`userStories[${index}].acceptanceCriteria must be an array`,
				);
			} else if (story.acceptanceCriteria.length === 0) {
				errors.push(
					`userStories[${index}].acceptanceCriteria must contain at least 1 item`,
				);
			}
			if (
				typeof story.state !== "string" ||
				!BACKLOG_ALLOWED_STATES.includes(
					story.state as (typeof BACKLOG_ALLOWED_STATES)[number],
				)
			) {
				errors.push(
					`userStories[${index}].state must be one of: ${BACKLOG_ALLOWED_STATES.join(", ")}`,
				);
			}
			if (story.profileCommand !== undefined) {
				if (!Array.isArray(story.profileCommand)) {
					errors.push(
						`userStories[${index}].profileCommand must be an array when provided`,
					);
				} else if (
					story.profileCommand.length === 0 ||
					story.profileCommand.some(
						(segment) =>
							typeof segment !== "string" || segment.trim().length === 0,
					)
				) {
					errors.push(
						`userStories[${index}].profileCommand must contain non-empty string segments`,
					);
				}
			}
		});
	}

	return { ok: errors.length === 0, errors };
}

export function assertBacklogPrd(input: unknown): BacklogPrd {
	const validation = validateBacklogPrd(input);
	if (!validation.ok) {
		throw new Error(validation.errors.join("; "));
	}
	return input as BacklogPrd;
}
