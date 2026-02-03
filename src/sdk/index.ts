import { ai } from "./ai";
import { ask } from "./ask";
import { check } from "./check";
import { ci } from "./ci";
import { code } from "./code";
import { commit } from "./commit";
import { context } from "./context";
import { cron } from "./cron";
import { doctor } from "./doctor";
import { embed } from "./embed";
import { evalSdk } from "./eval";
import { fix } from "./fix";

export const sdk = {
	ai,
	ask,
	check,
	ci,
	code,
	commit,
	context,
	cron,
	doctor,
	embed,
	eval: evalSdk,
	fix,
	goal: {},
	guardrail: {},
	ignore: {},
	index: {},
	init: {},
	mcp: {},
	message: {},
	pr: {},
	prompt: {},
	push: {},
	read: {},
	review: {},
	run: {},
	scaffold: {},
	search: {},
	skills: {},
	worktree: {},
};

export type { SdkError, SdkResult, SdkWarning } from "./types";
