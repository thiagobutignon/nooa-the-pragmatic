import { EventBus } from "../../core/event-bus";
import { CliChannel } from "../../runtime/channels/cli-channel";
import { Gateway, type GatewayRunner } from "../../runtime/gateway/gateway";
import {
	GATEWAY_INBOUND_EVENT,
	GATEWAY_OUTBOUND_EVENT,
	type GatewayInboundMessage,
	type GatewayOutboundMessage,
} from "../../runtime/gateway/messages";

export interface GatewayRunInput {
	action?: "start" | "status";
	once?: boolean;
	message?: string;
	runner?: GatewayRunner;
	defaultRunnerFactory?: () => Promise<GatewayRunner>;
}

export interface GatewayRunResult {
	mode: "start" | "status";
	running: boolean;
	channels: string[];
	lastResponse?: string;
}

type GatewaySdkResult =
	| { ok: true; data: GatewayRunResult }
	| { ok: false; error: { code: string; message: string } };

export async function run(input: GatewayRunInput): Promise<GatewaySdkResult> {
	const action = input.action ?? "start";
	if (action === "status") {
		return {
			ok: true,
			data: {
				mode: "status",
				running: false,
				channels: ["cli"],
			},
		};
	}
	const fallbackFactory =
		input.defaultRunnerFactory ??
		(async () => {
			// c8 ignore start
			const runDefaultAgent: GatewayRunner = async (sessionKey, content) => {
				const { run: runAgent } = await import("../agent/engine");
				const result = await runAgent({
					prompt: content,
					sessionKey,
				});
				if (result.ok) {
					return { forLlm: result.data.content };
				}
				return { forLlm: result.error.message };
			};
			return runDefaultAgent;
			// c8 ignore stop
		});
	const runner = input.runner ?? (await fallbackFactory());

	const bus = new EventBus();
	let lastOutbound: GatewayOutboundMessage | undefined;
	bus.on(GATEWAY_OUTBOUND_EVENT, (message: GatewayOutboundMessage) => {
		lastOutbound = message;
	});

	const gateway = new Gateway(bus, runner);
	const cliChannel = new CliChannel(bus);
	gateway.registerChannel(cliChannel);
	await gateway.start();

	if (input.once) {
		const onceMessage = input.message ?? "healthcheck";
		const outboundPromise = new Promise<GatewayOutboundMessage>((resolve) => {
			const handler = (message: GatewayOutboundMessage) => {
				if (message.channel !== "cli") return;
				bus.off(GATEWAY_OUTBOUND_EVENT, handler);
				resolve(message);
			};
			bus.on(GATEWAY_OUTBOUND_EVENT, handler);
		});
		const inbound: GatewayInboundMessage = {
			channel: "cli",
			chatId: "cli:direct",
			senderId: "cli:user",
			content: onceMessage,
		};
		bus.emit(GATEWAY_INBOUND_EVENT, inbound);
		const outbound = await outboundPromise;
		await gateway.stop();
		return {
			ok: true,
			data: {
				mode: "start",
				running: false,
				channels: gateway.listChannels(),
				lastResponse: outbound.content ?? lastOutbound?.content,
			},
		};
	}

	await gateway.stop();
	return {
		ok: false,
		error: {
			code: "gateway.long_running_not_supported",
			message:
				"Long-running gateway mode is not enabled yet. Use --once for now.",
		},
	};
}
