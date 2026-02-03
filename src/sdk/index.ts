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
import { goal } from "./goal";
import { guardrail } from "./guardrail";
import { ignore } from "./ignore";
import { indexSdk } from "./indexing";
import { init } from "./init";
import { mcp } from "./mcp";
import { message } from "./message";
import { pr } from "./pr";
import { prompt } from "./prompt";
import { push } from "./push";
import { read } from "./read";
import { review } from "./review";
import { runSdk } from "./run";
import { scaffold } from "./scaffold";
import { search } from "./search";

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
	goal,
	guardrail,
	ignore,
	index: indexSdk,
	init,
	mcp,
	message,
	pr,
	prompt,
	push,
	read,
	review,
	run: runSdk,
	scaffold,
	search,
	skills: {},
	worktree: {},
};

export type { SdkError, SdkResult, SdkWarning } from "./types";
