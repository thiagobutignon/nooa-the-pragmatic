import { buildStandardOptions } from "../../core/cli-flags";
import { handleCommandError, renderJson } from "../../core/cli-output";
import { CommandBuilder, type SchemaSpec } from "../../core/command-builder";
import type { AgentDocMeta, SdkResult } from "../../core/types";
import type { GatewayRunInput, GatewayRunResult } from "./engine";
import { run as runGateway } from "./engine";

export const gatewayMeta: AgentDocMeta = {
	name: "gateway",
	description: "Run gateway channel orchestrator",
	changelog: [
		{
			version: "1.0.0",
			changes: ["Initial gateway command with EventBus + CliChannel wiring"],
		},
	],
};

export const gatewayHelp = `
Usage: nooa gateway [start|status] [flags]

Run the gateway orchestration layer.

Subcommands:
  start              Start gateway processing.
  status             Show gateway status.

Flags:
  --daemon <action>  Manage daemon lifecycle (start|stop|status).
  --once             Process one message and stop (safe mode).
  --message <text>   Message used with --once.
  --json             Output JSON format.
  -h, --help         Show help.
`;

export const gatewayUsage = {
	cli: "nooa gateway start --once --message 'hello'",
	sdk: "await gateway.run({ action: 'status' })",
	tui: "GatewayConsole()",
};

export const gatewaySdkUsage = `
SDK Usage:
  const result = await gateway.run({ action: "status" });
  if (result.ok) {
    console.log(result.data.mode, result.data.running);
  }
`;

export const gatewaySchema = {
	action: { type: "string", required: false },
	daemon: { type: "string", required: false },
	once: { type: "boolean", required: false, default: false },
	message: { type: "string", required: false },
	json: { type: "boolean", required: false, default: false },
} satisfies SchemaSpec;

export const gatewayOutputFields = [
	{ name: "mode", type: "string" },
	{ name: "running", type: "boolean" },
	{ name: "channels", type: "string" },
	{ name: "lastResponse", type: "string" },
	{ name: "pid", type: "number|null" },
];

export const gatewayErrors = [
	{
		code: "gateway.long_running_not_supported",
		message:
			"Long-running gateway mode is not enabled yet. Use --once for now.",
	},
];

export async function run(
	input: GatewayRunInput,
): Promise<SdkResult<GatewayRunResult>> {
	return runGateway(input);
}

const gatewayBuilder = new CommandBuilder<GatewayRunInput, GatewayRunResult>()
	.meta(gatewayMeta)
	.usage(gatewayUsage)
	.schema(gatewaySchema)
	.help(gatewayHelp)
	.sdkUsage(gatewaySdkUsage)
	.outputFields(gatewayOutputFields)
	.errors(gatewayErrors)
	.options({
		options: {
			...buildStandardOptions(),
			daemon: { type: "string" },
			once: { type: "boolean" },
			message: { type: "string" },
		},
	})
	.parseInput(async ({ values, positionals }) => {
		const daemonArg = typeof values.daemon === "string" ? values.daemon : undefined;
		const daemon =
			daemonArg === "start" || daemonArg === "stop" || daemonArg === "status"
				? daemonArg
				: undefined;
		const positionalAction =
			positionals[1] === "status" ||
			positionals[1] === "start" ||
			positionals[1] === "daemon-run"
				? positionals[1]
				: undefined;
		const action = daemon ? "daemon" : positionalAction;
		return {
			action,
			daemon,
			once: Boolean(values.once),
			message: typeof values.message === "string" ? values.message : undefined,
			json: Boolean(values.json),
		};
	})
	.run(run)
	.onSuccess((output, values) => {
		if (values.json) {
			renderJson(output);
			return;
		}
		if (output.mode === "status") {
			console.log(`Gateway status: ${output.running ? "running" : "stopped"}`);
			return;
		}
		if (output.mode === "daemon") {
			const pidSuffix = output.pid ? ` (pid: ${output.pid})` : "";
			console.log(
				`Gateway daemon: ${output.running ? "running" : "stopped"}${pidSuffix}`,
			);
			return;
		}
		console.log(
			`Gateway processed channels: ${output.channels.join(", ")}${output.lastResponse ? ` | response: ${output.lastResponse}` : ""}`,
		);
	})
	.onFailure((error) => {
		handleCommandError(error, ["gateway.long_running_not_supported"]);
	});

export const gatewayAgentDoc = gatewayBuilder.buildAgentDoc(false);
export const gatewayFeatureDoc = (includeChangelog: boolean) =>
	gatewayBuilder.buildFeatureDoc(includeChangelog);

export default gatewayBuilder.build();
