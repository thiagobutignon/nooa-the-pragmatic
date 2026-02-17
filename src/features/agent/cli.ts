import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import type { AgentRunInput, AgentRunResult } from "./engine";
import { run as runAgent } from "./engine";

export const agentMeta: AgentDocMeta = {
	name: "agent",
	description: "Run an interactive agentic loop for a prompt",
	changelog: [
		{
			version: "1.0.0",
			changes: ["Initial agent command backed by runtime AgentLoop"],
		},
	],
};

export const agentHelp = `
Usage: nooa agent <prompt> [flags]

Run the agentic loop (LLM + tools) for one message and print the final answer.

Arguments:
  <prompt>            Prompt to send to the runtime agent.

Flags:
  --session-key <id>  Session key (default: cli:direct).
  --max-iterations <n> Maximum loop iterations before failing.
  --json              Output JSON format.
  -h, --help          Show help.
`;

export const agentUsage = {
	cli: 'nooa agent "summarize this repo"',
	sdk: 'await agent.run({ prompt: "summarize this repo" })',
	tui: "AgentConsole()",
};

export const agentSdkUsage = `
SDK Usage:
  const result = await agent.run({ prompt: "what changed today?" });
  if (result.ok) {
    console.log(result.data.content);
  }
`;

export const agentSchema = {
	prompt: { type: "string", required: true },
	"session-key": { type: "string", required: false },
	"max-iterations": { type: "number", required: false },
	json: { type: "boolean", required: false, default: false },
} satisfies SchemaSpec;

export const agentOutputFields = [
	{ name: "sessionKey", type: "string" },
	{ name: "content", type: "string" },
];

export const agentErrors = [
	{ code: "agent.missing_prompt", message: "Prompt is required." },
	{ code: "agent.runtime_error", message: "Agent execution failed." },
];

export async function run(
	input: AgentRunInput,
): Promise<SdkResult<AgentRunResult>> {
	return runAgent(input);
}

const agentBuilder = new CommandBuilder<AgentRunInput, AgentRunResult>()
	.meta(agentMeta)
	.usage(agentUsage)
	.schema(agentSchema)
	.help(agentHelp)
	.sdkUsage(agentSdkUsage)
	.outputFields(agentOutputFields)
	.errors(agentErrors)
	.options({
		options: {
			...buildStandardOptions(),
			"session-key": { type: "string" },
			"max-iterations": { type: "string" },
		},
	})
	.parseInput(async ({ values, positionals }) => {
		const maxIterationsRaw = values["max-iterations"];
		const parsedIterations =
			typeof maxIterationsRaw === "string"
				? Number.parseInt(maxIterationsRaw, 10)
				: undefined;

		return {
			prompt: positionals[1],
			sessionKey:
				typeof values["session-key"] === "string"
					? values["session-key"]
					: undefined,
			maxIterations:
				parsedIterations && Number.isFinite(parsedIterations)
					? parsedIterations
					: undefined,
			json: Boolean(values.json),
		};
	})
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson(output);
			return;
		}
		console.log(output.content);
	})
	.onFailure((error) => {
		handleCommandError(error, ["agent.missing_prompt"]);
	});

export const agentAgentDoc = agentBuilder.buildAgentDoc(false);
export const agentFeatureDoc = (includeChangelog: boolean) =>
	agentBuilder.buildFeatureDoc(includeChangelog);

export default agentBuilder.build();
