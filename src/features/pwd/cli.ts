import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import { buildStandardOptions } from "../../core/cli-flags";

import {
	renderJson
} from "../../core/cli-output";

import type { AgentDocMeta, SdkResult } from "../../core/types";

export const pwdMeta: AgentDocMeta = {
	name: "pwd",
	description: "Print current working directory",
	changelog: [{ version: "1.0.0", changes: ["Initial release"] }],
};

export const pwdHelp = `
Usage: nooa pwd [flags]

Print the current working directory.

Flags:
  --json              Output JSON with cwd.
  --include-changelog Include changelog in help output.
  -h, --help          Show help message.

Examples:
  nooa pwd
  nooa pwd --json

Exit Codes:
  0: Success
`;

export const pwdSdkUsage = `
SDK Usage:
  const result = await pwd.run({});
  if (result.ok) {
    console.log(result.data.cwd);
  }
`;

export const pwdUsage = {
	cli: "nooa pwd",
	sdk: "await pwd.run({})",
	tui: "PwdLabel()",
};

export const pwdSchema = {
	json: { type: "boolean", required: false, default: false, since: "1.0.0" },
} satisfies SchemaSpec;

export const pwdOutputFields = [{ name: "cwd", type: "string" }];

export const pwdExamples = [
	{ input: "nooa pwd", output: "Print the current working directory." },
	{ input: "nooa pwd --json", output: "Get the current working directory in JSON format." },
];

export const pwdExitCodes = [{ value: "0", description: "Success" }];

export interface PwdRunInput {
	json?: boolean;
}

export interface PwdRunResult {
	cwd: string;
}

export async function run(): Promise<SdkResult<PwdRunResult>> {
	return {
		ok: true,
		data: {
			cwd: process.cwd(),
		},
	};
}

const pwdBuilder = new CommandBuilder<PwdRunInput, PwdRunResult>()
	.meta(pwdMeta)
	.usage(pwdUsage)
	.schema(pwdSchema)
	.help(pwdHelp)
	.sdkUsage(pwdSdkUsage)
	.outputFields(pwdOutputFields)
	.examples(pwdExamples)
	.exitCodes(pwdExitCodes)
	.options({ options: buildStandardOptions() })
	.parseInput(async ({ values }) => ({
		json: Boolean(values.json),
	}))
	.run(async () => run())
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson(output);
			return;
		}
		console.log(output.cwd);
	});

export const pwdAgentDoc = pwdBuilder.buildAgentDoc(false);
export const pwdFeatureDoc = (includeChangelog: boolean) =>
	pwdBuilder.buildFeatureDoc(includeChangelog);

export default pwdBuilder.build();
